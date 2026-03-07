# Meetup Subscriptions - Architecture and Operations

This project keeps a static Jekyll frontend and uses Cloudflare Workers + D1 for meetup registrations.

## Scope

- Static site stays on GitHub Pages.
- Registrations are handled by Cloudflare Worker API.
- Hard capacity limit is enforced server-side.
- No waitlist.

## Components

- Frontend form: `meetup-25-03-2026.html`
- Frontend client logic: `assets/js/meetup-registration.js`
- Worker API: `workers/meetup-api/src/index.js`
- D1 schema/migrations: `workers/meetup-api/migrations/0001_schema.sql`
- Worker deploy workflow: `.github/workflows/deploy-worker.yml`

## Data model

### `meetups`

- `slug` (PK)
- `title`
- `event_date`
- `capacity`
- `registrations_count`
- `is_open`
- `created_at`, `updated_at`

### `registrations`

- `id` (PK)
- `meetup_slug` (FK)
- `name`
- `email`
- `document_encrypted`
- `document_last4`
- `consent_lgpd`
- `created_at`

## API

### `GET /api/meetups/:slug/status`

Returns availability status only:

- `slug`
- `title`
- `eventDate`
- `isOpen`
- `isFull`

### `POST /api/meetups/:slug/register`

Request JSON:

- `name`
- `email`
- `document` (CPF only)
- `consentLgpd` (must be `true`)

Validation:

- Name and email format
- CPF structure + check digits
- LGPD consent required

Responses:

- `201` success
- `409` when full or duplicate email
- `400` validation errors

## Capacity enforcement (no waitlist)

Server-side flow:

1. Atomically reserve 1 seat with guarded update (`registrations_count < capacity`)
2. Insert registration row
3. If insert fails, rollback reservation with decrement

This ensures frontend cannot bypass the limit.

## LGPD / Security

- CPF is encrypted with AES-GCM before storage (`DOC_ENCRYPTION_KEY_BASE64` secret)
- Consent flag is mandatory
- CORS restricted via `ALLOWED_ORIGIN`
- Recommendation: add Turnstile CAPTCHA and retention policy (delete records after event window)
- DPO contact for privacy requests: `dpo@hackinbrasil.com.br`

## Cloudflare setup checklist

1. Create D1 database `meetup_db`
2. Set D1 binding `DB` on Worker
3. Configure in `wrangler.toml`:
   - `database_id`
   - `ALLOWED_ORIGIN` (supports comma-separated origins)
4. Apply migrations:

```bash
cd workers/meetup-api
npm install
npx wrangler d1 migrations apply meetup_db --remote
```

5. Set encryption secret:

```bash
openssl rand -base64 32
npx wrangler secret put DOC_ENCRYPTION_KEY_BASE64
```

6. Deploy:

```bash
npx wrangler deploy
```

## Frontend integration

Form attributes in `meetup-25-03-2026.html`:

- `data-api-base="https://<worker-domain>"`
- `data-meetup-slug="meetup-25-03-2026"`

UX behavior:

- Shows only "Inscrições abertas" or "Inscrições encerradas"
- No spot counts displayed
- Success/error shown in modal with close button

## Troubleshooting

### Button remains disabled

- Check Worker status endpoint in browser/curl
- Verify `ALLOWED_ORIGIN` matches deployed site origin (`www` and non-`www` if needed)
- Hard refresh frontend cache

### `500` from Worker

- Usually missing D1 migrations or missing secret
- Re-apply migrations and verify `DOC_ENCRYPTION_KEY_BASE64`

### CORS issues

- Ensure origin is in `ALLOWED_ORIGIN`
- Redeploy Worker after changing `wrangler.toml`
