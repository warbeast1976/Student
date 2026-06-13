import { api, getSession } from "../core/api.js";
import { escapeHtml } from "../core/dom-safe.js";
import { focusMainContent } from "../core/router.js";
import { displayNameOf, roleOf } from "../js/auth.js";
import { dashboardShell } from "./ui.js";
import { toast } from "./toast.js";
import { adminViews } from "../../page/admin/dashboard.js";
import { teacherViews } from "../../page/staff/dashboard.js";
import { studentViews } from "../../page/user/dashboard.js";

const themeKey = "sars_theme";
const helpPrefsKey = "sars_help_prefs_v1";

function viewSkeletonHtml() {
  return `
    <article class="card">
      <div class="skeleton-line w-40"></div>
      <div class="skeleton-line w-90"></div>
      <div class="skeleton-grid">
        <div class="skeleton-box"></div>
        <div class="skeleton-box"></div>
        <div class="skeleton-box"></div>
      </div>
    </article>
  `;
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(themeKey, theme);
}

function initThemeToggle() {
  const saved = localStorage.getItem(themeKey) || "light";
  applyTheme(saved);
  document.getElementById("theme-toggle-btn")?.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme") || "dark";
    const next = current === "dark" ? "light" : "dark";
    applyTheme(next);
    toast(`Appearance set to ${next}.`);
  });
}

export async function renderRoleDashboard(onLogout) {
  const session = getSession();
  const user = session?.user || {};
  const role = roleOf(user);
  const lastViewKey = `sars_last_view_${role || "student"}`;
  const app = document.getElementById("app");

  const roleLabel = (r) => {
    if (r === "admin") return "Administrator";
    if (r === "teacher") return "Teacher";
    return "Student";
  };

  const roleMap = {
    admin: {
      title: "Administrator Portal",
      subtitle: "Manage users, school years, classes, and review reports",
      nav: [
        { label: "Overview", view: "overview" },
        { label: "Reports", view: "reports" },
        { label: "Setup", view: "settings" },
      ],
      quickStartTitle: "",
      quickStartItems: [],
      views: adminViews,
    },
    teacher: {
      title: "Teacher Portal",
      subtitle: "Attendance, class announcements, and absence reviews (your classes only)",
      nav: [
        { label: "Dashboard", view: "tools" },
        { label: "Class Announcements", view: "announcements" },
        { label: "Attendance Reports", view: "reports" },
      ],
      quickStartTitle: "Teacher Quick Start",
      quickStartItems: [
        "1) Open Attendance Session for your class",
        "2) Mark attendance or review absences",
        "3) Post class announcements for students",
      ],
      views: teacherViews,
    },
    student: {
      title: "Student Portal",
      subtitle: "Check schedule, attendance, announcements, and your profile",
      nav: [
        { label: "Dashboard", view: "panel" },
        { label: "Class Schedule", view: "schedule" },
        { label: "My Attendance", view: "attendance" },
        { label: "Announcements & Profile", view: "profile" },
      ],
      quickStartTitle: "Student Quick Start",
      quickStartItems: [
        "1) Check your class schedule",
        "2) Use Check-In during attendance sessions",
        "3) Submit absence report when needed",
      ],
      views: studentViews,
    },
  };

  const cfg = roleMap[role] || roleMap.student;
  let notifications = { count: 0, items: [] };
  try {
    if (role === "admin") {
      const [reportsRes, announcementsRes] = await Promise.all([
        api("/api/admin/absence-reports"),
        api("/api/admin/announcements"),
      ]);
      const reports = Array.isArray(reportsRes?.data) ? reportsRes.data : (reportsRes?.data?.data || []);
      const announcements = Array.isArray(announcementsRes?.data) ? announcementsRes.data : (announcementsRes?.data?.data || []);
      const pending = reports.filter((r) => String(r.status || "").toLowerCase() === "pending").length;
      const drafts = announcements.filter((a) => String(a.status || "").toLowerCase() !== "published").length;
      notifications = {
        count: pending + drafts,
        items: [
          { title: "Pending absence reports", body: `${pending} waiting for review` },
          { title: "Draft announcements", body: `${drafts} not published yet` },
        ],
      };
    } else if (role === "teacher") {
      const [reportsRes, announcementsRes] = await Promise.all([
        api("/api/teacher/absence-reports"),
        api("/api/teacher/announcements"),
      ]);
      const reports = Array.isArray(reportsRes?.data) ? reportsRes.data : (reportsRes?.data?.data || []);
      const announcements = Array.isArray(announcementsRes?.data) ? announcementsRes.data : (announcementsRes?.data?.data || []);
      const pending = reports.filter((r) => String(r.status || "").toLowerCase() === "pending").length;
      const drafts = announcements.filter((a) => String(a.status || "").toLowerCase() !== "published").length;
      notifications = {
        count: pending + drafts,
        items: [
          { title: "Pending absence reports", body: `${pending} need your action` },
          { title: "Draft announcements", body: `${drafts} can be published` },
        ],
      };
    } else {
      const [annRes, reportRes] = await Promise.all([
        api("/api/student/announcements"),
        api("/api/student/absence-reports"),
      ]);
      const anns = Array.isArray(annRes?.data) ? annRes.data : (annRes?.data?.data || []);
      const readIds = new Set(Array.isArray(annRes?.read_ids) ? annRes.read_ids : []);
      const unread = anns.filter((a) => !readIds.has(a.id)).length;
      const reports = Array.isArray(reportRes?.data) ? reportRes.data : (reportRes?.data?.data || []);
      const pending = reports.filter((r) => String(r.status || "").toLowerCase() === "pending").length;
      notifications = {
        count: unread + pending,
        items: [
          { title: "Unread announcements", body: `${unread} still unread` },
          { title: "Pending absence reports", body: `${pending} waiting for approval` },
        ],
      };
    }
  } catch {
    notifications = { count: 0, items: [] };
  }
  app.innerHTML = dashboardShell({
    title: cfg.title,
    subtitle: cfg.subtitle,
    name: displayNameOf(user),
    role,
    roleLabelText: roleLabel(role),
    nav: cfg.nav,
    quickStartTitle: cfg.quickStartTitle,
    quickStartItems: cfg.quickStartItems,
    notifications,
  });

  const viewRoot = document.getElementById("view-root");
  const navButtons = Array.from(document.querySelectorAll(".nav-link"));
  const renderView = async (viewName) => {
    const view = cfg.views[viewName] || cfg.views[cfg.nav[0].view];
    const resolvedViewName = cfg.views[viewName] ? viewName : cfg.nav[0].view;
    localStorage.setItem(lastViewKey, resolvedViewName);
    const activeBtn = navButtons.find((btn) => btn.dataset.view === viewName);
    navButtons.forEach((btn) => {
      const on = btn.dataset.view === viewName;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
    if (activeBtn?.id) viewRoot?.setAttribute("aria-labelledby", activeBtn.id);
    viewRoot.innerHTML = viewSkeletonHtml();
    try {
      viewRoot.innerHTML = await view.html();
      viewRoot.classList.remove("view-enter");
      requestAnimationFrame(() => viewRoot.classList.add("view-enter"));
      await view.bind?.({ toast });
    } catch (err) {
      viewRoot.innerHTML = `
        <article class="card empty-state">
          <h3>Unable to load dashboard data</h3>
          <p class="muted">${escapeHtml(String(err.message || "Unknown error."))}</p>
          <button id="retry-view-btn" class="btn btn-outline" type="button">Retry</button>
        </article>
      `;
      const retryViewBtn = document.getElementById("retry-view-btn");
      retryViewBtn?.addEventListener("click", () => renderView(viewName));
      requestAnimationFrame(() => retryViewBtn?.focus({ preventScroll: true }));
    }
  };

  navButtons.forEach((btn) => {
    btn.addEventListener("click", () => renderView(btn.dataset.view));
  });

  const helpModal = document.getElementById("help-modal");
  const helpContent = document.getElementById("help-modal-content");
  const helpBtn = document.getElementById("help-btn");
  const helpCloseBtn = document.getElementById("help-close-btn");
  let helpPrefs = {};
  try {
    helpPrefs = JSON.parse(localStorage.getItem(helpPrefsKey) || "{}");
  } catch {
    helpPrefs = {};
  }
  const isRoleHelpDismissed = () => Boolean(helpPrefs?.[role]?.dismissed);
  const navGuide = cfg.nav
    .map(
      (item) =>
        `<li><strong>${escapeHtml(item.label)}:</strong> open this to manage ${escapeHtml(item.label.toLowerCase())} tasks.</li>`,
    )
    .join("");
  const quickGuide = (cfg.quickStartItems || []).map((step) => `<li>${escapeHtml(step)}</li>`).join("");
  const setHelpContent = (title, html) => {
    const titleEl = document.getElementById("help-modal-title");
    if (titleEl) titleEl.textContent = title || "Portal Guide";
    if (helpContent) helpContent.innerHTML = html;
  };
  if (helpContent) {
    setHelpContent("Portal Guide", `
      <p class="muted" style="margin-top:0;">This portal is designed by role. Use this quick guide anytime.</p>
      <h4 style="margin:10px 0 6px;">First steps</h4>
      <ol style="margin:0 0 10px 18px;">${quickGuide}</ol>
      <h4 style="margin:10px 0 6px;">Main tabs</h4>
      <ul style="margin:0 0 10px 18px;">${navGuide}</ul>
      <p class="muted" style="margin:0;">Tip: if a form asks for IDs, copy IDs from the table beside that form.</p>
    `);
  }
  let helpReturnFocusEl = null;
  const openHelp = (options = {}) => {
    if (!helpModal) return;
    const rf = options.returnFocus;
    const resolved =
      rf === undefined || rf === null
        ? helpBtn ?? null
        : rf instanceof HTMLElement && typeof rf.focus === "function"
          ? rf
          : helpBtn ?? null;
    helpReturnFocusEl = resolved;
    helpModal.hidden = false;
    document.body.style.overflow = "hidden";
    const checkbox = document.getElementById("help-dont-show-checkbox");
    if (checkbox) checkbox.checked = isRoleHelpDismissed();
    requestAnimationFrame(() => helpCloseBtn?.focus());
  };
  const closeHelp = () => {
    if (!helpModal) return;
    helpModal.hidden = true;
    document.body.style.overflow = "";
    const target = helpReturnFocusEl ?? helpBtn;
    helpReturnFocusEl = null;
    if (target instanceof HTMLElement && document.contains(target)) {
      target.focus();
    } else {
      helpBtn?.focus();
    }
  };
  helpBtn?.addEventListener("click", () => openHelp());
  document.getElementById("help-reset-btn")?.addEventListener("click", () => {
    localStorage.removeItem(helpPrefsKey);
    helpPrefs = {};
    toast("Help tips reset. The guide will auto-open next time.");
  });
  helpCloseBtn?.addEventListener("click", closeHelp);
  helpModal?.addEventListener("change", (e) => {
    const target = e.target;
    if (!target || target.id !== "help-dont-show-checkbox") return;
    const checked = Boolean(target.checked);
    const next = {
      ...helpPrefs,
      [role]: { dismissed: checked },
    };
    helpPrefs = next;
    localStorage.setItem(helpPrefsKey, JSON.stringify(next));
  });
  helpModal?.addEventListener("click", (e) => {
    if (e.target?.getAttribute?.("data-help-close") === "true") closeHelp();
  });
  const notificationModal = document.getElementById("notification-popover");
  const notificationCloseBtn = document.getElementById("notification-close-btn");
  const notificationBellBtn = document.getElementById("notification-bell-btn");
  const openNotifications = () => {
    if (!notificationModal) return;
    notificationModal.hidden = false;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => notificationCloseBtn?.focus());
  };
  const closeNotifications = () => {
    if (!notificationModal) return;
    notificationModal.hidden = true;
    document.body.style.overflow = "";
    notificationBellBtn?.focus();
  };
  notificationBellBtn?.addEventListener("click", openNotifications);
  notificationCloseBtn?.addEventListener("click", closeNotifications);
  notificationModal?.addEventListener("click", (e) => {
    if (e.target?.getAttribute?.("data-notification-close") === "true") closeNotifications();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && helpModal && !helpModal.hidden) closeHelp();
    if (e.key === "Escape" && notificationModal && !notificationModal.hidden) closeNotifications();
  });
  document.addEventListener("click", (e) => {
    const btn = e.target?.closest?.(".section-help-btn");
    if (!btn) return;
    const title = btn.getAttribute("data-help-title") || "Section Help";
    const text = btn.getAttribute("data-help-text") || "No help content available.";
    setHelpContent(title, `<p style="margin:0;">${escapeHtml(text)}</p>`);
    openHelp({ returnFocus: btn });
  });

  const preferredView = localStorage.getItem(lastViewKey);
  const initialView = preferredView && cfg.views[preferredView] ? preferredView : cfg.nav[0].view;
  await renderView(initialView);
  initThemeToggle();
  document.getElementById("logout-btn")?.addEventListener("click", onLogout);
  if (!isRoleHelpDismissed()) {
    openHelp({ returnFocus: helpBtn });
  } else {
    requestAnimationFrame(() => {
      const heading = document.querySelector("#app .app-title-block h1");
      if (heading instanceof HTMLElement) {
        if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1");
        heading.focus({ preventScroll: true });
      } else {
        focusMainContent({ scroll: false });
      }
    });
  }
}
