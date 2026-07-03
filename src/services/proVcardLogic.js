// =============================================================================
// MÓDULO PRO — Lógica pura de vCard (RFC 6350 / vCard 3.0). SIN IO.
// vCard 3.0 es el formato con mejor compatibilidad iOS/Android.
// =============================================================================

// Escapa caracteres reservados de vCard (\ ; , y saltos de línea).
const escapeVcard = (s) =>
  String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');

// Line folding RFC 6350: líneas > 75 octetos se parten con CRLF + espacio.
const foldLine = (line) => {
  if (line.length <= 75) return line;
  const out = [line.slice(0, 75)];
  let i = 75;
  while (i < line.length) {
    out.push(' ' + line.slice(i, i + 74));
    i += 74;
  }
  return out.join('\r\n');
};

// Construye el .vcf a partir de datos ya resueltos (título en un idioma, etc.)
const buildVcard = ({
  nombre,
  apellido = '',
  titulo,
  empresa,
  telefono,
  email,
  sitio_web,
  redes = [],
  fotoBase64,
  fotoMime,
  fotoUri,
}) => {
  const lines = ['BEGIN:VCARD', 'VERSION:3.0'];

  lines.push(`N:${escapeVcard(apellido)};${escapeVcard(nombre)};;;`);
  lines.push(`FN:${escapeVcard(`${nombre} ${apellido}`.trim())}`);
  if (empresa) lines.push(`ORG:${escapeVcard(empresa)}`);
  if (titulo) lines.push(`TITLE:${escapeVcard(titulo)}`);
  if (telefono) lines.push(`TEL;TYPE=CELL:${escapeVcard(telefono)}`);
  if (email) lines.push(`EMAIL;TYPE=INTERNET:${escapeVcard(email)}`);
  if (sitio_web) lines.push(`URL:${escapeVcard(sitio_web)}`);

  for (const r of redes) {
    if (!r?.url) continue;
    lines.push(`X-SOCIALPROFILE;TYPE=${escapeVcard(r.plataforma || 'social')}:${escapeVcard(r.url)}`);
  }

  if (fotoBase64) {
    const type = String(fotoMime || 'image/jpeg').includes('png') ? 'PNG' : 'JPEG';
    lines.push(`PHOTO;ENCODING=b;TYPE=${type}:${fotoBase64}`);
  } else if (fotoUri) {
    // Foto demasiado grande para incrustar: referencia por URI.
    lines.push(`PHOTO;VALUE=URI:${escapeVcard(fotoUri)}`);
  }

  lines.push('END:VCARD');
  return lines.map(foldLine).join('\r\n');
};

export { escapeVcard, foldLine, buildVcard };
