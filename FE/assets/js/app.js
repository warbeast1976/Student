import { renderAuthShell } from "../components/ui.js";
import { toast } from "../components/toast.js";
import { renderRoleDashboard } from "../components/views.js";
import { api, clearSession, getSession } from "../core/api.js";
import { go, registerRoute, startRouter } from "../core/router.js";
import { login, logout } from "./auth.js";

const loginRememberEmailKey = "sars_login_email";

function guard() {
  return Boolean(getSession()?.token);
}

let progressValue = 0;
let progressTimer = null;

function setProgress(value) {
  const bar = document.getElementById("global-progress");
  if (!bar) return;
  progressValue = Math.max(0, Math.min(100, value));
  bar.style.width = `${progressValue}%`;
}

function startProgress() {
  const bar = document.getElementById("global-progress");
  if (!bar) return;
  bar.classList.add("show");
  if (progressTimer) clearInterval(progressTimer);
  if (progressValue < 10) setProgress(10);
  progressTimer = setInterval(() => {
    if (progressValue < 85) setProgress(progressValue + Math.max(1, (90 - progressValue) * 0.08));
  }, 120);
}

function finishProgress() {
  const bar = document.getElementById("global-progress");
  if (!bar) return;
  if (progressTimer) {
    clearInterval(progressTimer);
    progressTimer = null;
  }
  setProgress(100);
  setTimeout(() => {
    bar.classList.remove("show");
    setProgress(0);
  }, 220);
}

registerRoute("/login", () => {
  if (guard()) return go("/dashboard");
  const app = document.getElementById("app");
  app.innerHTML = renderAuthShell();
  requestAnimationFrame(() => document.getElementById("login-email")?.focus());

  const form = document.getElementById("login-form");
  const emailInput = document.getElementById("login-email");
  const passwordInput = document.getElementById("login-password");
  const rememberEmailInput = document.getElementById("login-remember-email");
  const passwordToggleBtn = document.getElementById("login-password-toggle");
  const capsHint = document.getElementById("login-caps-hint");

  const rememberedEmail = localStorage.getItem(loginRememberEmailKey) || "";
  if (rememberedEmail && emailInput) {
    emailInput.value = rememberedEmail;
    if (rememberEmailInput) rememberEmailInput.checked = true;
    requestAnimationFrame(() => document.getElementById("login-password")?.focus());
  }
  const syncCapsHint = (event) => {
    const capsOn = Boolean(event?.getModifierState?.("CapsLock"));
    if (capsHint) capsHint.hidden = !capsOn;
  };
  passwordInput?.addEventListener("keyup", syncCapsHint);
  passwordInput?.addEventListener("keydown", syncCapsHint);
  passwordInput?.addEventListener("blur", () => {
    if (capsHint) capsHint.hidden = true;
  });
  passwordToggleBtn?.addEventListener("click", () => {
    const showing = passwordInput?.type === "text";
    if (!passwordInput) return;
    passwordInput.type = showing ? "password" : "text";
    passwordToggleBtn.textContent = showing ? "Show" : "Hide";
    passwordToggleBtn.setAttribute("aria-pressed", showing ? "false" : "true");
    passwordToggleBtn.setAttribute("aria-label", showing ? "Show password" : "Hide password");
    passwordInput.focus();
  });

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    const submitBtn = form.querySelector('button[type="submit"]');
    try {
      submitBtn?.classList.add("is-loading");
      if (submitBtn) submitBtn.disabled = true;
      const session = await login(data.email, data.password);
      if (rememberEmailInput?.checked) localStorage.setItem(loginRememberEmailKey, String(data.email || "").trim());
      else localStorage.removeItem(loginRememberEmailKey);
      toast(`Signed in as ${session.user?.full_name || session.user?.name || "User"}.`);
      go("/dashboard");
    } catch (err) {
      toast(err.message || "Unable to sign in.", "error");
    } finally {
      submitBtn?.classList.remove("is-loading");
      if (submitBtn) submitBtn.disabled = false;
    }
  });
});

registerRoute("/setup-password", ({ query } = {}) => {
  const app = document.getElementById("app");
  const token = String(query?.token || "").trim();

  // If an admin is already logged in on this device, it will force-redirect to /dashboard.
  // Password setup must be done as a logged-out flow.
  if (token) clearSession();

  app.innerHTML = `
    <div class="auth-page auth-page--split">
      <aside class="auth-hero" aria-hidden="true">
        <div class="auth-hero-pattern"></div>
        <div class="auth-hero-inner">
          <p class="auth-hero-kicker">Student account</p>
          <h1 class="auth-hero-title">Activate your login</h1>
          <p class="auth-hero-text">Choose a password you’ll remember — you’ll use it every time you sign in.</p>
        </div>
      </aside>
      <div class="auth-panel">
        <div class="auth-card auth-card--elevated">
          <form id="setup-password-form" class="auth-form">
            <div class="auth-form-header">
              <h2>Set your password</h2>
              <p>Create a password to activate your student account.</p>
            </div>
            <div>
              <label class="label" for="setup-password">Password</label>
              <input id="setup-password" class="input" name="password" type="password" required minlength="6" autocomplete="new-password" placeholder="Minimum 6 characters" />
            </div>
            <div>
              <label class="label" for="setup-password-confirmation">Confirm password</label>
              <input id="setup-password-confirmation" class="input" name="password_confirmation" type="password" required minlength="6" autocomplete="new-password" placeholder="Repeat password" />
            </div>
            <button class="btn btn-primary btn-lg" type="submit" style="width:100%;">Set password</button>
            <button id="setup-password-back-btn" class="btn btn-outline btn-lg" type="button" style="width:100%;">Back to sign in</button>
          </form>
        </div>
      </div>
    </div>
  `;

  if (!token) {
    toast("Missing or invalid password setup token.", "error");
  }
  requestAnimationFrame(() => document.getElementById("setup-password")?.focus());
  document.getElementById("setup-password-back-btn")?.addEventListener("click", () => go("/login"));
  document.getElementById("setup-password-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!token) return;
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    const submitBtn = form.querySelector('button[type="submit"]');
    try {
      submitBtn?.classList.add("is-loading");
      if (submitBtn) submitBtn.disabled = true;
      await api("/api/auth/student-invites/accept", {
        method: "POST",
        body: JSON.stringify({
          token,
          password: data.password,
          password_confirmation: data.password_confirmation,
        }),
      });
      toast("Password set successfully. You can now sign in.");
      clearSession();
      go("/login");
    } catch (err) {
      toast(err.message || "Unable to set password.", "error");
    } finally {
      submitBtn?.classList.remove("is-loading");
      if (submitBtn) submitBtn.disabled = false;
    }
  });
});

registerRoute("/dashboard", async () => {
  if (!guard()) return go("/login");
  await renderRoleDashboard(() => {
    logout();
    toast("Signed out successfully.");
    go("/login");
  });
});

registerRoute("/404", () => {
  document.getElementById("app").innerHTML = `
    <div class="auth-page auth-page--center">
      <article class="card card--spotlight empty-state" style="max-width:420px;width:100%;">
        <h3>Page not found</h3>
        <p class="muted">This route does not exist. Use the button below to return.</p>
        <p style="margin-top:20px;"><button type="button" class="btn btn-primary btn-lg" id="404-home-btn" style="width:100%;">Continue</button></p>
      </article>
    </div>`;
  requestAnimationFrame(() => document.getElementById("404-home-btn")?.focus({ preventScroll: true }));
  document.getElementById("404-home-btn")?.addEventListener("click", () => go(guard() ? "/dashboard" : "/login"));
});

window.addEventListener("sars:unauthorized", () => {
  toast("Session expired. Please sign in again.", "error");
  go("/login");
});

window.addEventListener("sars:loading", (event) => {
  const pending = Number(event?.detail?.pending || 0);
  const loadingEl = document.getElementById("global-loading");
  if (!loadingEl) return;
  const busy = pending > 0;
  loadingEl.classList.toggle("show", busy);
  loadingEl.setAttribute("aria-busy", busy ? "true" : "false");
  if (busy) startProgress();
  else finishProgress();
});

if (!location.hash) {
  go(guard() ? "/dashboard" : "/login");
}

startRouter();
