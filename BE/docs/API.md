## Student Absence Report System (Backend API)

### Auth
- **Login**: `POST /api/auth/login`
  - body: `{ "email": "...", "password": "..." }`
  - returns: `{ token, user }`
- **Me**: `GET /api/auth/me` (Bearer token)
- **Logout**: `POST /api/auth/logout` (Bearer token)

### Bearer token usage
Send header: `Authorization: Bearer <token>`

### Health / integration status
- **Health**: `GET /api/health` (no auth)
  - Returns `ok` and `integrations` (mail driver, whether mail/SMS are configured for real delivery vs log-only).

### Seeded test accounts (after `php artisan migrate:fresh --seed`)
- Admin: `admin@example.com` / `password`
- Teacher: `teacher@example.com` / `password`
- Student: `student@example.com` / `password`

### Email + SMS notifications
- **Email**: uses Laravel notifications; default mailer is `log` (safe for local dev).
- **SMS**:
  - default: logs SMS to Laravel log
  - production: set Twilio env vars to send real SMS

Required `.env` for Twilio:
- `TWILIO_ACCOUNT_SID=...`
- `TWILIO_AUTH_TOKEN=...`
- `TWILIO_FROM=+1234567890`

### Roles
All routes below require auth. Most are role-gated.

### Admin (`role:admin`)
- Users: `GET/POST/PUT/DELETE /api/admin/users`
- Import/Export:
  - `GET /api/admin/users-export`
  - `POST /api/admin/users-import` (multipart: `file`)
- School years: `GET/POST/PUT/DELETE /api/admin/school-years`
  - set active: `POST /api/admin/school-years/{id}/set-active`
- Classes: `GET/POST/PUT/DELETE /api/admin/classes`
- Audit logs: `GET /api/admin/audit-logs`
- Absence oversight:
  - `GET /api/admin/absence-reports`
  - `GET /api/admin/absence-reports/{id}`
  - `POST /api/admin/absence-reports/{id}/approve`
  - `POST /api/admin/absence-reports/{id}/reject`
  - `GET /api/admin/absence-reports-export`
- Announcements moderation:
  - `GET /api/admin/announcements`
  - `DELETE /api/admin/announcements/{id}`
- Announcement comments moderation:
  - `GET /api/admin/announcement-comments`
  - `DELETE /api/admin/announcement-comments/{id}`

### Teacher (`role:teacher`)
- My classes: `GET /api/teacher/classes`
- Attendance (manual):
  - `POST /api/teacher/attendance/mark`
  - `GET /api/teacher/attendance?class_id=&attendance_date=`
- Attendance export:
  - `GET /api/teacher/attendance-export?class_id=&from=&to=`
- Attendance sessions (QR / Option B):
  - Open session: `POST /api/teacher/attendance-sessions`
  - Close: `POST /api/teacher/attendance-sessions/{id}/close`
  - QR image: `GET /api/teacher/attendance-sessions/{id}/qr?format=svg|png&size=320`
- Absence reviews:
  - `GET /api/teacher/absence-reports`
  - `POST /api/teacher/absence-reports/{id}/approve`
  - `POST /api/teacher/absence-reports/{id}/reject`
- Announcements:
  - `GET /api/teacher/announcements`
  - `POST /api/teacher/announcements`
  - `POST /api/teacher/announcements/{id}/publish`
  - `DELETE /api/teacher/announcements/{id}`
- Announcement comments moderation:
  - `GET /api/teacher/announcement-comments`
  - `POST /api/teacher/announcement-comments/{id}/hide`
  - `POST /api/teacher/announcement-comments/{id}/unhide`
  - `DELETE /api/teacher/announcement-comments/{id}`

### Student (`role:student`)
- **QR card (JSON payload)**: `GET /api/student/qr-card`
- **QR image (PNG, Bearer auth — use fetch + blob in SPA; not for public `<img src>`)**: `GET /api/student/qr-image?size=180`
- My attendance: `GET /api/student/attendance`
- Absence reports:
  - list: `GET /api/student/absence-reports`
  - submit: `POST /api/student/absence-reports` (supports multipart file uploads)
  - download attachment: `GET /api/student/absence-attachments/{id}`
- Attendance session check-in:
  - `POST /api/student/attendance-sessions/check-in`
  - body: `{ "qr_payload": "SARS_ATTENDANCE_SESSION:..." }`
- Announcements:
  - `GET /api/student/announcements` (published only)
  - `POST /api/student/announcements/{id}/read`
- Announcement comments (Q&A):
  - `GET /api/student/announcements/{id}/comments` (visible only)
  - `POST /api/student/announcements/{id}/comments`
  - `PUT /api/student/announcement-comments/{id}` (own only)
  - `DELETE /api/student/announcement-comments/{id}` (own only)

### Common status codes
- `200/201`: ok/created
- `401`: unauthenticated (missing/invalid token)
- `403`: forbidden (wrong role / ownership)
- `422`: validation/business rule failure
- `429`: throttled (rate limited)

