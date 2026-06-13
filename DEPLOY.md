# Production deployment (SARS)

## Server requirements

- PHP 8.2+ with extensions Laravel 11 expects (mbstring, openssl, pdo, tokenizer, xml, ctype, json, bcmath, fileinfo).
- A web server (Nginx, Apache, or Caddy) pointing the document root at `BE/public`.
- **MySQL / PostgreSQL** (recommended) or SQLite for small installs. Set `DB_*` in `.env`; avoid SQLite on multi-worker PHP setups unless you know the trade-offs.
- A process supervisor for the queue (see below).

## Environment (`BE/.env`)

| Variable | Production guidance |
|----------|---------------------|
| `APP_ENV` | `production` |
| `APP_DEBUG` | `false` |
| `APP_KEY` | `php artisan key:generate` (never commit) |
| `APP_URL` | Public **https** URL of the API (e.g. `https://api.school.edu`) |
| `FRONTEND_URL` | Public **https** URL of the static portal (used in invite emails) |
| `FRONTEND_API_KEY` | **Required**: long random string; sent as `X-API-Key` from the browser config. |
| `CORS_ALLOWED_ORIGINS` | Comma-separated **https** origins (no `*` in production if you use credentials later). |
| `TRUSTED_PROXIES` | Behind a load balancer / TLS terminator: `*` or your proxy IPs (comma-separated). |
| `LOG_CHANNEL` / `LOG_LEVEL` | e.g. `stack`, `warning` or `error` |
| `SESSION_SECURE_COOKIE` | `true` when the app serves HTTPS (if you use session-based features). |
| `QUEUE_CONNECTION` | `database` or `redis`; run workers in production. |
| `MAIL_*` | Real mailer (`smtp`, `ses`, etc.) — not `log`. |
| `HEALTH_SHOW_INTEGRATIONS` | `false` (default in production) keeps `/api/health` minimal; set `true` only for internal monitoring. |
| `SANCTUM_STATEFUL_DOMAINS` | Your frontend host(s) if you use cookie auth; token-only SPA can leave defaults. |
| `SANCTUM_TOKEN_EXPIRATION` | Optional minutes until API tokens expire (e.g. `10080` for 7 days). |

After editing `.env` on the server:

```bash
cd BE
composer install --no-dev --optimize-autoloader
php artisan migrate --force
composer run production:optimize
```

## Queue worker

Notifications use the queue when `QUEUE_CONNECTION` is not `sync`. Run at least one worker under systemd, Supervisor, or your platform’s worker service:

```bash
php artisan queue:work --sleep=3 --tries=3 --max-time=3600
```

## HTTPS and reverse proxy

- Set `APP_URL` to `https://...` so generated URLs and `URL::forceScheme('https')` behave correctly.
- Set `TRUSTED_PROXIES` so Laravel trusts `X-Forwarded-Proto` / `X-Forwarded-For` from your proxy.

## Frontend static site

- Build or copy `FE/` to your CDN or static host.
- Set `window.__SARS_CONFIG__.apiBaseUrl` to the public API origin.
- Set `apiKey` to match `FRONTEND_API_KEY`.

## Post-deploy checks

- `GET /up` — Laravel default health (no DB).
- `GET /api/health` — app liveness (`ok`).
- Log in via the portal; confirm mail/SMS behavior matches `GET /api/health` when `HEALTH_SHOW_INTEGRATIONS=true` on a staging host.

## Rolling updates

```bash
composer run production:clear
php artisan migrate --force
composer run production:optimize
# restart php-fpm / queue workers
```
