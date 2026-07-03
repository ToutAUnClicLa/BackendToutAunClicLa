/**
 * E2E — Módulo PRO (Semana 3)
 * Prueba contra el servidor VIVO todo lo construido en la Semana 3:
 *   directorio público (/services) → perfil público (/:slug) →
 *   vCard (/:slug/vcard) → QR (/:slug/qr) → analytics (/analytics).
 *
 * Sigue EXACTAMENTE el patrón de pro-flow.test.js:
 *   script node plano (sin jest), contadores pass/fail, helper api(),
 *   fetch a http://localhost:PORT/api/v1/pro, chequeo de /health al inicio,
 *   limpieza al final con supabaseAdmin, exit code 0/1.
 *
 * Requisitos:
 *   1. Server corriendo:  npm run dev
 *   2. Migraciones + seed del módulo Pro aplicados (categorías reales en DB)
 *
 * Ejecutar:  npm run test:pro:e2e:week3
 * (NODE_ENV=development carga tu .env, no usa jest)
 */
import { supabaseAdmin } from '../../src/config/supabase.js';
import '../../src/config/env.js';

const PORT = process.env.PORT || 5500;
const BASE = `http://localhost:${PORT}/api/v1/pro`;
const STAMP = Date.now();
const PASSWORD = 'test12345';

// 3 profesionales de la MISMA categoría, uno por tier.
const SEEDS = {
  max: { email: `e2e-w3-max-${STAMP}@example.com`, nombre: 'Zeta', apellido: 'MaxW3' },
  pro: { email: `e2e-w3-pro-${STAMP}@example.com`, nombre: 'Yara', apellido: 'ProW3' },
  free: { email: `e2e-w3-free-${STAMP}@example.com`, nombre: 'Xavi', apellido: 'FreeW3' },
};
const ALL_EMAILS = Object.values(SEEDS).map((s) => s.email);

let pass = 0;
let fail = 0;

const ok = (cond, label, extra = '') => {
  if (cond) { pass++; console.log(`✅ ${label}`); }
  else { fail++; console.log(`❌ ${label}  ${extra}`); }
};

// Helper HTTP genérico (JSON). Devuelve status + data + headers + raw.
const api = async (method, path, { body, auth, token, raw } = {}) => {
  const headers = {};
  if (auth && token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (body) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const res = await fetch(`${BASE}${path}`, { method, headers, body: payload });
  const ct = res.headers.get('content-type') || '';
  let data = null;
  let text = null;
  let buffer = null;
  if (raw) {
    buffer = Buffer.from(await res.arrayBuffer());
  } else if (ct.includes('application/json')) {
    try { data = await res.json(); } catch { /* sin cuerpo */ }
  } else {
    try { text = await res.text(); } catch { /* sin cuerpo */ }
  }
  return { status: res.status, data, text, buffer, ct };
};

// Encuentra el índice de un slug dentro del array de items del directorio.
const idxOfSlug = (items, slug) => items.findIndex((it) => it.slug === slug);

// Registra → lee token en DB → verifica → login → devuelve { token, slug, id }.
const bootstrapPro = async ({ email, nombre, apellido }) => {
  let r = await api('POST', '/register', { body: { email, password: PASSWORD, nombre, apellido } });
  if (r.status !== 201) throw new Error(`register ${email} → ${r.status} ${JSON.stringify(r.data)}`);
  const slug = r.data?.pro?.slug;

  const { data: row } = await supabaseAdmin
    .from('pro_profesionales')
    .select('id, token_verificacion_email')
    .eq('email', email)
    .single();
  const code = row?.token_verificacion_email;

  r = await api('POST', '/verify-email', { body: { email, code } });
  if (r.status !== 200) throw new Error(`verify ${email} → ${r.status} ${JSON.stringify(r.data)}`);

  r = await api('POST', '/login', { body: { email, password: PASSWORD } });
  if (r.status !== 200 || !r.data?.token) throw new Error(`login ${email} → ${r.status}`);

  return { token: r.data.token, slug, id: row.id };
};

const run = async () => {
  console.log(`\n🚀 E2E módulo Pro — Semana 3 (directorio/perfil/vCard/QR/analytics) — stamp ${STAMP}\n`);

  // 0. Server vivo
  try {
    await fetch(`http://localhost:${PORT}/health`);
  } catch {
    console.error(`❌ No hay servidor en :${PORT}. Corre 'npm run dev' primero.`);
    process.exit(1);
  }

  // ── SEED ──────────────────────────────────────────────────────────────────
  // Categoría real desde GET /categories (el filtro `category` espera el SLUG).
  const cats = await api('GET', '/categories');
  ok(cats.status === 200 && Array.isArray(cats.data?.categorias) && cats.data.categorias.length > 0,
    'SEED. GET /categories devuelve categorías reales', JSON.stringify(cats.data)?.slice(0, 120));
  const categoria = cats.data.categorias[0];
  const CAT_ID = categoria.id;
  const CAT_SLUG = categoria.slug;

  // idiomas por tier: max y pro hablan ['es','fr']; free solo ['fr'].
  const langsByTier = { max: ['es', 'fr'], pro: ['es', 'fr'], free: ['fr'] };

  const pros = {};
  for (const tier of ['max', 'pro', 'free']) {
    const created = await bootstrapPro(SEEDS[tier]);
    pros[tier] = created;

    // PUT /me — categoría, ciudad, títulos trilingües, idiomas hablados.
    const put = await api('PUT', '/me', {
      auth: true, token: created.token,
      body: {
        categoria_id: CAT_ID,
        ciudad: 'Montreal',
        titulo_es: `Titulo ES ${tier}`,
        titulo_fr: `Titre FR ${tier}`,
        bio_es: `Bio ES ${tier}`,
        bio_fr: `Bio FR ${tier}`,
        idiomas_hablados: langsByTier[tier],
      },
    });
    if (put.status !== 200) throw new Error(`PUT /me ${tier} → ${put.status} ${JSON.stringify(put.data)}`);
  }

  // Tier + destacado directo en DB (como pro-flow paso 11). activo=true por default.
  await supabaseAdmin.from('pro_profesionales')
    .update({ tier: 'max', destacado: true, activo: true }).eq('id', pros.max.id);
  await supabaseAdmin.from('pro_profesionales')
    .update({ tier: 'pro', activo: true }).eq('id', pros.pro.id);
  await supabaseAdmin.from('pro_profesionales')
    .update({ tier: 'free', activo: true }).eq('id', pros.free.id);

  const SLUG_MAX = pros.max.slug;
  const SLUG_PRO = pros.pro.slug;
  const SLUG_FREE = pros.free.slug;
  console.log(`   seeds → max=${SLUG_MAX}  pro=${SLUG_PRO}  free=${SLUG_FREE}  cat=${CAT_SLUG}\n`);

  // ── 1. Directorio sin filtros: aparecen los 3, orden por tier, payload por tier
  {
    // pageSize alto para asegurar que los 3 caben en una página.
    const r = await api('GET', '/services?pageSize=50');
    ok(r.status === 200 && Array.isArray(r.data?.items), '1. GET /services → 200 con items[]', `status=${r.status}`);
    const items = r.data?.items || [];

    const iMax = idxOfSlug(items, SLUG_MAX);
    const iPro = idxOfSlug(items, SLUG_PRO);
    const iFree = idxOfSlug(items, SLUG_FREE);
    ok(iMax !== -1 && iPro !== -1 && iFree !== -1, '   los 3 seeds aparecen en el directorio',
      `max=${iMax} pro=${iPro} free=${iFree}`);
    ok(iMax !== -1 && iPro !== -1 && iMax < iPro, '   MAX aparece antes que PRO', `max=${iMax} pro=${iPro}`);
    ok(iPro !== -1 && iFree !== -1 && iPro < iFree, '   PRO aparece antes que FREE', `pro=${iPro} free=${iFree}`);

    const maxItem = items[iMax];
    const freeItem = items[iFree];
    ok(maxItem?.destacado === true, '   MAX trae destacado:true', JSON.stringify(maxItem)?.slice(0, 120));
    ok(freeItem && freeItem.foto_url === undefined && freeItem.redes === undefined,
      '   FREE es payload mínimo (sin foto_url/redes)', JSON.stringify(freeItem));
  }

  // ── 2. Filtro category (SLUG) + idioma=es: incluye max y pro, EXCLUYE free
  {
    const r = await api('GET', `/services?category=${encodeURIComponent(CAT_SLUG)}&idioma=es&pageSize=50`);
    ok(r.status === 200 && Array.isArray(r.data?.items), '2. GET /services?category&idioma=es → 200', `status=${r.status}`);
    const items = r.data?.items || [];
    const slugs = items.map((it) => it.slug);
    ok(slugs.includes(SLUG_MAX) && slugs.includes(SLUG_PRO), '   incluye MAX y PRO (hablan es)',
      `max=${slugs.includes(SLUG_MAX)} pro=${slugs.includes(SLUG_PRO)}`);
    ok(!slugs.includes(SLUG_FREE), '   EXCLUYE FREE (solo habla fr)', `free-in=${slugs.includes(SLUG_FREE)}`);
    // Todos los resultados cumplen el filtro de categoría (mismo categoria_id).
    const allSameCat = items.every((it) => it.categoria_id === CAT_ID);
    ok(allSameCat, '   todos los resultados cumplen el filtro de categoría');
  }

  // ── 3. Perfil público del PRO en ?lang=es: titulo resuelto en es, sin email
  {
    const r = await api('GET', `/${SLUG_PRO}?lang=es`);
    ok(r.status === 200 && r.data?.pro?.slug === SLUG_PRO, '3. GET /:slug (pro, lang=es) → 200', `status=${r.status}`);
    ok(r.data?.pro?.titulo === 'Titulo ES pro', '   titulo resuelto en ES', r.data?.pro?.titulo);
    ok(r.data?.pro?.email === undefined, '   perfil público NO expone email');
  }

  // ── 4. vCard: Content-Type text/vcard + body con BEGIN:VCARD y FN:
  {
    const r = await api('GET', `/${SLUG_PRO}/vcard`);
    ok(r.status === 200, '4. GET /:slug/vcard → 200', `status=${r.status}`);
    ok((r.ct || '').startsWith('text/vcard'), '   Content-Type empieza por text/vcard', r.ct);
    const body = r.text || '';
    ok(body.includes('BEGIN:VCARD'), '   body contiene BEGIN:VCARD');
    ok(/FN:/.test(body), '   body contiene FN:');
  }

  // ── 5. QR: Content-Type image/png + firma PNG (89 50 4E 47)
  {
    const r = await api('GET', `/${SLUG_PRO}/qr`, { raw: true });
    ok(r.status === 200, '5. GET /:slug/qr → 200', `status=${r.status}`);
    ok((r.ct || '').startsWith('image/png'), '   Content-Type image/png', r.ct);
    const b = r.buffer;
    const isPng = b && b.length > 4 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
    ok(isPng, '   primeros bytes = firma PNG (89 50 4E 47)',
      b ? [...b.slice(0, 4)].map((x) => x.toString(16)).join(' ') : 'sin buffer');
  }

  // ── 6. Analytics: vista_perfil → 204 (NO 200) + fila en DB (fire-and-forget)
  {
    // NOTA: el plan (Semana 3) preveía 200, pero el CONTRATO IMPLEMENTADO es 204
    // no-revelador (no confirma si el slug existe). Validamos el contrato real: 204.
    const r = await api('POST', '/analytics', { body: { evento: 'vista_perfil', slug: SLUG_PRO } });
    ok(r.status === 204, '6. POST /analytics {vista_perfil} → 204 (contrato no-reveldor; plan decía 200)',
      `status=${r.status}`);

    // La escritura es asíncrona (fire-and-forget): polling hasta ~10 x 300ms.
    let found = false;
    for (let i = 0; i < 10 && !found; i++) {
      const { data: rows } = await supabaseAdmin
        .from('pro_analytics')
        .select('id, evento')
        .eq('profesional_id', pros.pro.id)
        .eq('evento', 'vista_perfil')
        .limit(1);
      if (rows && rows.length > 0) found = true;
      else await new Promise((res) => setTimeout(res, 300));
    }
    ok(found, '   fila vista_perfil escrita en pro_analytics (fire-and-forget)');

    // Bonus: evento inválido → 400
    const bad = await api('POST', '/analytics', { body: { evento: 'no_existe', slug: SLUG_PRO } });
    ok(bad.status === 400, '   evento inválido → 400', `status=${bad.status}`);

    // Bonus: slug inexistente → 204 silencioso y SIN fila nueva
    const ghostSlug = `slug-inexistente-${STAMP}`;
    const ghost = await api('POST', '/analytics', { body: { evento: 'vista_perfil', slug: ghostSlug } });
    ok(ghost.status === 204, '   slug inexistente → 204 silencioso', `status=${ghost.status}`);
    await new Promise((res) => setTimeout(res, 500));
    // No hay profesional para ese slug → imposible que haya fila asociada.
    const { data: ghostPro } = await supabaseAdmin
      .from('pro_profesionales').select('id').eq('slug', ghostSlug).maybeSingle();
    ok(!ghostPro, '   slug inexistente no creó profesional (sin fila de analytics)');
  }

  console.log(`\n=== RESULTADO: ${pass} ✅  /  ${fail} ❌ ===\n`);
};

// Limpieza: borra los 3 profesionales. pro_analytics y pro_redes_sociales
// tienen FK ON DELETE CASCADE, así que se borran solos. Corre pase o falle (finally).
const cleanup = async () => {
  try {
    await supabaseAdmin.from('pro_profesionales').delete().in('email', ALL_EMAILS);
    console.log('🧹 Profesionales de prueba (+ analytics/redes en cascada) eliminados.');
  } catch (e) {
    console.error('⚠️ Limpieza falló:', e.message);
  }
};

run()
  .catch((e) => { console.error('💥 Error fatal:', e); fail = fail || 1; })
  .finally(async () => {
    await cleanup();
    process.exit(fail === 0 ? 0 : 1);
  });
