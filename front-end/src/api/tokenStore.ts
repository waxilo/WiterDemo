import { ref } from "vue";

// Single source of truth for the auth token. Backed by localStorage and
// exposed as a reactive ref so views can react to login/logout (including a
// forced logout triggered by a 401). Kept dependency-free to avoid the
// useAuth -> api -> http import cycle.

const TOKEN_KEY = "writer_token";

const token = ref<string>(localStorage.getItem(TOKEN_KEY) ?? "");

/** Reactive token ref (empty string when logged out). */
export function tokenRef() {
  return token;
}

export function getToken(): string {
  return token.value;
}

export function setToken(value: string): void {
  token.value = value;
  localStorage.setItem(TOKEN_KEY, value);
}

export function clearToken(): void {
  token.value = "";
  localStorage.removeItem(TOKEN_KEY);
}
