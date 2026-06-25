# AIDesigner Backend

A minimal Vercel + Postgres backend for the AIDesigner Chrome extension.
Handles register/login, JWT verification, user profile/subscription status,
Stripe checkout, and — the main piece — serving provider automation scripts
only to verified, authorized users.

## Endpoints

| Method | Path                  | Auth required | Purpose |
|--------|-----------------------|----------------|---------|
| POST   | /api/auth/register    | no             | Create account, returns JWT |
| POST   | /api/auth/login       | no             | Returns JWT |
| GET    | /api/auth/verify      | Bearer token   | Lightweight check used on every action |
| GET    | /api/auth/me          | Bearer token   | Full profile + subscription + usage |
| GET    | /api/provider-code    | Bearer token   | Returns the JS for `?provider=X&action=Y` |
| POST   | /api/stripe/checkout  | no (looks up by email) | Creates a Stripe Checkout session |
| POST   | /api/stripe/webhook   | Stripe signature | Keeps subscription status in sync |

This matches what `auth.js` in the extension already expects — you shouldn't
need to change the extension code at all, just point `AUTH_SERVER` at wherever
you deploy this.

## 1. Database

Create a Postgres database (any of these work — pick one):
- [Neon](https://neon.tech) (free tier, easiest)
- [Supabase](https://supabase.com)
- Vercel Postgres (via the Vercel Storage tab)

Run `schema.sql` against it once (each provider has a SQL console in their dashboard,
or use `psql "$DATABASE_URL" -f schema.sql`).

## 2. Environment variables

Copy `.env.example` to `.env` for local dev, and add the same variables in
**Vercel → Project Settings → Environment Variables** for production:

- `DATABASE_URL` — your Postgres connection string
- `JWT_SECRET` — generate with `openssl rand -hex 32`
- `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET` — from your Stripe dashboard
- `CHECKOUT_SUCCESS_URL`, `CHECKOUT_CANCEL_URL`

## 3. Migrate your provider scripts

Drop your existing automation scripts (the ones that used to live in the
extension's local `providers/` folder) into `providers/scripts/`, renamed to
match the `provider` + `action` your extension requests:

```
providers/scripts/deepseek-chat.js   ← provider=deepseek, action=chat
providers/scripts/qwen-chat.js       ← provider=qwen,     action=chat
providers/scripts/gemini-image.js    ← provider=gemini,   action=image
```

Just paste the raw file contents in — no escaping or string-wrapping needed,
since the server reads them as plain files with `fs.readFileSync`.
If your extension calls `fetchProviderCode(provider, actionType)` with
different names, match the filenames to whatever those values are
(`background.js` currently calls it with `'deepseek'/'chat'`,
`'gemini'/'image'`, etc. — check your actual `executeAction()` calls).

The `vercel.json` `includeFiles` config makes sure these get bundled into the
serverless function at deploy time (otherwise Vercel's bundler can drop files
it doesn't see statically imported).

## 4. Deploy

```bash
npm install
npx vercel        # first deploy, follow prompts
npx vercel --prod # promote to production
```

Note the production URL Vercel gives you (e.g. `https://your-project.vercel.app`).

## 5. Point the extension at it

In `auth.js`, update:

```js
const AUTH_SERVER = 'https://your-project.vercel.app';
```

And in `manifest.json`, update `host_permissions` to include that domain
(it's already wide open via `<all_urls>` in the version you shared, so this
step may be a no-op, but worth double-checking if you tighten permissions later).

## 6. Stripe webhook

In the Stripe Dashboard → Developers → Webhooks, add an endpoint pointing to:
`https://your-project.vercel.app/api/stripe/webhook`

Subscribe to at least: `checkout.session.completed`, `customer.subscription.updated`,
`customer.subscription.deleted`. Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.

## Notes on the auth model

- Tokens are JWTs valid for 30 days, signed with `JWT_SECRET`. There's no
  server-side session table — revocation only happens by changing `JWT_SECRET`
  (logs everyone out) or by checking against the DB (which `/me` and
  `/provider-code` already do, since they re-fetch the user row).
- Free-tier usage is tracked via `usage_used` / `usage_limit` columns and
  incremented each time `/api/provider-code` is called by a non-subscribed user.
  Adjust the gating logic in `api/provider-code.js` if you want different rules
  (e.g. gate by `actionType`, or not gate at all and rely on Stripe alone).
