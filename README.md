# SOHEL MEDIA PANEL — mobile-first starter

A starter project for a mobile-first customer/admin panel.

## Included
- Responsive mobile UI (login/register, dashboard, service list, order form, order history, wallet)
- Node.js + Express API
- Password hashing (bcrypt), signed JWT in HttpOnly cookie
- SQLite database and schema initialization
- Admin-only service price management and manual wallet top-ups
- TopSMM-compatible provider adapter (server-side only; API key stays in `.env`)
- Payment gateway adapter placeholder. FamApp/FamPay does not have a verified public merchant API configured here; do not paste random "API keys" from third parties.
- Webhook placeholder with signature verification TODO clearly marked

## Requirements
- Node.js 20+
- npm

## Run locally
1. Copy `.env.example` to `.env`.
2. Set a long random `JWT_SECRET`.
3. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD`.
4. `npm install`
5. `npm run dev`
6. Open http://localhost:3000

The first admin account is created on startup from `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

## Provider setup
Set `TOPSMM_API_URL=https://topsmm.in/api/v2` and `TOPSMM_API_KEY` in `.env`.
The provider adapter uses POST form fields `key`, `action`, etc. Verify exact parameter names and service rules against the provider's current documentation before enabling live orders.
Never expose provider credentials in frontend code.

## Payments
This starter uses manual UPI payment requests and admin approval. A payment is NOT credited merely because the browser says "success".
For an actual gateway, use a merchant account and the provider's official server-side order + webhook/signature verification flow. FamApp/FamPay is not wired to a gateway API in this starter because a supported public merchant API has not been verified.

## Production checklist
- Use HTTPS.
- Change all secrets and admin credentials.
- Use a managed database / persistent disk; SQLite is for starter/demo use.
- Add rate limiting, email verification, password reset, CSRF protection, audit logs, backups, monitoring.
- Configure gateway webhook verification before automatic wallet credit.
- Follow social platforms' terms and only offer legitimate, authorized marketing services. Do not promise guaranteed engagement or exact delivery.
