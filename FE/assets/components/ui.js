import { escapeHtml } from "../core/dom-safe.js";

export function renderAuthShell() {
  return `
    <div class="auth-page auth-page--split">
      <aside class="auth-hero" aria-hidden="true">
        <div class="auth-hero-pattern"></div>
        <div class="auth-hero-inner">
          <p class="auth-hero-kicker">Attendance · Absences · Announcements</p>
          <h1 class="auth-hero-title">MLGCL School Portal</h1>
          <p class="auth-hero-text">One secure sign-in for administrators, teachers, and students.</p>
        </div>
      </aside>
      <div class="auth-panel">
        <div class="auth-card auth-card--elevated">
          <form id="login-form" class="auth-form">
            <div class="auth-form-header">
              <h2>Sign in</h2>
              <p>Use your school email and password.</p>
            </div>
            <div>
              <label class="label" for="login-email">Email</label>
              <input id="login-email" class="input" name="email" type="email" required autocomplete="email" placeholder="you@school.edu" />
            </div>
            <div>
              <label class="label" for="login-password">Password</label>
              <div class="password-input-wrap">
                <input id="login-password" class="input" name="password" type="password" required autocomplete="current-password" placeholder="••••••••" />
                <button id="login-password-toggle" class="btn btn-ghost btn-sm password-toggle-btn" type="button" aria-label="Show password" aria-pressed="false">Show</button>
              </div>
              <p id="login-caps-hint" class="field-hint" hidden>Caps Lock appears to be on.</p>
            </div>
            <div class="auth-inline-options">
              <label class="auth-check">
                <input id="login-remember-email" name="remember_email" type="checkbox" value="1" />
                <span>Remember email on this device</span>
              </label>
            </div>
            <button class="btn btn-primary btn-lg" type="submit" style="width:100%;">Continue</button>
          </form>
        </div>
      </div>
    </div>
  `;
}

export function dashboardShell({
  title,
  subtitle,
  name,
  role,
  roleLabelText = "",
  nav,
  quickStartTitle = "",
  quickStartItems = [],
  notifications = { count: 0, items: [] },
}) {
  const initials = String(name)
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "U";
  const roleLabel =
    roleLabelText ||
    (role ? String(role).charAt(0).toUpperCase() + String(role).slice(1) : "User");

  const iconFor = (view) => {
    if (view.includes("overview") || view.includes("panel")) return "home";
    if (view.includes("report")) return "chart";
    if (view.includes("setting")) return "settings";
    if (view.includes("announcement")) return "megaphone";
    if (view.includes("attendance") || view.includes("tool")) return "clipboard";
    if (view.includes("schedule")) return "calendar";
    if (view.includes("profile")) return "user";
    return "dot";
  };

  const iconSvg = (kind) => {
    if (kind === "home") {
      return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5v8a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>`;
    }
    if (kind === "chart") {
      return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19h16v2H2V3h2zM8 10h3v7H8zm5-4h3v11h-3zm5 6h3v5h-3z"/></svg>`;
    }
    if (kind === "settings") {
      return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m20.9 13.6.1-1.6-1.9-.8a7.6 7.6 0 0 0-.5-1.2l1-1.8-1.2-1.2-1.8 1a7.6 7.6 0 0 0-1.2-.5L14 3.1h-1.6l-.8 1.9a7.6 7.6 0 0 0-1.2.5l-1.8-1-1.2 1.2 1 1.8a7.6 7.6 0 0 0-.5 1.2l-1.9.8v1.6l1.9.8c.1.4.3.8.5 1.2l-1 1.8 1.2 1.2 1.8-1c.4.2.8.4 1.2.5l.8 1.9H14l.8-1.9c.4-.1.8-.3 1.2-.5l1.8 1 1.2-1.2-1-1.8c.2-.4.4-.8.5-1.2zM13 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8z"/></svg>`;
    }
    if (kind === "megaphone") {
      return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12v-2l12-5v14L4 14zm1 4h3l1 4H6zm13-9h2v10h-2z"/></svg>`;
    }
    if (kind === "clipboard") {
      return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 3h-2.2a3 3 0 0 0-5.6 0H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a4 4 0 0 1 4-4V5a2 2 0 0 0-2-2zM8 11h8v2H8zm0 4h5v2H8zm3-10a1 1 0 0 1 1 1h-2a1 1 0 0 1 1-1z"/></svg>`;
    }
    if (kind === "calendar") {
      return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zM9 14H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2zm-8-4H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2z"/></svg>`;
    }
    if (kind === "user") {
      return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5zm0 2c-4.4 0-8 2.2-8 5v1h16v-1c0-2.8-3.6-5-8-5z"/></svg>`;
    }
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/></svg>`;
  };

  const tabButtons = nav
    .map(
      (item, i) => `
    <button
      type="button"
      role="tab"
      class="nav-link app-tab ${i === 0 ? "active" : ""}"
      data-view="${escapeHtml(item.view)}"
      id="dashboard-tab-${escapeHtml(item.view)}"
      aria-selected="${i === 0 ? "true" : "false"}"
      aria-controls="view-root"
    >
      <span class="app-tab-icon" aria-hidden="true">${iconSvg(iconFor(item.view))}</span>
      <span>${escapeHtml(item.label)}</span>
    </button>`,
    )
    .join("");
  const quickStartHtml =
    quickStartItems.length > 0
      ? `
      <article class="card card--quiet" style="margin-top:16px;">
        ${quickStartTitle ? `<p class="quick-start-title">${escapeHtml(quickStartTitle)}</p>` : ""}
        <ul class="quick-start-list">
          ${quickStartItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
      </article>
    `
      : "";
  const notificationCount = Math.max(0, Number(notifications?.count || 0));
  const notificationItems = Array.isArray(notifications?.items) ? notifications.items : [];
  const notificationListHtml = notificationItems.length
    ? notificationItems
      .slice(0, 8)
      .map((item) => `<li><strong>${escapeHtml(item.title || "Update")}:</strong> ${escapeHtml(item.body || "-")}</li>`)
      .join("")
    : '<li class="muted">No new notifications.</li>';

  return `
    <div class="app-shell">
      <div class="app-main">
        <header class="app-header">
          <div class="app-header-top">
            <div class="app-brand">
              <img class="app-brand-logo" src="./assets/img/mlgcl-logo.svg" alt="MLGCL logo" />
              <div>
                <div class="app-brand-title">MLGCL</div>
                <div class="app-brand-role">${escapeHtml(roleLabel)}</div>
              </div>
            </div>
            <div class="app-header-actions">
              <button id="help-btn" class="btn btn-ghost" type="button" aria-haspopup="dialog" aria-controls="help-modal">Help</button>
              <button id="help-reset-btn" class="btn btn-ghost" type="button" title="Show onboarding tips again">Tips</button>
              <button id="notification-bell-btn" class="btn btn-icon" type="button" aria-haspopup="dialog" aria-controls="notification-popover" aria-label="Notifications" title="Notifications">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm7-6V11a7 7 0 1 0-14 0v5l-2 2v1h18v-1l-2-2Z"/></svg>
                ${notificationCount > 0 ? `<span class="notif-dot">${notificationCount > 9 ? "9+" : notificationCount}</span>` : ""}
              </button>
              <button id="theme-toggle-btn" class="btn btn-icon" type="button" aria-label="Toggle theme" title="Theme">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-6.08-6.08 5.39 5.39 0 0 1 2.26-4.4c-.44-.06-.9-.1-1.36-.1z"/></svg>
              </button>
              <span class="user-chip">
                <span class="avatar" aria-hidden="true">${escapeHtml(initials)}</span>
                <span>${escapeHtml(name)}</span>
              </span>
              <button id="logout-btn" class="btn btn-danger btn-sm" type="button">Log out</button>
            </div>
          </div>
          <div class="app-header-body">
            <div class="app-title-block">
              <p class="eyebrow">Dashboard</p>
              <h1>${escapeHtml(title)}</h1>
              <p class="tagline">${escapeHtml(subtitle)}</p>
            </div>
          </div>
        </header>
        <nav class="app-tabs" role="tablist" aria-label="Main sections">
          ${tabButtons}
        </nav>
        ${quickStartHtml}
        <div id="help-modal" class="help-modal" role="dialog" aria-modal="true" aria-labelledby="help-modal-title" hidden>
          <div class="help-modal-backdrop" data-help-close="true"></div>
          <article class="help-modal-card">
            <div class="panel-header" style="margin-bottom:10px;">
              <h3 id="help-modal-title" class="panel-title">Portal Guide</h3>
              <button id="help-close-btn" class="btn btn-outline btn-xs" type="button">Close</button>
            </div>
            <div id="help-modal-content" class="help-modal-content"></div>
            <label class="help-modal-footer">
              <input id="help-dont-show-checkbox" type="checkbox" />
              <span>Don’t show this guide automatically next time</span>
            </label>
          </article>
        </div>
        <div id="notification-popover" class="help-modal" role="dialog" aria-modal="true" aria-labelledby="notification-title" hidden>
          <div class="help-modal-backdrop" data-notification-close="true"></div>
          <article class="help-modal-card">
            <div class="panel-header" style="margin-bottom:10px;">
              <h3 id="notification-title" class="panel-title">Notifications</h3>
              <button id="notification-close-btn" class="btn btn-outline btn-xs" type="button">Close</button>
            </div>
            <ul style="margin:0 0 0 16px;padding:0;display:grid;gap:8px;">
              ${notificationListHtml}
            </ul>
          </article>
        </div>
        <div id="view-root" class="app-view" role="tabpanel" tabindex="0"></div>
      </div>
    </div>
  `;
}

export function panelHeader(title, subtitle = "", toolsHtml = "", helpTitle = "", helpText = "") {
  const helpButton = helpText
    ? `<button
        type="button"
        class="btn btn-outline btn-xs section-help-btn"
        data-help-title="${escapeHtml(helpTitle || title)}"
        data-help-text="${escapeHtml(helpText)}"
        aria-label="Open help for ${escapeHtml(title)}"
      >?</button>`
    : "";
  return `
    <div class="panel-header">
      <div>
        <h3 class="panel-title">${escapeHtml(title)}</h3>
        ${subtitle ? `<p class="panel-subtitle">${escapeHtml(subtitle)}</p>` : ""}
      </div>
      ${toolsHtml || helpButton ? `<div class="panel-tools">${helpButton}${toolsHtml}</div>` : ""}
    </div>
  `;
}

export function statCards(items = []) {
  return `
    <div class="grid stats">
      ${items
        .map(
          (item) => `
        <article class="card stat-card">
          <p class="muted stat-label">${escapeHtml(item.label)}</p>
          <div class="metric">${item.allowHtml ? String(item.value ?? "-") : escapeHtml(item.value ?? "-")}</div>
        </article>`,
        )
        .join("")}
    </div>
  `;
}

export function sectionCard({ title, subtitle = "", body = "", tools = "", helpTitle = "", helpText = "" }) {
  return `
    <article class="card">
      ${panelHeader(title, subtitle, tools, helpTitle, helpText)}
      ${body}
    </article>
  `;
}
