const routes = new Map();

const SITE_TITLE = "MLGCL — School Portal";

function routeDocumentTitle(pathPart, recognizedRoute) {
  if (!recognizedRoute) return `Page not found · ${SITE_TITLE}`;
  switch (pathPart) {
    case "/login":
      return `Sign in · ${SITE_TITLE}`;
    case "/dashboard":
      return `Dashboard · ${SITE_TITLE}`;
    case "/setup-password":
      return `Set password · ${SITE_TITLE}`;
    case "/404":
      return `Page not found · ${SITE_TITLE}`;
    default:
      return SITE_TITLE;
  }
}

/** Move focus into the SPA shell without affecting the address bar hash. */
export function focusMainContent({ scroll = false } = {}) {
  const el = document.getElementById("app");
  if (!el) return;
  el.focus({ preventScroll: true });
  if (scroll) {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    el.scrollIntoView({ behavior: reduce ? "instant" : "smooth", block: "start" });
  }
}

export function registerRoute(path, render) {
  routes.set(path, render);
}

export function go(path) {
  location.hash = path;
}

export function startRouter() {
  document.getElementById("skip-to-content")?.addEventListener("click", () => focusMainContent({ scroll: true }));

  const run = () => {
    const raw = location.hash.replace("#", "") || "/login";
    const [pathPart, queryPart = ""] = raw.split("?");
    const recognizedRoute = routes.has(pathPart);
    const render = routes.get(pathPart) || routes.get("/404");
    const query = Object.fromEntries(new URLSearchParams(queryPart).entries());
    document.title = routeDocumentTitle(pathPart, recognizedRoute);
    render({ path: pathPart, query, raw });
    window.dispatchEvent(new CustomEvent("sars:route", { detail: { path: pathPart, recognizedRoute } }));
  };
  window.addEventListener("hashchange", run);
  run();
}
