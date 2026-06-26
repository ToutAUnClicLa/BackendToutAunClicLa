// =============================================================================
// MÓDULO PRO — Controlador de perfil
// CRUD del perfil profesional: ver (propio), editar, perfil público por slug,
// y subida de avatar a Supabase Storage. El slug es FIJO (se asigna al
// registrarse) para no romper links ya compartidos.
// =============================================================================
import { supabaseAdmin } from '../config/supabase.js';
import {
  findProBySlug,
  validateCategoria,
  updatePro,
  sanitizePro,
  publicProfile,
} from '../services/proService.js';
import { listSocial } from '../services/proSocialService.js';

const AVATAR_BUCKET = 'pro-avatars';

// Campos que el profesional puede editar vía PUT /me (whitelist).
// Excluye email, tier, verificado, slug, password — no editables aquí.
const EDITABLE_FIELDS = [
  'nombre', 'apellido', 'empresa',
  'telefono', 'sitio_web', 'ciudad', 'codigo_postal',
  'titulo_fr', 'titulo_en', 'titulo_es',
  'bio_fr', 'bio_en', 'bio_es',
  'idioma_principal', 'idiomas_hablados',
  'categoria_id', 'subcategoria_id',
];

// === GET /me — perfil propio completo ========================================
const getMe = async (req, res) => {
  // req.proUser lo inyecta requireProAuth
  return res.json({ pro: sanitizePro(req.proUser) });
};

// === PUT /me — editar perfil propio ==========================================
const updateMe = async (req, res) => {
  try {
    // Construye el patch SOLO con los campos permitidos presentes en el body
    const patch = {};
    for (const field of EDITABLE_FIELDS) {
      if (req.body[field] !== undefined) patch[field] = req.body[field];
    }

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: 'No changes', message: 'No hay campos para actualizar' });
    }

    // Si se cambia categoría/subcategoría, validar coherencia
    if (patch.categoria_id !== undefined || patch.subcategoria_id !== undefined) {
      const categoriaId = patch.categoria_id ?? req.proUser.categoria_id;
      const subcategoriaId = patch.subcategoria_id ?? req.proUser.subcategoria_id;
      const check = await validateCategoria(categoriaId, subcategoriaId);
      if (!check.ok) {
        return res.status(400).json({ error: 'Invalid category', message: check.message });
      }
    }

    const updated = await updatePro(req.proUser.id, patch);
    return res.json({ message: 'Perfil actualizado', pro: sanitizePro(updated) });
  } catch (error) {
    console.error('❌ Pro updateMe error:', error);
    return res.status(500).json({ error: 'Update failed', message: error.message });
  }
};

// === GET /:slug — perfil público =============================================
const getPublicProfile = async (req, res) => {
  try {
    const { slug } = req.params;
    const langParam = (req.query.lang || '').toString();
    const lang = ['fr', 'en', 'es'].includes(langParam) ? langParam : 'fr';

    const pro = await findProBySlug(slug);
    if (!pro || !pro.activo) {
      return res.status(404).json({ error: 'Not found', message: 'Perfil no encontrado' });
    }

    // Redes sociales públicas (solo plataforma + url)
    const redesRaw = await listSocial(pro.id);
    const redes = redesRaw.map((r) => ({ plataforma: r.plataforma, url: r.url }));

    return res.json({ pro: { ...publicProfile(pro, lang), redes } });
  } catch (error) {
    console.error('❌ Pro getPublicProfile error:', error);
    return res.status(500).json({ error: 'Fetch failed', message: error.message });
  }
};

// === POST /me/avatar — subir foto de perfil ==================================
const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file', message: 'Adjunta una imagen en el campo "file"' });
    }

    const ext = (req.file.originalname.split('.').pop() || 'jpg').toLowerCase();
    const fileName = `${req.proUser.id}/avatar-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(AVATAR_BUCKET)
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from(AVATAR_BUCKET)
      .getPublicUrl(fileName);

    const updated = await updatePro(req.proUser.id, { foto_url: publicUrl });

    return res.json({ message: 'Avatar actualizado', foto_url: publicUrl, pro: sanitizePro(updated) });
  } catch (error) {
    console.error('❌ Pro uploadAvatar error:', error);
    return res.status(500).json({ error: 'Upload failed', message: error.message });
  }
};

export { getMe, updateMe, getPublicProfile, uploadAvatar };
