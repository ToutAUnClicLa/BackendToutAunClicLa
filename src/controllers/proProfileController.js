// =============================================================================
// MÓDULO PRO — Controlador de perfil
// CRUD del perfil profesional: ver (propio), editar, perfil público por slug,
// y subida de avatar a Supabase Storage. El slug es FIJO (se asigna al
// registrarse) para no romper links ya compartidos.
// =============================================================================
import bcrypt from 'bcryptjs';
import stripe from '../config/stripe.js';
import { supabaseAdmin } from '../config/supabase.js';
import { sendProAccountDeletedEmail } from '../config/resend.js';
import {
  findProBySlug,
  validateCategoria,
  updatePro,
  publicProfile,
  withLiveTier,
} from '../services/proService.js';
import { listSocial } from '../services/proSocialService.js';
import { getEffectiveTier } from '../services/proTierService.js';
import { getSubscriptionRow } from '../services/proBillingService.js';

const AVATAR_BUCKET = 'pro-avatars';
const GALLERY_BUCKET = 'pro-gallery';
// Estados de pro_suscripciones.estado que implican un cobro activo/pendiente
// en Stripe y por lo tanto requieren cancelación explícita antes de borrar.
const ACTIVE_SUB_STATES = ['trialing', 'active', 'past_due'];

// Campos que el profesional puede editar vía PUT /me (whitelist).
// Excluye email, tier, verificado, slug, password — no editables aquí.
const EDITABLE_FIELDS = [
  'nombre', 'apellido', 'empresa',
  'telefono', 'sitio_web', 'ciudad', 'codigo_postal', 'email_contacto',
  'titulo_fr', 'titulo_en', 'titulo_es',
  'bio_fr', 'bio_en', 'bio_es',
  'idioma_principal', 'idiomas_hablados',
  'categoria_id', 'subcategoria_id',
];

// === GET /me — perfil propio completo ========================================
const getMe = async (req, res) => {
  try {
    // req.proUser lo inyecta requireProAuth
    return res.json({ pro: await withLiveTier(req.proUser) });
  } catch (error) {
    console.error('❌ Pro getMe error:', error);
    return res.status(500).json({ error: 'Fetch failed', message: error.message });
  }
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
    return res.json({ message: 'Perfil actualizado', pro: await withLiveTier(updated) });
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

    // tier en vivo: pro.tier es la columna cacheada y puede quedar atrás de la
    // suscripción real (ver getMe) — la carta pública es justamente una de las
    // funciones de pago que ese drift rompía.
    const tier = await getEffectiveTier(pro);

    // El perfil público es una función de pago: Free no tiene página /card/:slug.
    if (tier === 'free') {
      return res.status(404).json({ error: 'Not found', message: 'Perfil no disponible' });
    }

    // Redes sociales públicas (solo plataforma + url)
    const redesRaw = await listSocial(pro.id);
    const redes = redesRaw.map((r) => ({ plataforma: r.plataforma, url: r.url }));

    // Galería (solo Max): si vacía queda como [] y el frontend la oculta.
    let galeria = [];
    if (tier === 'max') {
      const { data: fotos } = await supabaseAdmin
        .from('pro_galeria')
        .select('imagen_url, titulo, descripcion, orden')
        .eq('profesional_id', pro.id)
        .order('orden', { ascending: true });
      galeria = fotos || [];
    }

    return res.json({ pro: { ...publicProfile(pro, lang), tier, redes, galeria } });
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

    return res.json({ message: 'Avatar actualizado', foto_url: publicUrl, pro: await withLiveTier(updated) });
  } catch (error) {
    console.error('❌ Pro uploadAvatar error:', error);
    return res.status(500).json({ error: 'Upload failed', message: error.message });
  }
};

// Borra todo el contenido de la carpeta {proId}/ en un bucket. Supabase Storage
// no tiene borrado recursivo por prefijo: hay que listar y luego remove(paths).
// Best-effort: un fallo aquí no debe bloquear la eliminación de la cuenta.
const clearProStorageFolder = async (bucket, proId) => {
  try {
    const { data: files } = await supabaseAdmin.storage.from(bucket).list(proId);
    if (!files?.length) return;
    const paths = files.map((f) => `${proId}/${f.name}`);
    await supabaseAdmin.storage.from(bucket).remove(paths);
  } catch (error) {
    console.error(`⚠️  Pro deleteMe: fallo limpiando storage (${bucket}):`, error);
  }
};

// === DELETE /me — eliminar cuenta profesional completamente =================
// Orden crítico:
//   1) Cancelar en Stripe la suscripción con cobro activo (ANTES de borrar la
//      fila: pro_suscripciones tiene ON DELETE CASCADE y con ella se pierde el
//      stripe_subscription_id necesario para cancelarla).
//   2) Limpiar Storage (avatar + galería) — NO cubierto por el CASCADE de la DB.
//   3) Borrar la fila: el CASCADE limpia redes/suscripciones/tarjetas/galería/analytics.
const deleteMe = async (req, res) => {
  try {
    const pro = req.proUser;
    const { password, confirmarEmail } = req.body;

    // Gate de confirmación: contraseña actual para cuentas con auth propia;
    // las cuentas de Google no tienen password_hash, así que confirman
    // escribiendo su email.
    if (pro.password_hash) {
      if (!password) {
        return res.status(400).json({ error: 'Password required', message: 'Confirma tu contraseña actual para eliminar la cuenta' });
      }
      const valid = await bcrypt.compare(password, pro.password_hash);
      if (!valid) {
        return res.status(401).json({ error: 'Invalid password', message: 'Contraseña incorrecta' });
      }
    } else if (!confirmarEmail || confirmarEmail.trim().toLowerCase() !== pro.email.toLowerCase()) {
      return res.status(400).json({ error: 'Confirmation required', message: 'Escribe tu email para confirmar la eliminación' });
    }

    // 1) Stripe
    const subscription = await getSubscriptionRow(pro.id);
    if (subscription?.stripe_subscription_id && ACTIVE_SUB_STATES.includes(subscription.estado)) {
      try {
        await stripe.subscriptions.cancel(subscription.stripe_subscription_id);
      } catch (stripeError) {
        // resource_missing = ya no existe en Stripe (idempotente, seguimos).
        // Cualquier otro error aborta: no queremos borrar la cuenta y dejar
        // un cobro recurrente activo que ya nadie puede cancelar.
        if (stripeError.code !== 'resource_missing') {
          console.error('❌ Pro deleteMe: fallo al cancelar suscripción Stripe:', stripeError);
          return res.status(502).json({
            error: 'Stripe cancellation failed',
            message: 'No se pudo cancelar tu suscripción activa. Intenta de nuevo o contacta soporte.',
          });
        }
      }
    }

    // 2) Storage
    await Promise.all([
      clearProStorageFolder(AVATAR_BUCKET, pro.id),
      clearProStorageFolder(GALLERY_BUCKET, pro.id),
    ]);

    // 3) Fila (CASCADE limpia el resto)
    const { error: deleteError } = await supabaseAdmin
      .from('pro_profesionales')
      .delete()
      .eq('id', pro.id);
    if (deleteError) throw deleteError;

    // El envío de email no debe tumbar la respuesta: la cuenta ya fue eliminada.
    try {
      await sendProAccountDeletedEmail(pro.email, pro.nombre);
    } catch (emailError) {
      console.error('⚠️  Pro deleteMe: fallo al enviar email de confirmación:', emailError);
    }

    return res.json({ message: 'Cuenta eliminada correctamente' });
  } catch (error) {
    console.error('❌ Pro deleteMe error:', error);
    return res.status(500).json({ error: 'Delete account failed', message: error.message });
  }
};

export { getMe, updateMe, getPublicProfile, uploadAvatar, deleteMe };
