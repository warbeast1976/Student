# Student Absence Report System — User Guide

This document explains what the system is, how the pieces fit together, and how to run it and use it day to day.

---

## What this system is

The **Student Absence Report System (SARS)** is a web application for schools to:

- Record and review **class attendance** (including live sessions with **QR check-in**).
- Submit and process **absence reports** when a student was marked absent (or similar) and needs an explained excuse with optional attachments.
- Publish **class announcements** and let students **read**, **comment**, and interact with them.
- Give **administrators** tools to manage **users**, **school years**, **classes**, monitor **audit logs**, and **export** data.

It is built as a **split stack**:

| Layer | Technology | Role |
|--------|------------|------|
| **Backend (API)** | Laravel (PHP) + Sanctum tokens | Business logic, database, permissions, REST API under `/api/...` |
| **Frontend (UI)** | Static HTML, CSS, and vanilla JavaScript modules | Login, dashboards, forms, charts—talks to the API over HTTPS/fetch |

There is **one shared login screen**. After you sign in, you see a **dashboard tailored to your role** (admin, teacher, or student). Navigation is organized as **tabs** (Home, Reports, Settings, etc., depending on role).

---

## Roles and what each can do

### Administrator

- **Home:** High-level stats, moderation snapshots, health checks, quick exports (users, absence reports), set **active school year**.
- **Reports:** Audit activity chart, export absence reports CSV, **approve** or **reject** absence reports (with optional remarks).
- **Settings:** Import users (CSV), create/delete users, manage school years and **classes** (optional **programme ID** and **year level**), reference **programmes/subjects**, **assign teachers to class subjects**, moderate announcements and comments.

### Teacher

- **Home:** **My subjects & schedule** (assignments and weekly slots), class overview, attendance session tools, manual attendance marks, announcement drafts, attendance CSV export (default-class/month shortcuts; configurable on the Reports tab).
- **Announcements:** List drafts and published items, **publish** or **delete** announcements, moderate **comments** (hide/unhide/delete), **approve** or **reject** student absence reports for your scope.
- **Reports:** Attendance statistics chart, filter by class and date range, export attendance, query attendance by class and date.

### Student

- **Home:** School **portal card** (programme, year, class, **student ID QR** for campus identification), **curriculum subject preview**, check-in using the teacher’s **attendance session QR** (paste or upload), **absence reports**, quick links.
- **Schedule:** **Weekly timetable** (day, time, subject, teacher, room) and full **subject list** for your programme and year level.
- **Attendance:** Trend chart and recent attendance list from the API.
- **Profile:** Mark announcements as read, **add / edit / delete** your own comments on announcements.

### Programmes and curriculum (all roles)

The database seeds **three four-year programmes**: **Information Technology**, **BSEd Mathematics**, and **BSEd Social Studies**, each with **year-level subject lists** inspired by common ICT and BSEd prospectuses. **Classes (sections)** link to a **programme** and **year level**; **teachers** are assigned to **subject instances** per class (admin UI: *Assign teacher to class subject*). Policy: each teacher may teach at most **three distinct subjects** per **school year** across all assignments. **Timetable slots** define day, time, room, subject, and teacher for each class.

---

## Prerequisites

- **PHP** (8.2+ recommended) and **Composer** for the backend.
- A **database** supported by Laravel (e.g. **MySQL**, **PostgreSQL**, or **SQLite** for simple local use).
- **Node.js is not required** for the frontend as shipped (static files); any static file server or opening `index.html` via a local server works.
- For realistic URLs and HTTPS, tools such as **Laravel Herd**, **Valet**, or `php artisan serve` plus a matching API base URL in the browser are typical.

---

## Setup tutorial (developers / IT)

### 1. Backend (Laravel)

From the `BE` folder:

1. Install dependencies:
   ```bash
   composer install
   ```
2. Copy the environment file and generate an app key:
   ```bash
   copy .env.example .env
   php artisan key:generate
   ```
3. Edit **`.env`**: set `DB_*` for your database, and `APP_URL` to the URL where the API will be served (e.g. `https://attendance.test` or `http://127.0.0.1:8000`).
4. Run migrations:
   ```bash
   php artisan migrate
   ```
5. (Optional but recommended for demos) Seed default roles, users, school year, **programmes, subjects, curriculum, timetables**, class, and profiles:
   ```bash
   php artisan db:seed
   ```
6. Start the API, for example:
   ```bash
   php artisan serve
   ```
   The API will be available at the host/port you configured (e.g. `http://127.0.0.1:8000`).

**Health check:** open `GET /api/health` — you should see JSON with `ok: true` plus an `integrations` object describing whether **mail** and **SMS** are configured for real delivery or dev-only logging. See [CONFIGURATION.md](CONFIGURATION.md) for all environment variables.

**CORS:** The API is configured so local frontends can call it; for production, set `CORS_ALLOWED_ORIGINS` in `.env` to your real frontend origins instead of `*`.

**Roles reference:** see [ROLE_MAP.md](ROLE_MAP.md) for how admin, teacher, and student permissions are organized.

### 2. Frontend (static site)

The `FE` folder contains `index.html`, `assets/`, and `page/`.

- Serve the folder with **any static server** (e.g. VS Code Live Server, `npx serve FE`, or your web server) so that modules load correctly (avoid `file://` if your browser blocks ES modules).

### 3. Point the browser at the API

The frontend now reads runtime settings from `window.__SARS_CONFIG__` in `FE/assets/config.js`.

Copy `FE/assets/config.example.js` to `FE/assets/config.js`, then set values (no trailing slash):

```js
window.__SARS_CONFIG__ = {
  apiBaseUrl: "http://127.0.0.1:8000",
  apiKey: "",
};
```

Optional: if backend `FRONTEND_API_KEY` is set, put the same value in `apiKey`. This is an integration gate only; browser-exposed values are not true secrets.

---

## Login tutorial (seeded demo accounts)

After `php artisan db:seed`, you can sign in with:

| Role    | Email               | Password  |
|---------|---------------------|-----------|
| Admin   | `admin@example.com` | `password` |
| Teacher | `teacher@example.com` | `password` |
| Teacher | `teacher.math@example.com` | `password` |
| Teacher | `teacher.social@example.com` | `password` |
| Student | `student@example.com` | `password` |

The seeded student is enrolled in **IT — Year 1 — A** with a populated timetable. Replace passwords in production and remove or rotate demo accounts.

**Flow:**

1. Open the frontend login page (hash router: `#/login`).
2. Enter email and password → **Login**.
3. On success you are redirected to **`#/dashboard`** and see the tab bar for your role.

If login fails, check: API is running, `window.__SARS_CONFIG__.apiBaseUrl` matches the API, database migrated, and user exists and is active.

---

## Using the UI (by role)

Below, **tabs** are the main navigation. Optional **buttons** on Home may jump to a section on the same tab or switch tabs; toasts and banners confirm actions.

### Administrator

1. **Home**
   - Review metrics and tables (users, pending absences, moderation queue).
   - Use quick actions to open **Reports** or **Settings** tabs (toasts say *Switched to the … tab*).
   - Export users or absence reports when buttons are available.
   - Choose a school year and **set active** if your workflow depends on an active year.

2. **Reports**
   - Inspect audit-related chart data when present.
   - Export absence reports CSV if needed.
   - Select a pending report, choose **approve** or **reject**, add remarks if required, submit.

3. **Settings**
   - **Users:** import CSV, create user, delete user (follow form labels).
   - **School years / classes:** create or delete as needed; assign teachers and metadata per your school policy.
   - **Content moderation:** remove announcements or comments by ID when necessary.

### Teacher

1. **Home**
   - **Open attendance session:** enter class, school year, date, duration → submit; note session ID and QR payload when returned.
   - **Manual attendance mark:** for a single student row (student ID, class, school year, date, status).
   - **Announcement draft:** class, title, body → creates a draft (you can continue on the **Announcements** tab).
   - **Quick export attendance:** uses a default class/month range; use **Reports** for filtered exports.

2. **Announcements**
   - Publish or delete drafts.
   - Act on **comments** (hide / unhide / delete) and on **absence reports** (approve / reject with optional remarks).

3. **Reports**
   - Set **class** and **date range**, apply filters to refresh the chart.
   - Export CSV using current filters.
   - Run **attendance query** (class + date) to fill the results table.

### Student

1. **Home**
   - **Check-in:** paste QR JSON/text or upload a small file as instructed by your teacher, then submit.
   - **Absence report:** pick an attendance record, enter a reason, attach files if allowed, submit.

2. **Attendance**
   - Adjust **month** filters and **Apply** to refresh chart and summary; scroll the recent list below.

3. **Profile**
   - Mark announcements as read.
   - Add a comment, or select your comment to **update** / **delete**.

**Theme:** use **Theme** in the top bar to toggle light/dark; preference is stored in the browser.

**Logout:** ends the session client-side and calls the API logout when a token is present.

---

## Troubleshooting (short)

| Issue | What to check |
|--------|----------------|
| “Cannot connect to API…” | API process running, correct `window.__SARS_CONFIG__.apiBaseUrl`, firewall / HTTPS mismatch. |
| 401 / session expired | Log in again; token cleared on unauthorized responses. |
| CORS errors in console | `CORS_ALLOWED_ORIGINS` and that you are not mixing wrong schemes (http vs https). |
| Empty charts or lists | User has no data yet; teacher/student must be linked to classes/attendance in DB. |
| Validation errors on forms | Laravel returns field errors; the UI surfaces the first message in toasts where applicable. |

---

## API overview (for integrators)

- **Auth:** `POST /api/auth/login` returns a **Bearer token**; send `Authorization: Bearer <token>` on protected routes.
- **Routes** are grouped under `/api/admin`, `/api/teacher`, and `/api/student` with middleware enforcing roles (see `BE/routes/api.php`).
- **Sanctum** protects authenticated JSON endpoints; rate limits apply on login and general API traffic per Laravel config.

For full route and payload details, inspect the Laravel routes file and the corresponding controllers in `BE/app/Http/Controllers/Api/`.

---

## Document version

This guide matches the project layout as of the **Student Absence Report System** repository (Laravel backend + vanilla JS frontend with tabbed dashboards). If you rename tabs or endpoints, update this file accordingly.
