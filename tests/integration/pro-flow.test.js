/**
 * E2E — Módulo PRO (Semana 1)
 * Prueba el flujo completo contra el servidor VIVO:
 *   registro → verificación → login → perfil (CRUD) → avatar →
 *   tier gating → redes sociales (límites) → perfil público.
 *
 * Requisitos:
 *   1. Server corriendo:  npm run dev
 *   2. Migraciones aplicadas (incl. storage)
 *
 * Ejecutar:  npm run test:pro:e2e
 * (Es un script node normal — NODE_ENV=development carga tu .env, no usa jest)
 */
import { supabaseAdmin } from '../../src/config/supabase.js';
import '../../src/config/env.js';

const PORT = process.env.PORT || 5500;
const BASE = `http://localhost:${PORT}/api/v1/pro`;
const EMAIL = `e2e-${Date.now()}@example.com`;
const PASSWORD = 'test12345';

let pass = 0;
let fail = 0;
let token = null;
let slug = null;

const ok = (cond, label, extra = '') => {
  if (cond) { pass++; console.log(`✅ ${label}`); }
  else { fail++; console.log(`❌ ${label}  ${extra}`); }
};

const api = async (method, path, { body, auth, form } = {}) => {
  const headers = {};
  if (auth && token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) { payload = form; }
  else if (body) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const res = await fetch(`${BASE}${path}`, { method, headers, body: payload });
  let data = null;
  try { data = await res.json(); } catch { /* sin cuerpo */ }
  return { status: res.status, data };
};

const run = async () => {
  console.log(`\n🚀 E2E módulo Pro — ${EMAIL}\n`);

  // 0. Server vivo
  try {
    await fetch(`http://localhost:${PORT}/health`);
  } catch {
    console.error(`❌ No hay servidor en :${PORT}. Corre 'npm run dev' primero.`);
    process.exit(1);
  }

  // 1. REGISTRO
  let r = await api('POST', '/register', {
    body: { email: EMAIL, password: PASSWORD, nombre: 'Juan', apellido: 'Pérez' },
  });
  ok(r.status === 201, '1. Registro crea profesional (201)', JSON.stringify(r.data));
  slug = r.data?.pro?.slug;
  ok(/^juan-perez/.test(slug || ''), '   slug generado desde el nombre', slug);

  // 2. LOGIN antes de verificar → 403
  r = await api('POST', '/login', { body: { email: EMAIL, password: PASSWORD } });
  ok(r.status === 403, '2. Login sin verificar es rechazado (403)', `status=${r.status}`);

  // 3. Leer el código de la DB y VERIFICAR
  const { data: row } = await supabaseAdmin
    .from('pro_profesionales')
    .select('token_verificacion_email')
    .eq('email', EMAIL)
    .single();
  const code = row?.token_verificacion_email;
  ok(!!code, '3. Código de verificación guardado en DB', code || 'sin código');

  r = await api('POST', '/verify-email', { body: { email: EMAIL, code } });
  ok(r.status === 200 && r.data?.pro?.verificado === true, '   verify-email marca verificado (200)');

  // 4. LOGIN tras verificar → token
  r = await api('POST', '/login', { body: { email: EMAIL, password: PASSWORD } });
  ok(r.status === 200 && !!r.data?.token, '4. Login tras verificar devuelve token');
  token = r.data?.token;

  // 5. Token del e-commerce NO sirve (scope) — token basura
  const bad = await fetch(`${BASE}/me`, { headers: { Authorization: 'Bearer not-a-pro-token' } });
  ok(bad.status === 401, '5. Token inválido en /me → 401');

  // 6. GET /me
  r = await api('GET', '/me', { auth: true });
  ok(r.status === 200 && r.data?.pro?.email === EMAIL, '6. GET /me devuelve el perfil propio');

  // 7. PUT /me — trilingüe + idiomas + contacto
  r = await api('PUT', '/me', {
    auth: true,
    body: {
      titulo_es: 'Estilista', titulo_fr: 'Coiffeur', titulo_en: 'Stylist',
      bio_es: '15 años de experiencia',
      idiomas_hablados: ['es', 'fr', 'en'], ciudad: 'Montreal',
    },
  });
  ok(r.status === 200 && r.data?.pro?.titulo_es === 'Estilista', '7. PUT /me actualiza campos trilingües');

  // 8. PUT /me bloquea campos no editables (email/tier)
  r = await api('PUT', '/me', { auth: true, body: { email: 'hacker@x.com', tier: 'max' } });
  ok(r.status === 400, '8. PUT /me rechaza campos no permitidos (400)', `status=${r.status}`);

  // 9. AVATAR — sube un PNG 1x1
  try {
    const pngB64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/1eRAAAAAElFTkSuQmCC';
    const blob = new Blob([Buffer.from(pngB64, 'base64')], { type: 'image/png' });
    const fd = new FormData();
    fd.append('file', blob, 'avatar.png');
    r = await api('POST', '/me/avatar', { auth: true, form: fd });
    ok(r.status === 200 && !!r.data?.foto_url, '9. Avatar sube a Storage y persiste foto_url', JSON.stringify(r.data));
  } catch (e) {
    ok(false, '9. Avatar upload', e.message);
  }

  // 10. TIER GATING — como free, POST /me/social → 403
  r = await api('POST', '/me/social', { auth: true, body: { plataforma: 'instagram', url: 'https://ig.com/x' } });
  ok(r.status === 403, '10. free no puede agregar redes (403)', `status=${r.status}`);

  // 11. Subir a PRO y agregar 5 redes; la 6ª se bloquea
  const proId = (await supabaseAdmin.from('pro_profesionales').select('id').eq('email', EMAIL).single()).data.id;
  await supabaseAdmin.from('pro_profesionales').update({ tier: 'pro' }).eq('id', proId);

  let added = 0;
  for (let i = 1; i <= 5; i++) {
    const rr = await api('POST', '/me/social', { auth: true, body: { plataforma: `p${i}`, url: `https://x.com/${i}` } });
    if (rr.status === 201) added++;
  }
  ok(added === 5, '11. Pro agrega 5 redes', `agregadas=${added}`);

  r = await api('POST', '/me/social', { auth: true, body: { plataforma: 'p6', url: 'https://x.com/6' } });
  ok(r.status === 403, '   la 6ª red se bloquea por límite (403)', `status=${r.status}`);

  // 12. Subir a MAX → la 6ª ahora pasa
  await supabaseAdmin.from('pro_profesionales').update({ tier: 'max' }).eq('id', proId);
  r = await api('POST', '/me/social', { auth: true, body: { plataforma: 'p6', url: 'https://x.com/6' } });
  ok(r.status === 201, '12. Max permite redes ilimitadas (6ª pasa)', `status=${r.status}`);

  // 13. PERFIL PÚBLICO — titulo resuelto en ES, sin email, con redes
  r = await api('GET', `/${slug}?lang=es`);
  ok(r.status === 200 && r.data?.pro?.titulo === 'Estilista', '13. Perfil público resuelve titulo en ES');
  ok(r.data?.pro?.email === undefined, '   perfil público NO expone email');
  ok(Array.isArray(r.data?.pro?.redes) && r.data.pro.redes.length >= 6, '   perfil público incluye redes');

  // 14. Perfil público inexistente → 404
  r = await api('GET', '/slug-que-no-existe-123');
  ok(r.status === 404, '14. Slug inexistente → 404');

  // LIMPIEZA
  await supabaseAdmin.from('pro_profesionales').delete().eq('email', EMAIL);
  console.log('\n🧹 Profesional de prueba eliminado.');

  console.log(`\n=== RESULTADO: ${pass} ✅  /  ${fail} ❌ ===\n`);
  process.exit(fail === 0 ? 0 : 1);
};

run().catch((e) => { console.error('💥 Error fatal:', e); process.exit(1); });
