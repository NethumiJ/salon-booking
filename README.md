# Salon Booking (Sri Lanka)

Next.js 16 (App Router) · Tailwind · Drizzle ORM · **Turso (free libSQL)** · deploys on **Vercel Hobby (free)**.

## Roles & URLs

| Who | URL | Login |
|---|---|---|
| Platform admin (you) | `/admin` | username + password from env vars |
| Salon owner / manager | `/login` → `/dashboard` | username + password (created by you in `/admin`) |
| Customer | `/<salon-slug>` (e.g. `/glam-cuts`) | phone number + WhatsApp OTP; asks name on first visit to that salon |

Admin creates a salon: URL name, owner login, name, colours, logo, hours, contact details.
Salon dashboard: bookings (accept / cancel / done / no-show / reschedule), services (price, duration, which workers perform it), team + leave days, offers/sales, customer search (name/phone), settings, staff logins.

## Local development

```powershell
npm install
npm run db:push     # creates local.db (SQLite file) - no account needed
npm run db:seed     # demo salon /glam-cuts  (owner: glam-owner / Demo-Owner-2026)
npm run dev
```
`.env.local` is already generated (dev admin: `admin`, password noted in a comment inside that file; `DEV_SHOW_OTP=true` shows the OTP on screen).

## Deploy (all free)

1. **Database** – create a free DB at <https://turso.tech> (`turso db create salon`, `turso db tokens create salon`).
   Put `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` in `.env.local`, then run `npm run db:push` once to create the tables in Turso.
2. **Secrets** – generate `SESSION_SECRET` (48+ random chars) and your admin hash:
   `npm run hash-password -- "a long admin password"` → `ADMIN_PASSWORD_HASH`.
3. **Vercel** – import the repo, add all vars from `.env.example` (Project → Settings → Environment Variables). Set `NEXT_PUBLIC_SITE_URL` to your real URL (used by sitemap/SEO).
4. Do **not** set `DEV_SHOW_OTP` in real production.

## WhatsApp OTP

`src/lib/whatsapp.ts` is the single place to plug in your provider (stub for now). OTP rules: 6 digits, 5-minute expiry, single use, max 5 attempts, 3 sends / 10 min per number, hashed (HMAC) in the DB.

## Security summary

- **Headers**: strict CSP with per-request nonce + `strict-dynamic`, HSTS (preload), `X-Frame-Options: DENY`, `nosniff`, Referrer-Policy, Permissions-Policy, COOP/CORP; `X-Powered-By` removed.
- **XSS**: React output escaping, no raw HTML, JSON-LD escaped, hex-validated theme colours (no CSS injection), CSP.
- **SQLi**: Drizzle parameterised queries only; every input validated with Zod; LIKE wildcards stripped.
- **IDOR / multi-tenancy**: every query is scoped by `salonId` from the signed session (never from form input); customers only see their own bookings; assigned workers/services are verified to belong to the salon.
- **AuthN**: scrypt password hashes, constant-time compare + dummy hash for unknown users, DB-backed rate limits (per IP and per account), `__Host-` HttpOnly SameSite cookies, signed JWTs re-validated against the DB each request (disabling an account / salon takes effect immediately), short admin (2h) / staff (8h) sessions.
- **CSRF**: Server Actions origin check + proxy rejects cross-origin writes + SameSite cookies.
- **SSRF / LFI / SSTI**: no user-controlled URLs are fetched (WhatsApp uses a fixed provider URL), no filesystem access, no template engines, no `eval`.
- **File upload**: logos only; size cap 200 KB, **magic-byte** validation (PNG/JPEG/WebP, SVG rejected), stored in the DB (not the filesystem), served with `nosniff` + `sandbox` CSP.
- **Double booking**: slots re-validated on the server, transactional overlap check + partial unique index.
- **Enumeration**: generic login errors; registration status of a phone number is only revealed after OTP verification.
- Run `npm audit` periodically and keep dependencies updated.

## Notes / next ideas
Staff-created walk-in bookings, email/WhatsApp booking notifications (reuse `whatsapp.ts`), per-worker working hours, image gallery, Sinhala/Tamil translations.
