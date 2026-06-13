import { api, fetchAuthenticatedBlobUrl, getSession, saveSession, download } from "../../assets/core/api.js";
import { escapeHtml } from "../../assets/core/dom-safe.js";
import { renderBarChart } from "../../assets/components/chart.js";
import { consumeUiFlash, rerenderView, setFormSubmitting, setInlineHint, setUiFlash } from "../../assets/components/form-ui.js";
import { sectionCard } from "../../assets/components/ui.js";

let teacherReportsRefreshId = null;
let quickMarkState = { classId: null, schoolYearId: null, attendanceDate: null, roster: [], marks: new Map() };
function listFrom(resp) {
  const payload = resp?.data ?? resp;
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function featureTabsHtml({ idPrefix, tabs }) {
  const nav = tabs
    .map(
      (tab, index) => `
      <button type="button" class="side-tabs-btn ${index === 0 ? "active" : ""}" data-feature-tab="${idPrefix}:${tab.id}" aria-selected="${index === 0 ? "true" : "false"}" role="tab">${escapeHtml(tab.label)}</button>
    `,
    )
    .join("");
  const panels = tabs
    .map(
      (tab, index) => `
      <section class="feature-tab-panel ${index === 0 ? "active" : ""}" data-feature-panel="${idPrefix}:${tab.id}" role="tabpanel">
        ${tab.content}
      </section>
    `,
    )
    .join("");
  return `
    <div class="side-tabs-layout" data-feature-tabs="${idPrefix}">
      <nav class="side-tabs-nav" role="tablist">${nav}</nav>
      <div class="side-tabs-panels feature-tab-content">${panels}</div>
    </div>
  `;
}

function calendarMonthDayRange(now = new Date()) {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  return { from: `${yyyy}-${mm}-01`, to: `${yyyy}-${mm}-31` };
}

async function runTeacherAttendanceCsvExport(toast, params) {
  const q = new URLSearchParams(params);
  try {
    await download(`/api/teacher/attendance-export?${q.toString()}`, "attendance-export.csv");
    toast?.("Attendance export downloaded.");
  } catch (err) {
    toast?.(err.message || "Unable to export attendance.", "error");
  }
}

const TEACHER_WEEKDAYS = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function jumpTo(selector, focusSelector) {
  const target = document.querySelector(selector);
  if (!target) return;
  target.scrollIntoView({ behavior: "smooth", block: "center" });
  target.classList.add("jump-highlight");
  window.setTimeout(() => target.classList.remove("jump-highlight"), 1200);
  if (focusSelector) {
    const field = document.querySelector(focusSelector);
    field?.focus();
  }
}


export async function teacherOverviewHtml() {
  let classes = [];
  let announcements = [];
  let comments = [];
  let absenceReports = [];
  let teaching = { subject_assignments: [], timetable_slots: [] };
  let qrCard = null;
  const warnings = [];
  const settled = await Promise.allSettled([
    api("/api/teacher/classes"),
    api("/api/teacher/announcements"),
    api("/api/teacher/announcement-comments"),
    api("/api/teacher/absence-reports"),
    api("/api/teacher/my-teaching"),
    api("/api/teacher/qr-card"),
  ]);
  const [cRes, aRes, coRes, rRes, tRes, qRes] = settled;
  if (cRes.status === "fulfilled") classes = listFrom(cRes.value);
  else warnings.push(`classes: ${cRes.reason?.message || "failed"}`);
  if (aRes.status === "fulfilled") announcements = listFrom(aRes.value);
  else warnings.push(`announcements: ${aRes.reason?.message || "failed"}`);
  if (coRes.status === "fulfilled") comments = listFrom(coRes.value);
  else warnings.push(`comments: ${coRes.reason?.message || "failed"}`);
  if (rRes.status === "fulfilled") absenceReports = listFrom(rRes.value);
  else warnings.push(`absence reports: ${rRes.reason?.message || "failed"}`);
  if (tRes.status === "fulfilled") teaching = tRes.value?.data || teaching;
  else warnings.push(`teaching schedule: ${tRes.reason?.message || "failed"}`);
  if (qRes.status === "fulfilled") qrCard = qRes.value?.data || null;
  else warnings.push(`teacher portal card: ${qRes.reason?.message || "failed"}`);
  const warning = warnings.length ? warnings.join(" · ") : "";
  const user = getSession()?.user || {};
  const tp = user.teacher_profile || user.teacherProfile || {};
  const teacherContact = tp.contact_number || "";
  const teacherName = user.full_name || user.name || qrCard?.full_name || "Teacher";
  const employeeId = qrCard?.employee_id || tp.employee_id || user.teacherProfile?.employee_id || user.employee_id || `EMP${user.id || "-"}`;
  const address = qrCard?.address || tp.address || user.teacherProfile?.address || "-";

  const drafts = announcements.filter((item) => String(item.status || "").toLowerCase() !== "published").length;
  const pendingReports = absenceReports.filter((item) => String(item.status || "").toLowerCase() === "pending").length;
  const recentTimeline = [
    ...absenceReports.slice(0, 4).map((item) => ({
      type: "Absence Report",
      message: `Report #${item.id || "-"} for ${item.student?.full_name || item.student?.name || "Student"}`,
      when: item.created_at || item.absent_date || "-",
      status: item.status || "pending",
    })),
    ...announcements.slice(0, 4).map((item) => ({
      type: "Announcement",
      message: item.title || `Announcement #${item.id || "-"}`,
      when: item.updated_at || item.created_at || "-",
      status: item.status || "draft",
    })),
  ].slice(0, 8);

  const classCards = classes.slice(0, 6).map((item) => {
    const classAnns = announcements.filter((a) => Number(a.class_id) === Number(item.id));
    const classDrafts = classAnns.filter((a) => String(a.status || "").toLowerCase() !== "published").length;
    return `
      <article class="card">
        <h3>${item.class_name || item.name || `Class #${item.id || "-"}`}</h3>
        <p class="muted">School Year: ${item.school_year?.name || item.school_year_id || "-"}</p>
        <div class="actions">
          <span class="badge">Announcements: ${classAnns.length}</span>
          <span class="badge ${classDrafts > 0 ? "warn" : "ok"}">Drafts: ${classDrafts}</span>
        </div>
      </article>
    `;
  }).join("");

  const assignRows = (teaching.subject_assignments || [])
    .slice(0, 16)
    .map(
      (a) => `
    <tr>
      <td>${a.subject?.name || "-"}</td>
      <td>${a.school_class?.class_name || "-"}</td>
      <td>${a.school_class?.program?.name || "—"}</td>
    </tr>`,
    )
    .join("");
  const slotRows = (teaching.timetable_slots || [])
    .slice(0, 24)
    .map(
      (s) => `
    <tr>
      <td>${TEACHER_WEEKDAYS[s.day_of_week] || s.day_of_week}</td>
      <td>${String(s.start_time || "").slice(0, 5)}–${String(s.end_time || "").slice(0, 5)}</td>
      <td>${s.subject?.name || "-"}</td>
      <td>${s.school_class?.class_name || "-"}</td>
      <td>${s.room || "—"}</td>
    </tr>`,
    )
    .join("");

  const workspaceContent = `
    <div class="grid two">
      ${sectionCard({
        title: "Teacher portal card",
        subtitle: "Your unique campus identity and QR",
        helpText: "Use your employee ID and QR for teacher-side attendance/identity checks.",
        body: `
          <div class="student-profile-meta"><span class="muted">Name</span><strong>${teacherName}</strong></div>
          <div class="student-profile-meta"><span class="muted">Role</span><strong>Teacher</strong></div>
          <div class="student-profile-meta"><span class="muted">Unique ID</span><strong>${employeeId}</strong></div>
          <div class="student-profile-meta"><span class="muted">Contact</span><strong>${teacherContact || "—"}</strong></div>
          <div class="student-profile-meta"><span class="muted">Address</span><strong>${address}</strong></div>
          ${
            qrCard?.qr_payload
              ? `<div id="teacher-portal-qr-host" data-needs-qr="true" style="margin-top:10px;text-align:center;">
                  <p class="muted" style="font-size:12px;">Loading teacher QR…</p>
                </div>
                <p class="muted" style="font-size:11px;margin-top:6px;">Teacher portal QR — keep private.</p>`
              : '<p class="muted" style="font-size:12px;">QR not available yet. Ask admin to complete your teacher profile.</p>'
          }
        `,
      })}
      ${sectionCard({
        title: "My account",
        subtitle: "Name, email, contact, password",
        helpText: "Employee ID is assigned by admin. Use this form to keep your portal details current.",
        body: `
          <form id="teacher-account-form" class="grid">
            <div class="row">
              <input class="input" name="first_name" placeholder="First name" value="${user.first_name || ""}" required />
              <input class="input" name="last_name" placeholder="Last name" value="${user.last_name || ""}" required />
            </div>
            <input class="input" name="email" type="email" placeholder="Email" value="${user.email || ""}" required />
            <input class="input" name="contact_number" placeholder="Contact number" value="${teacherContact}" />
            <textarea class="textarea" name="address" placeholder="Address">${tp.address || ""}</textarea>
            <p class="muted" style="margin:0;">Change password (optional)</p>
            <input class="input" name="current_password" type="password" autocomplete="current-password" placeholder="Current password (if changing)" />
            <input class="input" name="password" type="password" autocomplete="new-password" placeholder="New password (min 6)" />
            <p id="teacher-account-form-hint" class="muted"></p>
            <button class="btn btn-primary" type="submit">Save profile</button>
          </form>
        `,
      })}
    </div>
    ${sectionCard({
      title: "Teacher role scope",
      subtitle: "Simple CRUD scope (6 modules).",
      helpText: "Teacher workload is intentionally limited to class operations while admin controls master data.",
      body: `
        <div class="table-wrap">
          <table>
            <thead><tr><th>Teacher Module</th><th>Access</th></tr></thead>
            <tbody>
              <tr><td>Attendance sessions</td><td><span class="badge ok">Create · Read · Update · Close</span></td></tr>
              <tr><td>Attendance entries</td><td><span class="badge ok">Create · Read · Update</span></td></tr>
              <tr><td>Class announcements</td><td><span class="badge ok">Create · Read · Update · Delete · Publish</span></td></tr>
              <tr><td>Student remarks / report reviews</td><td><span class="badge ok">Create · Read · Update</span></td></tr>
              <tr><td>Comment moderation</td><td><span class="badge ok">Read · Update (hide/unhide) · Delete</span></td></tr>
              <tr><td>Class reports/export</td><td><span class="badge ok">Read · Export</span></td></tr>
            <tr><td>My profile / account</td><td><span class="badge ok">Read · Update</span></td></tr>
            </tbody>
          </table>
        </div>
      `,
    })}
    <div class="grid two">
      ${sectionCard({
        title: "Shortcuts",
        subtitle: "Common tasks",
        helpText: "",
        body: `
          <div class="actions">
            <button id="teacher-go-announcements-btn" class="btn btn-primary" type="button">Manage Announcements</button>
            <button id="teacher-go-reports-btn" class="btn btn-outline" type="button">Open Reports</button>
            <button id="teacher-quick-export-btn" class="btn btn-outline" type="button">Quick Export Attendance</button>
            <button id="teacher-jump-session-btn" class="btn btn-outline" type="button">Jump to Session Form</button>
          </div>
        `,
      })}
      ${sectionCard({
        title: "My subjects & schedule",
        subtitle: "Class subject assignments and your weekly timetable slots.",
        helpText: "This panel lists your assigned subjects and teaching schedule. If empty, ask admin to assign class-subject mappings.",
        body: `
          <p class="muted" style="margin-top:0;">You may teach up to three distinct subjects per school year (admin policy).</p>
          <h4 style="margin:12px 0 8px;">Assignments</h4>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Subject</th><th>Class</th><th>Programme</th></tr></thead>
              <tbody>
                ${assignRows || '<tr><td colspan="3" class="muted">No assignment rows.</td></tr>'}
              </tbody>
            </table>
          </div>
          <h4 style="margin:16px 0 8px;">Timetable</h4>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Day</th><th>Time</th><th>Subject</th><th>Class</th><th>Room</th></tr></thead>
              <tbody>
                ${slotRows || '<tr><td colspan="5" class="muted">No timetable rows.</td></tr>'}
              </tbody>
            </table>
          </div>
        `,
      })}
      ${sectionCard({
        title: "Class Snapshot",
        subtitle: "Recent classes currently assigned to you.",
        helpText: "These are your currently assigned classes. Use class IDs here when creating sessions and announcements.",
        body: `
          <div class="table-wrap">
            <table>
              <thead><tr><th>ID</th><th>Class</th><th>School Year</th></tr></thead>
              <tbody>
                ${classes.slice(0, 8).map((item) => `
                  <tr>
                    <td>${item.id ?? "-"}</td>
                    <td>${item.class_name || item.name || "-"}</td>
                    <td>${item.school_year?.name || item.school_year_id || "-"}</td>
                  </tr>
                `).join("") || '<tr><td colspan="3" class="muted">No classes found.</td></tr>'}
              </tbody>
            </table>
          </div>
        `,
      })}
    </div>
  `;

  const insightsContent = `
    ${sectionCard({
      title: "Per-Class Breakdown",
      subtitle: "Quick summary of class communication workload.",
      helpText: "Shows announcement and draft load per class to help prioritize what to publish first.",
      body: `
        <div class="grid two">
          ${classCards || '<article class="card"><p class="muted">No classes available for breakdown.</p></article>'}
        </div>
        <div class="actions" style="margin-top:10px;">
          <button id="teacher-open-class-tools-btn" class="btn btn-outline" type="button">Open Class Tools</button>
        </div>
      `,
    })}
    ${sectionCard({
      title: "Recent Activity Timeline",
      subtitle: "Latest teacher-side events from reports and announcements.",
      helpText: "A recent timeline of announcement/report activity so you can quickly spot pending tasks.",
      body: `
        <div class="table-wrap">
          <table>
            <thead><tr><th>Type</th><th>Details</th><th>When</th><th>Status</th></tr></thead>
            <tbody>
              ${recentTimeline.map((item) => `
                <tr>
                  <td>${item.type}</td>
                  <td>${item.message}</td>
                  <td>${item.when}</td>
                  <td><span class="badge ${String(item.status).toLowerCase().includes("pending") || String(item.status).toLowerCase().includes("draft") ? "warn" : "ok"}">${item.status}</span></td>
                </tr>
              `).join("") || '<tr><td colspan="4" class="muted">No recent timeline activity.</td></tr>'}
            </tbody>
          </table>
        </div>
      `,
    })}
  `;

  const actionsContent = `
    <div class="grid two">
      ${sectionCard({
        title: "Quick mark (roster)",
        subtitle: "Scan-friendly present/absent marking",
        helpText: "",
        body: `
          <form id="teacher-quick-mark-form" class="grid">
            <div class="row">
              <select class="select" name="class_id" required ${classes.length ? "" : "disabled"}>
                <option value="">Select class</option>
                ${classes.map((c) => `<option value="${c.id}">${c.class_name || "Class"}${c.section ? ` — Sec ${c.section}` : ""}</option>`).join("")}
              </select>
              <input class="input" name="attendance_date" type="date" required />
            </div>
            <div class="row">
              <input class="input" name="search" placeholder="Search student # or name" />
              <div class="actions" style="justify-content:flex-end;">
                <button id="teacher-quick-mark-load" class="btn btn-outline" type="submit">Load roster</button>
              </div>
            </div>
          </form>
          <div class="actions" style="margin-top:10px;">
            <button id="teacher-mark-all-present" class="btn btn-outline btn-sm" type="button" disabled>Mark all present</button>
            <button id="teacher-mark-all-absent" class="btn btn-outline btn-sm" type="button" disabled>Mark all absent</button>
            <button id="teacher-quick-submit" class="btn btn-primary" type="button" disabled>Submit</button>
          </div>
          <p id="teacher-quick-mark-hint" class="muted" style="margin:8px 0 0;"></p>
          <div id="teacher-quick-mark-table" class="table-wrap" style="margin-top:10px;max-height:420px;overflow:auto;"></div>
        `,
      })}
      ${sectionCard({
        title: "Open Attendance Session",
        helpText: "Create a live attendance window for a class. Share the session QR with students for check-in.",
        body: `
        <form id="open-session-form" class="grid">
          <div class="row">
            <input class="input" name="class_id" type="number" placeholder="Class ID" required />
            <input class="input" name="school_year_id" type="number" placeholder="School Year ID" required />
          </div>
          <p class="field-hint">Use the class and school year IDs assigned to you by admin.</p>
          <div class="row">
            <input class="input" name="attendance_date" type="date" required />
            <input class="input" name="duration_minutes" type="number" placeholder="Duration (minutes)" required />
          </div>
          <button class="btn btn-primary" type="submit">Open Session</button>
        </form>
        <div id="session-result" class="muted" style="margin-top:10px;">No active session yet.</div>
      `,
      })}
      ${sectionCard({
        title: "Manual Attendance Mark",
        helpText: "Use this when a student cannot check in by QR. Enter one student record at a time.",
        body: `
        <form id="teacher-mark-attendance-form" class="grid">
          <div class="row">
            <input class="input" name="student_id" type="number" placeholder="Student ID" required />
            <input class="input" name="class_id" type="number" placeholder="Class ID" required />
          </div>
          <p class="field-hint">Student ID must belong to the selected class.</p>
          <div class="row">
            <input class="input" name="school_year_id" type="number" placeholder="School Year ID" required />
            <input class="input" name="attendance_date" type="date" required />
            <select class="select" name="status">
              <option value="present">Present</option>
              <option value="late">Late</option>
              <option value="absent">Absent</option>
              <option value="excused">Excused</option>
            </select>
          </div>
          <button class="btn btn-primary" type="submit">Submit Mark</button>
        </form>
      `,
      })}
      ${sectionCard({
        title: "Create Announcement",
        helpText: "Draft announcements for a specific class. Publish later from the announcements tab.",
        body: `
        <form id="announce-form" class="grid">
          <input class="input" name="class_id" type="number" placeholder="Class ID" required />
          <p class="field-hint">This announcement will be visible to students in the selected class.</p>
          <input class="input" name="title" placeholder="Title" required />
          <textarea class="textarea" name="body" placeholder="Body" required></textarea>
          <button class="btn btn-primary" type="submit">Create Draft</button>
        </form>
        <div id="announcement-optimistic-list" class="grid" style="margin-top:12px;"></div>
      `,
      })}
    </div>
    ${sectionCard({
      title: "Export",
      helpText: "Downloads attendance data as CSV for your selected/default date range.",
      tools: `<button id="export-att-btn" class="btn btn-outline">Export Attendance CSV</button>`,
      body: `<p class="muted">Uses default query: class_id=1, current month range.</p>`,
    })}
  `;

  return `
    ${warning ? `<article class="card"><p class="muted">API Notice: ${warning}</p></article>` : ""}
    <div class="grid stats">
      <article class="card stat-card"><p class="muted stat-label">My Classes</p><div class="metric">${classes.length}</div></article>
      <article class="card stat-card"><p class="muted stat-label">Draft Announcements</p><div class="metric">${drafts}</div></article>
      <article class="card stat-card"><p class="muted stat-label">Pending Absence Reviews</p><div class="metric">${pendingReports}</div></article>
      <article class="card stat-card"><p class="muted stat-label">Comments Needing Review</p><div class="metric">${comments.length}</div></article>
    </div>
    ${featureTabsHtml({
      idPrefix: "teacher-overview",
      tabs: [
        { id: "workspace", label: "Overview", content: workspaceContent },
        { id: "insights", label: "Insights", content: insightsContent },
        { id: "actions", label: "Actions", content: actionsContent },
      ],
    })}
  `;
}

export function bindTeacherActions({ toast }) {
  document.getElementById("teacher-account-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    setInlineHint("teacher-account-form-hint", "");
    setFormSubmitting(form, true, "Saving...");
    try {
      const payload = {
        first_name: String(data.first_name || "").trim(),
        last_name: String(data.last_name || "").trim(),
        email: String(data.email || "").trim(),
        teacher_profile: {
          contact_number: String(data.contact_number || "").trim() || null,
          address: String(data.address || "").trim() || null,
        },
      };
      if (String(data.password || "").trim()) {
        payload.current_password = String(data.current_password || "");
        payload.password = String(data.password || "").trim();
      }
      const resp = await api("/api/auth/profile", { method: "PATCH", body: JSON.stringify(payload) });
      const nextUser = resp.user || resp.data?.user;
      if (nextUser) {
        const sess = getSession();
        saveSession({ ...sess, user: nextUser });
      }
      toast?.("Profile saved.");
      rerenderView("tools");
    } catch (err) {
      toast?.(err.message || "Unable to save profile.", "error");
    } finally {
      setFormSubmitting(form, false);
    }
  });

  const qrHost = document.getElementById("teacher-portal-qr-host");
  if (qrHost?.dataset.needsQr === "true") {
    (async () => {
      try {
        const blob = await fetchAuthenticatedBlobUrl("/api/teacher/qr-image?size=180", { accept: "image/png" });
        const url = URL.createObjectURL(blob);
        qrHost.innerHTML = "";
        const img = document.createElement("img");
        img.src = url;
        img.width = 180;
        img.height = 180;
        img.alt = "Teacher ID QR";
        img.style.borderRadius = "8px";
        img.style.border = "1px solid var(--border)";
        img.addEventListener("load", () => URL.revokeObjectURL(url), { once: true });
        qrHost.appendChild(img);
      } catch {
        qrHost.innerHTML =
          '<p class="muted" style="font-size:12px;">Could not load teacher QR image. Confirm API access and teacher profile setup.</p>';
      }
    })();
  }
  document.querySelectorAll("[data-feature-tabs='teacher-overview']").forEach((root) => {
    const buttons = Array.from(root.querySelectorAll("[data-feature-tab]"));
    const panels = Array.from(root.querySelectorAll("[data-feature-panel]"));
    const activate = (key) => {
      buttons.forEach((btn) => {
        const on = btn.getAttribute("data-feature-tab") === key;
        btn.classList.toggle("active", on);
        btn.setAttribute("aria-selected", on ? "true" : "false");
      });
      panels.forEach((panel) => {
        panel.classList.toggle("active", panel.getAttribute("data-feature-panel") === key);
      });
    };
    buttons.forEach((btn) => btn.addEventListener("click", () => activate(btn.getAttribute("data-feature-tab"))));
  });
  document.querySelectorAll("[data-feature-tabs='teacher-announcements']").forEach((root) => {
    const buttons = Array.from(root.querySelectorAll("[data-feature-tab]"));
    const panels = Array.from(root.querySelectorAll("[data-feature-panel]"));
    const activate = (key) => {
      buttons.forEach((btn) => {
        const on = btn.getAttribute("data-feature-tab") === key;
        btn.classList.toggle("active", on);
        btn.setAttribute("aria-selected", on ? "true" : "false");
      });
      panels.forEach((panel) => {
        panel.classList.toggle("active", panel.getAttribute("data-feature-panel") === key);
      });
    };
    buttons.forEach((btn) => btn.addEventListener("click", () => activate(btn.getAttribute("data-feature-tab"))));
  });

  document.getElementById("teacher-go-announcements-btn")?.addEventListener("click", () => {
    rerenderView("announcements");
    toast?.("Switched to the Announcements tab.");
  });
  document.getElementById("teacher-go-reports-btn")?.addEventListener("click", () => {
    rerenderView("reports");
    toast?.("Switched to the Reports tab.");
  });
  document.getElementById("teacher-jump-session-btn")?.addEventListener("click", () => {
    jumpTo("#open-session-form", '#open-session-form input[name="class_id"]');
    toast?.("Jumped to Session Form.");
  });
  document.getElementById("teacher-open-class-tools-btn")?.addEventListener("click", () => {
    jumpTo("#teacher-mark-attendance-form", '#teacher-mark-attendance-form input[name="student_id"]');
    toast?.("Jumped to Class Tools.");
  });
  document.getElementById("teacher-quick-export-btn")?.addEventListener("click", async () => {
    const { from, to } = calendarMonthDayRange();
    await runTeacherAttendanceCsvExport(toast, { class_id: "1", from, to });
  });

  const openForm = document.getElementById("open-session-form");
  openForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(openForm).entries());
    setFormSubmitting(openForm, true, "Opening...");

    try {
      const result = await api("/api/teacher/attendance-sessions", {
        method: "POST",
        body: JSON.stringify({
          class_id: Number(data.class_id),
          school_year_id: Number(data.school_year_id),
          attendance_date: data.attendance_date,
          duration_minutes: Number(data.duration_minutes),
        }),
      });

      const session = result.data || result;
      document.getElementById("session-result").innerHTML = `
        <p><b>Session ID:</b> ${escapeHtml(String(session.id ?? "-"))}</p>
        <p><b>QR Payload:</b> ${escapeHtml(String(session.qr_payload ?? "-"))}</p>
      `;
      toast("Attendance session opened successfully.");
    } catch (err) {
      toast(err.message || "Unable to open attendance session.", "error");
    } finally {
      setFormSubmitting(openForm, false);
    }
  });

  const markForm = document.getElementById("teacher-mark-attendance-form");
  markForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(markForm).entries());
    setFormSubmitting(markForm, true, "Submitting...");
    try {
      await api("/api/teacher/attendance/mark", {
        method: "POST",
        body: JSON.stringify({
          class_id: Number(data.class_id),
          school_year_id: Number(data.school_year_id),
          attendance_date: data.attendance_date,
          records: [
            {
              student_id: Number(data.student_id),
              status: data.status,
            },
          ],
        }),
      });
      toast("Attendance marked successfully.");
    } catch (err) {
      toast(err.message || "Unable to mark attendance.", "error");
    } finally {
      setFormSubmitting(markForm, false);
    }
  });

  const announceForm = document.getElementById("announce-form");
  announceForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(announceForm).entries());
    const listRoot = document.getElementById("announcement-optimistic-list");
    const optimisticId = `ann-${Date.now()}`;
    if (listRoot) {
      const row = document.createElement("div");
      row.className = "card";
      row.id = optimisticId;
      row.innerHTML = `
        <div class="actions" style="justify-content:space-between;">
          <strong>${escapeHtml(String(data.title || ""))}</strong>
          <span class="badge pending">Sending...</span>
        </div>
        <p class="muted">${escapeHtml(String(data.body || ""))}</p>
      `;
      listRoot.prepend(row);
    }
    setFormSubmitting(announceForm, true, "Saving...");
    try {
      const created = await api("/api/teacher/announcements", {
        method: "POST",
        body: JSON.stringify({
          class_id: Number(data.class_id),
          title: data.title,
          body: data.body,
        }),
      });
      announceForm.reset();
      const row = document.getElementById(optimisticId);
      if (row) {
        const badge = row.querySelector(".badge");
        if (badge) {
          badge.textContent = "Saved";
          badge.className = "badge ok";
        }
      }
      toast("Announcement draft created successfully.");
      setUiFlash("teacher", {
        view: "announcements",
        message: "Announcement draft created successfully.",
        announcementId: created?.data?.id,
      });
      rerenderView("announcements");
    } catch (err) {
      document.getElementById(optimisticId)?.remove();
      toast(err.message || "Unable to create announcement draft.", "error");
    } finally {
      setFormSubmitting(announceForm, false);
    }
  });

  const exportBtn = document.getElementById("export-att-btn");
  exportBtn?.addEventListener("click", async () => {
    const { from, to } = calendarMonthDayRange();
    await runTeacherAttendanceCsvExport(toast, { class_id: "1", from, to });
  });

  document.getElementById("teacher-publish-announcement-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    setInlineHint("teacher-publish-hint", "");
    if (!Number(data.announcement_id)) {
      setInlineHint("teacher-publish-hint", "Select an announcement first.");
      toast("Select an announcement first.", "error");
      return;
    }
    setFormSubmitting(e.currentTarget, true, "Publishing...");
    try {
      await api(`/api/teacher/announcements/${data.announcement_id}/publish`, { method: "POST" });
      toast("Announcement published successfully.");
      setUiFlash("teacher", {
        view: "announcements",
        message: "Announcement published successfully.",
        announcementId: Number(data.announcement_id),
      });
      rerenderView("announcements");
    } catch (err) {
      toast(err.message || "Unable to publish announcement.", "error");
    } finally {
      setFormSubmitting(e.currentTarget, false);
    }
  });

  document.getElementById("teacher-delete-announcement-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    setInlineHint("teacher-delete-announcement-hint", "");
    if (!Number(data.announcement_id)) {
      setInlineHint("teacher-delete-announcement-hint", "Select an announcement first.");
      toast("Select an announcement first.", "error");
      return;
    }
    setFormSubmitting(e.currentTarget, true, "Deleting...");
    try {
      await api(`/api/teacher/announcements/${data.announcement_id}`, { method: "DELETE" });
      toast("Announcement deleted successfully.");
      setUiFlash("teacher", { view: "announcements", message: "Announcement deleted successfully." });
      rerenderView("announcements");
    } catch (err) {
      toast(err.message || "Unable to delete announcement.", "error");
    } finally {
      setFormSubmitting(e.currentTarget, false);
    }
  });

  document.getElementById("teacher-comment-action-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    setInlineHint("teacher-comment-action-hint", "");
    if (!Number(data.comment_id)) {
      setInlineHint("teacher-comment-action-hint", "Select a comment first.");
      toast("Select a comment first.", "error");
      return;
    }
    const action = data.action;
    const id = data.comment_id;
    const endpoint = action === "delete" ? `/api/teacher/announcement-comments/${id}` : `/api/teacher/announcement-comments/${id}/${action}`;
    const method = action === "delete" ? "DELETE" : "POST";
    setFormSubmitting(e.currentTarget, true, "Applying...");
    try {
      await api(endpoint, { method });
      toast("Comment action applied successfully.");
      setUiFlash("teacher", {
        view: "announcements",
        message: "Comment action applied successfully.",
        commentId: Number(id),
      });
      rerenderView("announcements");
    } catch (err) {
      toast(err.message || "Unable to apply comment action.", "error");
    } finally {
      setFormSubmitting(e.currentTarget, false);
    }
  });

  document.getElementById("teacher-absence-action-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    setInlineHint("teacher-absence-action-hint", "");
    if (!Number(data.absence_report_id)) {
      setInlineHint("teacher-absence-action-hint", "Select an absence report first.");
      toast("Select an absence report first.", "error");
      return;
    }
    setFormSubmitting(e.currentTarget, true, "Applying...");
    try {
      await api(`/api/teacher/absence-reports/${data.absence_report_id}/${data.decision}`, {
        method: "POST",
        body: JSON.stringify(data.reason ? { admin_remarks: data.reason } : {}),
      });
      const absenceResult = data.decision === "reject" ? "rejected" : "approved";
      toast(`Absence report ${absenceResult} successfully.`);
      setUiFlash("teacher", {
        view: "announcements",
        message: `Absence report ${absenceResult} successfully.`,
        absenceReportId: Number(data.absence_report_id),
      });
      rerenderView("announcements");
    } catch (err) {
      toast(err.message || "Unable to apply absence report action.", "error");
    } finally {
      setFormSubmitting(e.currentTarget, false);
    }
  });

  document.getElementById("teacher-session-action-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    setFormSubmitting(e.currentTarget, true, "Running...");
    try {
      if (data.session_action === "close") {
        await api(`/api/teacher/attendance-sessions/${data.session_id}/close`, { method: "POST" });
        toast("Session closed successfully.");
      } else {
        const res = await api(`/api/teacher/attendance-sessions/${data.session_id}/qr`);
        const payload = res.data?.qr_payload || res.qr_payload || JSON.stringify(res.data || res);
        document.getElementById("teacher-session-action-result").textContent = payload;
        toast("QR payload loaded successfully.");
      }
    } catch (err) {
      toast(err.message || "Unable to run session action.", "error");
    } finally {
      setFormSubmitting(e.currentTarget, false);
    }
  });

  // Quick mark (roster)
  const quickForm = document.getElementById("teacher-quick-mark-form");
  const tableWrap = document.getElementById("teacher-quick-mark-table");
  const hintEl = document.getElementById("teacher-quick-mark-hint");
  const submitBtn = document.getElementById("teacher-quick-submit");
  const allPresentBtn = document.getElementById("teacher-mark-all-present");
  const allAbsentBtn = document.getElementById("teacher-mark-all-absent");

  const todayIso = new Date().toISOString().slice(0, 10);
  const dateInput = quickForm?.querySelector('input[name="attendance_date"]');
  if (dateInput && !dateInput.value) dateInput.value = todayIso;

  function setHint(msg) {
    if (hintEl) hintEl.textContent = msg || "";
  }

  function currentFilterText() {
    const v = quickForm?.querySelector('input[name="search"]')?.value || "";
    return String(v).trim().toLowerCase();
  }

  function renderRosterTable() {
    if (!tableWrap) return;
    const q = currentFilterText();
    const rows = (quickMarkState.roster || []).filter((r) => {
      if (!q) return true;
      const name = String(r.full_name || "").toLowerCase();
      const num = String(r.student_number || "").toLowerCase();
      return name.includes(q) || num.includes(q);
    });

    const body = rows
      .map((r) => {
        const status = quickMarkState.marks.get(Number(r.student_id)) || "present";
        const isP = status === "present";
        const isA = status === "absent";
        return `
          <tr data-student-row="${r.student_id}">
            <td style="white-space:nowrap;"><strong>${escapeHtml(String(r.student_number || `#${r.student_id}`))}</strong></td>
            <td>${escapeHtml(String(r.full_name || "-"))}</td>
            <td style="text-align:right;white-space:nowrap;">
              <button type="button" class="btn btn-sm ${isP ? "btn-primary" : "btn-outline"}" data-mark="${r.student_id}:present">Present</button>
              <button type="button" class="btn btn-sm ${isA ? "btn-danger" : "btn-outline"}" data-mark="${r.student_id}:absent">Absent</button>
            </td>
          </tr>
        `;
      })
      .join("");

    tableWrap.innerHTML = `
      <table>
        <thead><tr><th>Student #</th><th>Name</th><th style="text-align:right;">Mark</th></tr></thead>
        <tbody>${body || `<tr><td colspan="3" class="muted">No students match your search.</td></tr>`}</tbody>
      </table>
    `;

    const total = quickMarkState.roster.length || 0;
    const absent = Array.from(quickMarkState.marks.values()).filter((s) => s === "absent").length;
    setHint(total ? `${total} students loaded · ${absent} absent` : "");
  }

  function enableQuickControls(on) {
    if (submitBtn) submitBtn.disabled = !on;
    if (allPresentBtn) allPresentBtn.disabled = !on;
    if (allAbsentBtn) allAbsentBtn.disabled = !on;
  }

  quickForm?.querySelector('input[name="search"]')?.addEventListener("input", renderRosterTable);

  quickForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    setHint("");
    if (!quickForm) return;
    const formData = Object.fromEntries(new FormData(quickForm).entries());
    const classId = Number(formData.class_id);
    const attendanceDate = String(formData.attendance_date || "").trim();
    if (!classId || !attendanceDate) {
      toast?.("Select class and date first.", "error");
      return;
    }
    setFormSubmitting(quickForm, true, "Loading...");
    enableQuickControls(false);
    try {
      const rosterRes = await api(`/api/teacher/classes/${classId}/roster`);
      const roster = listFrom(rosterRes);
      const schoolYearId = Number(rosterRes?.meta?.school_year_id || 0);
      quickMarkState = {
        classId,
        schoolYearId,
        attendanceDate,
        roster,
        marks: new Map(roster.map((r) => [Number(r.student_id), "present"])),
      };
      if (!schoolYearId) {
        setHint("Roster loaded, but school year is missing. Contact admin.");
      }
      renderRosterTable();
      enableQuickControls(true);
      toast?.("Roster loaded.");
    } catch (err) {
      toast?.(err.message || "Unable to load roster.", "error");
      setHint(err.message || "Unable to load roster.");
    } finally {
      setFormSubmitting(quickForm, false);
    }
  });

  tableWrap?.addEventListener("click", (e) => {
    const btn = e.target?.closest?.("[data-mark]");
    if (!btn) return;
    const raw = String(btn.getAttribute("data-mark") || "");
    const [idStr, status] = raw.split(":");
    const sid = Number(idStr);
    if (!sid || !status) return;
    quickMarkState.marks.set(sid, status);
    renderRosterTable();
  });

  allPresentBtn?.addEventListener("click", () => {
    quickMarkState.roster.forEach((r) => quickMarkState.marks.set(Number(r.student_id), "present"));
    renderRosterTable();
  });

  allAbsentBtn?.addEventListener("click", () => {
    quickMarkState.roster.forEach((r) => quickMarkState.marks.set(Number(r.student_id), "absent"));
    renderRosterTable();
  });

  submitBtn?.addEventListener("click", async () => {
    if (!quickMarkState.classId || !quickMarkState.schoolYearId || !quickMarkState.attendanceDate) {
      toast?.("Load a roster first.", "error");
      return;
    }
    const records = quickMarkState.roster.map((r) => ({
      student_id: Number(r.student_id),
      status: quickMarkState.marks.get(Number(r.student_id)) || "present",
    }));
    if (!records.length) {
      toast?.("No students loaded.", "error");
      return;
    }
    setFormSubmitting(quickForm, true, "Submitting...");
    try {
      await api("/api/teacher/attendance/mark", {
        method: "POST",
        body: JSON.stringify({
          class_id: quickMarkState.classId,
          school_year_id: quickMarkState.schoolYearId,
          attendance_date: quickMarkState.attendanceDate,
          records,
        }),
      });
      toast?.("Attendance saved.");
      setHint("Attendance saved.");
    } catch (err) {
      toast?.(err.message || "Unable to save attendance.", "error");
      setHint(err.message || "Unable to save attendance.");
    } finally {
      setFormSubmitting(quickForm, false);
    }
  });
}

export async function teacherAnnouncementsHtml() {
  let announcements = [];
  let comments = [];
  let absenceReports = [];
  try {
    const [a, c, r] = await Promise.all([
      api("/api/teacher/announcements"),
      api("/api/teacher/announcement-comments"),
      api("/api/teacher/absence-reports"),
    ]);
    announcements = listFrom(a);
    comments = listFrom(c);
    absenceReports = listFrom(r);
  } catch {
    announcements = [];
    comments = [];
    absenceReports = [];
  }
  const flash = consumeUiFlash("teacher");
  const highlightAnnouncementId = Number(flash?.announcementId);
  const highlightCommentId = Number(flash?.commentId);
  const highlightAbsenceId = Number(flash?.absenceReportId);

  const createContent = `
    ${sectionCard({
      title: "Create Announcement",
      helpText: "Create a class announcement draft. Drafts are visible to you until published.",
      body: `
      ${flash?.message ? `<p class="badge ok" style="margin-bottom:8px;">${flash.message}</p>` : ""}
      <form id="announce-form" class="grid">
        <input class="input" name="class_id" type="number" placeholder="Class ID" required />
        <input class="input" name="title" placeholder="Title" required />
        <textarea class="textarea" name="body" placeholder="Body" required></textarea>
        <button class="btn btn-primary" type="submit">Create Draft</button>
      </form>
      <div id="announcement-optimistic-list" class="grid" style="margin-top:12px;"></div>
    `,
    })}
  `;

  const announcementsContent = `
    ${sectionCard({
      title: "Announcement Actions",
      helpText: "Publish or delete existing announcements and review their statuses.",
      body: `
        <form id="teacher-publish-announcement-form" class="row">
          <select class="input" name="announcement_id" required ${announcements.length ? "" : "disabled"}>
            <option value="">Select an announcement</option>
            ${announcements.map((item) => `<option value="${item.id}">#${item.id} - ${item.title || "Untitled"}</option>`).join("")}
          </select>
          <button class="btn btn-primary" type="submit">Publish</button>
        </form>
        <p id="teacher-publish-hint" class="muted"></p>
        <form id="teacher-delete-announcement-form" class="row" style="margin-top:10px;">
          <select class="input" name="announcement_id" required ${announcements.length ? "" : "disabled"}>
            <option value="">Select an announcement</option>
            ${announcements.map((item) => `<option value="${item.id}">#${item.id} - ${item.title || "Untitled"}</option>`).join("")}
          </select>
          <button class="btn btn-danger" type="submit">Delete</button>
        </form>
        <p id="teacher-delete-announcement-hint" class="muted"></p>
        <div class="table-wrap" style="margin-top:10px;">
          <table>
            <thead><tr><th>ID</th><th>Title</th><th>Status</th></tr></thead>
            <tbody>${announcements.slice(0, 10).map((item) => `<tr style="${Number(item.id) === highlightAnnouncementId ? "background:var(--brand-soft);" : ""}"><td>${item.id ?? "-"}</td><td>${item.title || "-"}</td><td>${item.status || "-"}</td></tr>`).join("")}</tbody>
          </table>
        </div>
      `,
    })}
  `;

  const moderationContent = `
    ${sectionCard({
      title: "Comment Moderation",
      helpText: "Hide, unhide, or delete announcement comments to keep class discussions appropriate.",
      body: `
        <form id="teacher-comment-action-form" class="grid">
          <div class="row">
            <select class="input" name="comment_id" required ${comments.length ? "" : "disabled"}>
              <option value="">Select a comment</option>
              ${comments.map((item) => `<option value="${item.id}">#${item.id} - ${(item.body || "").slice(0, 40)}</option>`).join("")}
            </select>
            <select class="select" name="action">
              <option value="hide">Hide</option>
              <option value="unhide">Unhide</option>
              <option value="delete">Delete</option>
            </select>
          </div>
          <button class="btn btn-primary" type="submit">Apply</button>
        </form>
        <p id="teacher-comment-action-hint" class="muted"></p>
        <div class="table-wrap" style="margin-top:10px;">
          <table>
            <thead><tr><th>ID</th><th>Announcement</th><th>Comment</th></tr></thead>
            <tbody>${comments.slice(0, 10).map((item) => `<tr style="${Number(item.id) === highlightCommentId ? "background:var(--brand-soft);" : ""}"><td>${item.id ?? "-"}</td><td>${item.class_announcement_id || item.announcement_id || "-"}</td><td>${item.body || "-"}</td></tr>`).join("")}</tbody>
          </table>
        </div>
      `,
    })}
  `;

  const absenceContent = `
    ${sectionCard({
      title: "Absence Review",
      helpText: "Approve or reject student absence reports after validating reasons and attachments.",
      body: `
      <form id="teacher-absence-action-form" class="row">
        <select class="input" name="absence_report_id" required ${absenceReports.length ? "" : "disabled"}>
          <option value="">Select an absence report</option>
          ${absenceReports.map((item) => `<option value="${item.id}">#${item.id} - ${item.student?.full_name || item.student?.name || item.student_id || "Student"}</option>`).join("")}
        </select>
        <select class="select" name="decision">
          <option value="approve">Approve</option>
          <option value="reject">Reject</option>
        </select>
        <input class="input" name="reason" placeholder="Reason (optional)" />
        <button class="btn btn-primary" type="submit">Apply</button>
      </form>
      <p id="teacher-absence-action-hint" class="muted"></p>
      <div class="table-wrap" style="margin-top:10px;">
        <table>
          <thead><tr><th>ID</th><th>Student</th><th>Status</th></tr></thead>
          <tbody>${absenceReports.slice(0, 10).map((item) => `<tr style="${Number(item.id) === highlightAbsenceId ? "background:var(--brand-soft);" : ""}"><td>${item.id ?? "-"}</td><td>${item.student?.full_name || item.student?.name || item.student_id || "-"}</td><td>${item.status || "-"}</td></tr>`).join("")}</tbody>
        </table>
      </div>
    `,
    })}
  `;

  return `
    ${featureTabsHtml({
      idPrefix: "teacher-announcements",
      tabs: [
        { id: "create", label: "Create", content: createContent },
        { id: "announcements", label: "Announcements", content: announcementsContent },
        { id: "moderation", label: "Comment Moderation", content: moderationContent },
        { id: "absence", label: "Absence Review", content: absenceContent },
      ],
    })}
  `;
}

export async function teacherReportsHtml() {
  const today = new Date();
  const to = today.toISOString().slice(0, 10);
  const fromDate = new Date(today);
  fromDate.setDate(today.getDate() - 6);
  const from = fromDate.toISOString().slice(0, 10);

  return `
    <article class="card">
      <h3>Weekly Attendance Trend</h3>
      <p class="muted">Powered by /api/teacher/dashboard-stats</p>
      <div class="row" style="margin-bottom:12px;">
        <select id="teacher-filter-class" class="select">
          <option value="">All Classes</option>
        </select>
        <button id="teacher-filter-apply" class="btn btn-primary" type="button">Apply Filter</button>
      </div>
      <div class="row" style="margin-bottom:12px;">
        <input id="teacher-filter-from" class="input" type="date" value="${from}" />
        <input id="teacher-filter-to" class="input" type="date" value="${to}" />
      </div>
      <div style="height:260px;">
        <canvas id="teacher-weekly-chart"></canvas>
      </div>
      <div id="teacher-stat-badges" class="actions" style="margin-top:12px;"></div>
      <div id="teacher-risk-list" class="table-wrap" style="margin-top:12px;"></div>
      <div class="actions" style="margin-top:20px;">
        <button id="export-att-btn" class="btn btn-outline">Export Attendance CSV</button>
      </div>
      <form id="teacher-attendance-query-form" class="row" style="margin-top:12px;">
        <input class="input" name="class_id" type="number" placeholder="Class ID" required />
        <input class="input" name="attendance_date" type="date" />
        <input class="input" name="from" type="date" />
        <input class="input" name="to" type="date" />
        <select class="select" name="status">
          <option value="">Any status</option>
          <option value="present">Present</option>
          <option value="late">Late</option>
          <option value="absent">Absent</option>
          <option value="excused">Excused</option>
        </select>
        <input class="input" name="search" placeholder="Search name or student #" />
        <button class="btn btn-outline" type="submit">Load Attendance</button>
      </form>
      <div class="table-wrap" style="margin-top:10px;">
        <table>
          <thead><tr><th>Student</th><th>Status</th><th>Remarks</th></tr></thead>
          <tbody id="teacher-attendance-query-results"></tbody>
        </table>
      </div>
      <div class="actions" style="margin-top:12px;">
        <form id="teacher-session-action-form" class="row">
          <input class="input" type="number" name="session_id" placeholder="Session ID" required />
          <select class="select" name="session_action">
            <option value="qr">Get QR</option>
            <option value="close">Close Session</option>
          </select>
          <button class="btn btn-primary" type="submit">Run</button>
        </form>
      </div>
      <p id="teacher-session-action-result" class="muted"></p>
    </article>
  `;
}

export async function bindTeacherReportChart({ toast } = {}) {
  if (teacherReportsRefreshId) {
    clearInterval(teacherReportsRefreshId);
    teacherReportsRefreshId = null;
  }

  const classSelect = document.getElementById("teacher-filter-class");
  const fromInput = document.getElementById("teacher-filter-from");
  const toInput = document.getElementById("teacher-filter-to");
  const applyBtn = document.getElementById("teacher-filter-apply");

  try {
    const classesResp = await api("/api/teacher/classes");
    const classes = classesResp.data || [];
    classSelect.innerHTML = `
      <option value="">All Classes</option>
      ${classes.map((c) => `<option value="${escapeHtml(String(c.id))}">${escapeHtml(String(c.class_name || `Class ${c.id}`))}</option>`).join("")}
    `;
  } catch (err) {
    // Keep default class option when classes endpoint is unavailable.
  }

  const loadChart = async () => {
    let labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    let values = [0, 0, 0, 0, 0, 0, 0];
    let label = "Attendance records";
    let statusCounts = null;
    let atRiskStudents = [];

    const params = new URLSearchParams();
    if (classSelect?.value) params.set("class_id", classSelect.value);
    if (fromInput?.value) params.set("from", fromInput.value);
    if (toInput?.value) params.set("to", toInput.value);

    try {
      const stats = await api(`/api/teacher/dashboard-stats?${params.toString()}`);
      const chart = stats.data?.chart;
      if (Array.isArray(chart?.labels) && Array.isArray(chart?.values)) {
        labels = chart.labels;
        values = chart.values;
        label = chart.label || label;
      }
      statusCounts = stats.data?.status_counts || null;
      atRiskStudents = Array.isArray(stats.data?.at_risk_students) ? stats.data.at_risk_students : [];
    } catch (err) {
      toast?.(err.message || "Unable to load teacher statistics.", "error");
    }

    renderBarChart({
      id: "teacher-weekly-chart",
      labels,
      values,
      label,
    });

    const badges = document.getElementById("teacher-stat-badges");
    if (badges && statusCounts) {
      badges.innerHTML = `
        <span class="badge ok">Present: ${statusCounts.present ?? 0}</span>
        <span class="badge warn">Late: ${statusCounts.late ?? 0}</span>
        <span class="badge">Absent: ${statusCounts.absent ?? 0}</span>
        <span class="badge">Excused: ${statusCounts.excused ?? 0}</span>
      `;
    }

    const riskRoot = document.getElementById("teacher-risk-list");
    if (riskRoot) {
      riskRoot.innerHTML = `
        <table>
          <thead><tr><th>At-risk student</th><th>Recent Absences</th><th>Consecutive</th><th>Risk</th></tr></thead>
          <tbody>
            ${
              atRiskStudents.map((s) => `
                <tr>
                  <td>${escapeHtml(String(s.student_name || "-"))} ${s.student_number ? `<span class="muted">(${escapeHtml(String(s.student_number))})</span>` : ""}</td>
                  <td>${escapeHtml(String(s.recent_absences ?? 0))}</td>
                  <td>${escapeHtml(String(s.consecutive_absences ?? 0))}</td>
                  <td><span class="badge ${s.risk_level === "high" ? "warn" : ""}">${escapeHtml(`${s.risk_level || "low"} (${s.risk_score ?? 0})`)}</span></td>
                </tr>
              `).join("") || '<tr><td colspan="4" class="muted">No at-risk students for this range.</td></tr>'
            }
          </tbody>
        </table>
      `;
    }
  };

  applyBtn?.addEventListener("click", loadChart);
  await loadChart();

  teacherReportsRefreshId = setInterval(() => {
    if (!document.getElementById("teacher-weekly-chart")) {
      clearInterval(teacherReportsRefreshId);
      teacherReportsRefreshId = null;
      return;
    }
    loadChart();
  }, 30000);

  const exportBtn = document.getElementById("export-att-btn");
  exportBtn?.addEventListener("click", async () => {
    await runTeacherAttendanceCsvExport(toast, {
      class_id: classSelect?.value || "1",
      from: fromInput?.value || "",
      to: toInput?.value || "",
    });
  });

  document.getElementById("teacher-attendance-query-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    try {
      const qs = new URLSearchParams();
      qs.set("class_id", String(data.class_id));
      if (data.attendance_date) qs.set("attendance_date", String(data.attendance_date));
      if (data.from && data.to) {
        qs.set("from", String(data.from));
        qs.set("to", String(data.to));
      }
      if (data.status) qs.set("status", String(data.status));
      if (data.search) qs.set("search", String(data.search));
      const res = await api(`/api/teacher/attendance?${qs.toString()}`);
      const rows = listFrom(res);
      const target = document.getElementById("teacher-attendance-query-results");
      if (target) {
        target.innerHTML = rows.map((row) => `
          <tr>
            <td>${escapeHtml(String(row.student?.full_name || row.student?.name || row.student_id || "-"))}</td>
            <td>${escapeHtml(String(row.status || "-"))}</td>
            <td>${escapeHtml(String(row.remarks || "-"))}</td>
          </tr>
        `).join("");
      }
    } catch (err) {
      toast?.(err.message || "Unable to load attendance.", "error");
    }
  });
}

export const teacherViews = {
  tools: { html: teacherOverviewHtml, bind: bindTeacherActions },
  announcements: { html: teacherAnnouncementsHtml, bind: bindTeacherActions },
  reports: {
    html: teacherReportsHtml,
    bind: bindTeacherReportChart,
  },
};
