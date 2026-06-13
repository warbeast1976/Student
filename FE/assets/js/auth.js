import { api, clearSession, getSession, saveSession } from "../core/api.js";

export function roleOf(user) {
  const role = String(user?.role?.name || user?.role || user?.type || "").toLowerCase();
  if (role.includes("admin")) return "admin";
  if (role.includes("teacher") || role.includes("staff")) return "teacher";
  if (role.includes("student") || role.includes("user")) return "student";
  return "student";
}

export function displayNameOf(user) {
  if (!user) return "User";
  return user.full_name || user.name || `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.email || "User";
}

export async function login(email, password) {
  const result = await api("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  const token = result.token || result.access_token || result.data?.token;
  if (!token) throw new Error("No token returned from API");

  saveSession({
    token,
    user: result.user || result.data?.user || null,
  });

  const me = await api("/api/auth/me");
  const session = getSession();
  saveSession({ ...session, user: me.user || me.data || me });

  return getSession();
}

export function logout() {
  const token = getSession()?.token;
  if (token) {
    api("/api/auth/logout", { method: "POST" }).catch(() => {});
  }
  clearSession();
}
