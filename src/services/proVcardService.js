// =============================================================================
// MÓDULO PRO — vCard + QR (IO). Lógica pura del vCard en proVcardLogic.js.
// =============================================================================
import QRCode from 'qrcode';
import { supabaseAdmin } from '../config/supabase.js';
import { FRONTEND_URL } from '../config/env.js';
import { resolveLang } from './proSerializers.js';
import { buildVcard } from './proVcardLogic.js';

const MAX_PHOTO_BYTES = 2 * 1024 * 1024; // incrusta hasta 2MB; sobre eso, URI

// Trae los campos necesarios del profesional (incluye email/telefono privados,
// legítimos en una tarjeta de contacto que el pro publica).
const fetchProForVcard = async (slug) => {
  const { data } = await supabaseAdmin
    .from('pro_profesionales')
    .select(
      'id, slug, nombre, apellido, titulo_fr, titulo_en, titulo_es, idioma_principal, ' +
      'empresa, telefono, email, sitio_web, foto_url, activo',
    )
    .eq('slug', slug)
    .maybeSingle();
  return data && data.activo ? data : null;
};

// Descarga la foto y la codifica en base64 (para incrustarla en el vCard).
const fetchFotoBase64 = async (url) => {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_PHOTO_BYTES) return null;
    return { base64: buf.toString('base64'), mime: res.headers.get('content-type') || 'image/jpeg' };
  } catch {
    return null;
  }
};

// Genera el vCard. Devuelve { vcf, pro } o null si no existe.
const generateVcard = async (slug) => {
  const pro = await fetchProForVcard(slug);
  if (!pro) return null;

  const { data: redes = [] } = await supabaseAdmin
    .from('pro_redes_sociales')
    .select('plataforma, url, orden')
    .eq('profesional_id', pro.id)
    .order('orden', { ascending: true });

  const foto = await fetchFotoBase64(pro.foto_url);
  const titulo = resolveLang(pro, 'titulo', pro.idioma_principal || 'fr');

  const vcf = buildVcard({
    nombre: pro.nombre,
    apellido: pro.apellido,
    titulo,
    empresa: pro.empresa,
    telefono: pro.telefono,
    email: pro.email,
    sitio_web: pro.sitio_web,
    redes,
    fotoBase64: foto?.base64,
    fotoMime: foto?.mime,
    // Si no se pudo incrustar (muy grande / falló), referencia por URI.
    fotoUri: foto ? null : pro.foto_url,
  });

  return { vcf, pro };
};

// URL destino del QR: la tarjeta pública con marca de origen para analytics.
const cardUrl = (slug) => `${FRONTEND_URL}/card/${slug}?src=qr`;

// Genera el PNG del QR (Buffer).
const generateQrPng = async (slug) =>
  QRCode.toBuffer(cardUrl(slug), {
    type: 'png',
    width: 512,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#0f172a', light: '#ffffff' },
  });

export { generateVcard, generateQrPng, cardUrl };
