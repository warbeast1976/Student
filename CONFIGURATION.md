# Configuration checklist (SARS)

Use this with [USER_GUIDE.md](USER_GUIDE.md) for day-to-day usage. This file lists **environment variables** and how to verify integrations.

## Backend (`BE/.env`)

| Variable | Purpose |
|----------|---------|
| `APP_URL` | Public URL of the Laravel API (used for URL generation). |
| `FRONTEND_URL` | Base URL of the static frontend **without** a hash fragment, e.g. `http://127.0.0.1:5500` or `https://portal.school.edu`. Student invite emails append `#/setup-password?token=...`. Default in code: `http://127.0.0.1:5501/FE/index.html`. |
| `DB_*` | Database connection (SQLite is fine for local dev). |
| `MAIL_MAILER` | `log` or `array` = **no real email** (writes to log or discards). Use `smtp`, `ses`, `postmark`, etc. for production. |
| `MAIL_*` | SMTP or provider-specific settings when not using `log`. |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` | Optional. If **any** are missing, SMS is **not** sent via Twilio; messages are **logged** to `laravel.log` only. |
| `CORS_ALLOWED_ORIGINS` | Comma-separated allowed origins for the browser UI. Default `*` is permissive; **restrict in production**. |
| `QUEUE_CONNECTION` | Default `database`. Notifications are queued; run `php artisan queue:work` in production. |
| `FRONTEND_API_KEY` | Optional request gate checked against `X-API-Key`. Useful as an extra integration check, but not a true secret when used by browser code. |

## Frontend (browser runtime config)

| Mechanism | Purpose |
|-----------|---------|
| `window.__SARS_CONFIG__.apiBaseUrl` | API origin, **no trailing slash** (e.g. `http://127.0.0.1:8000`). Set in `FE/assets/config.js` (or templated at deploy time). |
| `window.__SARS_CONFIG__.apiKey` | Optional value sent as `X-API-Key` on requests. Keep empty if backend `FRONTEND_API_KEY` is not set. |

Set in `FE/assets/config.js`:

```js
window.__SARS_CONFIG__ = {
  apiBaseUrl: "http://127.0.0.1:8000",
  apiKey: ""
};
```

## Health check (integration hints)

`GET /api/health` returns:

- `ok: true`
- `integrations.mail_driver`, `integrations.mail_sends_real_email`
- `integrations.sms_mode` (`twilio` or `log`), `integrations.sms_sends_real_sms`
- Optional `mail_note` / `sms_note` when running in dev/log modes

Use this to confirm whether email and SMS are configured for **real delivery** or **logging only**.

## Queues

The project uses queued notifications. For production, run at least one worker:

```bash
php artisan queue:work --tries=3 --timeout=120
```
