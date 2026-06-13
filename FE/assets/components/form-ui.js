const flashPrefix = "sars_ui_flash_";

export function setFormSubmitting(form, busy, loadingText = "Submitting...") {
  if (!form) return;
  const submitBtn = form.querySelector('button[type="submit"]');
  if (!submitBtn) return;
  if (busy) {
    submitBtn.dataset.label = submitBtn.textContent || "";
    submitBtn.textContent = loadingText;
    submitBtn.disabled = true;
    return;
  }
  submitBtn.textContent = submitBtn.dataset.label || submitBtn.textContent;
  submitBtn.disabled = false;
}

export function setInlineHint(id, message = "") {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = message;
}

export function rerenderView(viewName) {
  const key = typeof viewName === "string" ? CSS.escape(viewName) : "";
  if (!key) return;
  document.querySelector(`.nav-link[data-view="${key}"]`)?.click();
}

export function setUiFlash(scope, payload) {
  sessionStorage.setItem(`${flashPrefix}${scope}`, JSON.stringify({ ...payload, at: Date.now() }));
}

export function consumeUiFlash(scope, maxAgeMs = 8000) {
  const key = `${flashPrefix}${scope}`;
  const raw = sessionStorage.getItem(key);
  if (!raw) return null;
  sessionStorage.removeItem(key);
  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.at || Date.now() - parsed.at > maxAgeMs) return null;
    return parsed;
  } catch {
    return null;
  }
}
