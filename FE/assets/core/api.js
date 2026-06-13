const storageKey = "sars_session_v1";
const DEFAULT_API_BASE = "https://attendance.test";

function readRuntimeConfig() {
  const cfg = window.__SARS_CONFIG__;
  return cfg && typeof cfg === "object" ? cfg : {};
}

/** Resolved API origin (no trailing slash). Uses runtime config from `window.__SARS_CONFIG__`. */
export function getApiBaseUrl() {
  const v = readRuntimeConfig().apiBaseUrl;
  if (typeof v === "string" && v.trim()) {
    return v.trim().replace(/\/$/, "");
  }
  return DEFAULT_API_BASE;
}

function getApiKey() {
  const key = readRuntimeConfig().apiKey;
  return typeof key === "string" && key.trim() ? key.trim() : "";
}

export const config = {
  get baseUrl() {
    return getApiBaseUrl();
  },
};
let pendingRequests = 0;

const DEFAULT_TIMEOUT_MS = 45000;
const DOWNLOAD_TIMEOUT_MS = 120000;

async function fetchWithTimeout(resource, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const outer = options.signal;
  const onOuterAbort = () => controller.abort();
  if (outer) {
    if (outer.aborted) controller.abort();
    else outer.addEventListener("abort", onOuterAbort, { once: true });
  }
  const t = setTimeout(() => controller.abort(), timeoutMs);
  const { signal: _ignored, ...rest } = options;
  try {
    return await fetch(resource, { ...rest, signal: controller.signal });
  } finally {
    clearTimeout(t);
    if (outer) outer.removeEventListener("abort", onOuterAbort);
  }
}

function notifyLoadingChange() {
  window.dispatchEvent(new CustomEvent("sars:loading", { detail: { pending: pendingRequests } }));
}

/** First field error from Laravel-style JSON, else `message`, else fallback. */
function messageFromApiErrorBody(data, fallback = "Request failed") {
  if (!data || typeof data !== "object") return fallback;
  const errs = data.errors;
  if (errs && typeof errs === "object" && !Array.isArray(errs)) {
    for (const key of Object.keys(errs)) {
      const val = errs[key];
      if (Array.isArray(val) && val.length && typeof val[0] === "string") return val[0];
      if (typeof val === "string" && val.trim()) return val;
    }
  }
  if (typeof data.message === "string" && data.message.trim()) return data.message;
  return fallback;
}

export function getSession() {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : null;
  } catch {
    clearSession();
    return null;
  }
}

export function saveSession(payload) {
  localStorage.setItem(storageKey, JSON.stringify(payload));
}

export function clearSession() {
  localStorage.removeItem(storageKey);
}

export async function api(path, options = {}) {
  const session = getSession();
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const headers = {
    Accept: "application/json",
    "X-Requested-With": "XMLHttpRequest",
    ...(options.headers || {}),
  };
  const apiKey = getApiKey();
  if (apiKey) {
    headers["X-API-Key"] = apiKey;
  }
  if (isFormData) {
    // Let the browser set multipart boundary for Laravel file uploads.
    delete headers["Content-Type"];
    delete headers["content-type"];
  }
  if (!isFormData && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  if (session?.token) {
    headers.Authorization = `Bearer ${session.token}`;
  }

  const timeoutMs = typeof options.timeoutMs === "number" ? options.timeoutMs : DEFAULT_TIMEOUT_MS;
  const { timeoutMs: _omit, ...fetchOptions } = options;

  pendingRequests += 1;
  notifyLoadingChange();
  try {
    let response;
    try {
      response = await fetchWithTimeout(
        `${getApiBaseUrl()}${path}`,
        {
          ...fetchOptions,
          headers,
        },
        timeoutMs
      );
    } catch (err) {
      if (err?.name === "AbortError") {
        throw new Error(
          `Request timed out (${timeoutMs / 1000}s). Confirm the API is running at ${getApiBaseUrl()}.`
        );
      }
      throw new Error(`Cannot connect to API at ${getApiBaseUrl()}. Start backend server and check API URL.`);
    }

    const contentType = response.headers.get("content-type") || "";
    const isJson = contentType.includes("application/json");
    const data = isJson ? await response.json() : await response.text();

    if (!response.ok) {
      if (response.status === 401) {
        clearSession();
        window.dispatchEvent(new CustomEvent("sars:unauthorized"));
      }
      const message = isJson ? messageFromApiErrorBody(data) : "Request failed";
      const err = new Error(message);
      err.status = response.status;
      err.data = data;
      throw err;
    }

    return data;
  } finally {
    pendingRequests = Math.max(0, pendingRequests - 1);
    notifyLoadingChange();
  }
}

export async function download(path, filename, options = {}) {
  const session = getSession();
  const headers = {};
  const apiKey = getApiKey();
  if (apiKey) {
    headers["X-API-Key"] = apiKey;
  }
  if (session?.token) headers.Authorization = `Bearer ${session.token}`;
  const timeoutMs = typeof options.timeoutMs === "number" ? options.timeoutMs : DOWNLOAD_TIMEOUT_MS;

  pendingRequests += 1;
  notifyLoadingChange();
  try {
    let response;
    try {
      response = await fetchWithTimeout(`${getApiBaseUrl()}${path}`, { headers, signal: options.signal }, timeoutMs);
    } catch (err) {
      if (err?.name === "AbortError") {
        throw new Error(`Download timed out (${timeoutMs / 1000}s). Try again or check the API.`);
      }
      throw new Error(`Cannot connect to API at ${getApiBaseUrl()}.`);
    }
    if (!response.ok) {
      if (response.status === 401) {
        clearSession();
        window.dispatchEvent(new CustomEvent("sars:unauthorized"));
      }
      const ct = response.headers.get("content-type") || "";
      let msg = "Unable to download file.";
      if (ct.includes("application/json")) {
        try {
          const json = await response.json();
          msg = messageFromApiErrorBody(json, msg);
        } catch {
          /* keep default */
        }
      }
      throw new Error(msg);
    }

    const blob = await response.blob();
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  } finally {
    pendingRequests = Math.max(0, pendingRequests - 1);
    notifyLoadingChange();
  }
}

/**
 * Load a binary resource (e.g. PNG) with the Sanctum Bearer token.
 * Use for authenticated images that cannot use `<img src>` without exposing the token.
 */
export async function fetchAuthenticatedBlobUrl(path, options = {}) {
  const session = getSession();
  const timeoutMs = typeof options.timeoutMs === "number" ? options.timeoutMs : DEFAULT_TIMEOUT_MS;
  const headers = {
    Accept: options.accept || "*/*",
    ...(getApiKey() ? { "X-API-Key": getApiKey() } : {}),
    ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
    ...(options.headers || {}),
  };
  let response;
  try {
    response = await fetchWithTimeout(
      `${getApiBaseUrl()}${path}`,
      { ...options, headers },
      timeoutMs
    );
  } catch (err) {
    if (err?.name === "AbortError") {
      throw new Error(`Request timed out (${timeoutMs / 1000}s).`);
    }
    throw new Error(`Cannot connect to API at ${getApiBaseUrl()}.`);
  }
  if (!response.ok) {
    if (response.status === 401) {
      clearSession();
      window.dispatchEvent(new CustomEvent("sars:unauthorized"));
    }
    throw new Error("Failed to load resource");
  }
  return response.blob();
}
