# Role map (who can do what)

The system has **three** authentication roles: `admin`, `teacher`, and `student`. They are enforced on the API with Laravel middleware (`role:admin`, etc.) and mirrored in the frontend dashboards.

## Quick meaning (plain language)

- **`admin` (Administrator)**: sets up the school (users, school years, classes, curriculum) and can review/approve reports across the system.
- **`teacher` (Teacher)**: manages **their own classes only** (attendance sessions, announcements, and absence report reviews within their scope).
- **`student` (Student)**: sees **their own records only** (schedule, attendance history, announcements, and submitting absence reports).

## Backend route groups

| Prefix | Middleware | Controllers |
|--------|------------|-------------|
| `/api/admin/*` | `auth:sanctum`, `role:admin` | User/school/class management, exports, moderation, student invites, absence oversight |
| `/api/teacher/*` | `auth:sanctum`, `role:teacher` | Own classes only, attendance, sessions/QR, announcements, absence review for own scope |
| `/api/student/*` | `auth:sanctum`, `role:student` | Own attendance, absence reports, schedule, QR card, announcements read/comments |

Source: [BE/routes/api.php](BE/routes/api.php).

## Frontend

After login, [FE/assets/components/views.js](FE/assets/components/views.js) picks a dashboard by `role`:

- **Admin** → [FE/page/admin/dashboard.js](FE/page/admin/dashboard.js)
- **Teacher** → [FE/page/staff/dashboard.js](FE/page/staff/dashboard.js)
- **Student** → [FE/page/user/dashboard.js](FE/page/user/dashboard.js)

## Academic data vs roles

Programmes (e.g. IT, BSEd tracks), classes, subjects, and timetables are **data**, not separate login roles. Teachers are linked to class subjects via admin setup; students belong to a class via `StudentProfile`.

## QR payloads (for operators)

- **Attendance session:** `SARS_ATTENDANCE_SESSION:<token>` — issued when a teacher opens a session; student check-in posts this payload.
- **Student ID card:** `SARS_STUDENT:<qr_public_token>` — stable per student profile; PNG for the portal card is served at `GET /api/student/qr-image` (Bearer auth).
