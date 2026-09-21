# ToutAunClicLa API

Express API (`ESM`) for the **shop** (grocery + restaurants + Stripe Checkout) and **Servicios Pro** (digital cards, directory, subscriptions). Postgres/storage live in **Supabase**. Email is **Resend**. Payments are **Stripe** — shop Checkout (`mode: payment`, CAD) and Pro subscriptions (Price IDs).

Frontend: Next.js on `http://localhost:3000`. This process listens on **`5500`** locally (`PORT`). Railway injects `PORT` in production — do not pin `5500` there.

Base path: **`/api/v1`**. Health (no prefix): `GET /health`.

---

## Quick start

```bash
cp .env.example .env.development.local   # fill real values
npm install
npm run dev                              # nodemon → src/server.js
```

`NODE_ENV=development` (default) loads **only** `.env.development.local` (`src/config/env.js`). Production (Railway) uses host env — no dotenv file.

Check:

```bash
curl http://localhost:5500/health
```

If this is down, the frontend Pro directory (`/servicios/...`) fails with `ERR_CONNECTION_REFUSED` — it calls `http://localhost:5500/api/v1/pro/services` in `next dev`.

---

## Env

Names the code actually reads: see `.env.example`. Copy it; never commit `.env.development.local`.

| Must set | Notes |
| --- | --- |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Missing → throw at boot |
| `STRIPE_SECRET_KEY` | `sk_test_` → TEST; otherwise LIVE. Missing → throw |
| `JWT_SECRET` | Same string as the frontend `JWT_SECRET` |
| `FRONTEND_URL` | Prod origin, **no trailing slash** |
| Shop + Pro webhook secrets | Two different `whsec_` |
| Four `STRIPE_PRICE_*` | Test IDs locally; **live** IDs with `sk_live_` |

Optional: `FRONTEND_DEVELOP_URL` (Vercel Preview CORS), `RESEND_API_KEY`, `ADMIN_EMAILS`, `STRIPE_TAX_ENABLED`.

No `STRIPE_PUBLISHABLE_KEY`, no `GOOGLE_*`, no Arcjet — the app does not read them.

---

## Local Stripe (CLI)

Webhooks are mounted **before** `express.json` so Stripe gets a raw body:

| Endpoint | Env | Handler |
| --- | --- | --- |
| `POST /api/v1/stripe/webhook` | `STRIPE_WEBHOOK_SECRET` | shop Checkout |
| `POST /api/v1/pro/webhook` | `STRIPE_PRO_WEBHOOK_SECRET` | Pro subscriptions |

One `stripe listen` forwards **one** path. Use **two terminals**. Do **not** pass `--events` in PowerShell (the comma list splits and the CLI errors).

```bash
# Terminal 2 — shop (keep running if you also test Pro)
stripe listen --forward-to localhost:5500/api/v1/stripe/webhook

# Terminal 3 — Pro
stripe listen --forward-to localhost:5500/api/v1/pro/webhook
```

Paste each printed `whsec_...` into `.env.development.local`, then **restart** `npm run dev`.

Shop Dashboard events to subscribe in prod: at least `checkout.session.completed`. Pro: `customer.subscription.created|updated|deleted`, `invoice.payment_failed`, `checkout.session.completed`. Swapping the two secrets → 400 signature errors.

Trigger a test event (after listen is up):

```bash
stripe trigger checkout.session.completed
```

---

## Scripts

| Command | What |
| --- | --- |
| `npm run dev` | Local server + nodemon |
| `npm start` | `node src/server.js` (Railway) |
| `npm run test:pro` | Jest Pro + checkout order units (`jest.pro.config.js`) |
| `npm test` | Jest (`jest.config.js`) — ESM; prefer `test:pro` for Pro |
| `npm run test:pro:e2e` | `tests/integration/pro-flow.test.js` (needs live API + env) |
| `npm run test:pro:e2e:week3` | Pro week-3 integration |
| `npm run test:payment` / `:unit` / `:integration` | Shop cart/tax/shipping helpers |

`scripts/tests/*` (`test:auth`, `test:cart`, …) hit a running server. Start `npm run dev` first.

---

## Architecture

```
src/
  server.js          Helmet, CORS, rate limit, raw Stripe webhooks, /api/v1/*, worker
  config/            env.js, supabase.js, stripe.js, resend.js
  routes/            One router per domain; Pro is a single router with sections
  controllers/       HTTP in/out
  services/          DB, Stripe, email, Pro billing/directory/vCard
  middlewares/       JWT (shop / restaurant / Pro), Joi, rate limits, errors
  utils/             Shipping (CAD FSA map), cart helpers
  workers/           Order auto-accept / auto-deliver (interval in-process)
docs/api/            Per-resource notes
docs/database/       schema.md
```

Request path: `server.js` → `routes/*.route.js` → middleware (auth, Joi) → `controllers` → `services` → `supabaseAdmin` (almost all DB) or Stripe/Resend.

Auth is **not** one pool:

- Shop users: `auth.middleware.js` (JWT from `authController`)
- Restaurants: `restaurantAuth.middleware.js`
- Pro: `proAuth.middleware.js` + `proTier.middleware.js` (`requireActiveTier`)
- Super-admin: `ADMIN_EMAILS` + admin middleware on shop routes

Pro public routes (`GET /services`, `GET /categories`, `GET /:slug`, vCard/QR) have **no** JWT. Literal paths (`/me`, `/services`) are registered **before** `/:slug`.

---

## API map (`/api/v1`)

| Prefix | Product |
| --- | --- |
| `/auth`, `/users`, `/products`, `/cart`, `/orders`, `/addresses`, `/reviews`, `/favorites` | Shop |
| `/stripe` | Shop Checkout session + refund (webhook is **not** on this router) |
| `/restaurants` | Restaurant admin |
| `/super-admin` | Coupons, restaurants, orders, users |
| `/upload` | Restaurant image upload |
| `/pro` | Pro auth, profile, billing, directory, analytics, cards |

CORS allow-list: `http://localhost:3000` + `FRONTEND_URL` + `FRONTEND_DEVELOP_URL` (`credentials: true`). Trailing slashes are stripped for CORS only; Stripe URL concat is still `${FRONTEND_URL}/...` — set origins **without** `/`.

---

## Practices

- Keep secrets on Railway / `.env.development.local`. Service role never goes to the frontend.
- Match Stripe **mode**: secret key, Price IDs, and both webhook secrets from the same account (test vs live).
- `FRONTEND_URL` = production site (Stripe redirects, Pro QR). Preview origin belongs in `FRONTEND_DEVELOP_URL`, not `FRONTEND_URL`.
- New env vars: add the read in `env.js` (or document why not), then `.env.example`. Do not list unused names.
- Validate at the route with Joi. Controllers stay thin; shared math lives in `*Logic.js` next to the service (easier to unit-test without HTTP).
- Do not add `express.json()` in front of the two webhook mounts.
- Shop checkout currency in this API is **CAD**. Shipping: `src/utils/shippingCalculator.js` (free over $200 CAD). Amounts are not env vars.
- Endpoint docs: `docs/api/`. Product notes for Pro: `Servicios-Pro.md`.
