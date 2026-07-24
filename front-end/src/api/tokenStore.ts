import { ref, computed } from "vue";
import type { AuthTokens } from "../types/auth";

// Single source of truth for the auth session (access token + refresh token +
// access-token expiry). Backed by localStorage and exposed as reactive refs so
// views can react to login/logout (including a forced logout on refresh
// failure). Kept dependency-free to avoid the useAuth -> api -> http cycle.

const ACCESS_KEY = "writer_access";
const REFRESH_KEY = "writer_refresh";
const EXPIRES_KEY = "writer_access_exp";

const accessToken = ref<string>(localStorage.getItem(ACCESS_KEY) ?? "");
const refreshToken = ref<string>(localStorage.getItem(REFRESH_KEY) ?? "");
const accessExp = ref<number>(Number(localStorage.getItem(EXPIRES_KEY) ?? 0));

/** Reactive "logged in" flag: true while we hold a refresh token. */
const loggedIn = computed(() => !!refreshToken.value);

/** Reactive login state, drives the login/app view switch in App.vue. */
export function sessionRef() {
  return loggedIn;
}

export function getAccessToken(): string {
  return accessToken.value;
}

export function getRefreshToken(): string {
  return refreshToken.value;
}

/** Epoch ms at which the current access token expires (0 when logged out). */
export function getAccessExp(): number {
  return accessExp.value;
}

/** Persist a freshly issued token pair. */
export function setSession(tokens: AuthTokens): void {
  accessToken.value = tokens.accessToken;
  refreshToken.value = tokens.refreshToken;
  accessExp.value = Date.now() + tokens.expiresIn * 1000;
  localStorage.setItem(ACCESS_KEY, tokens.accessToken);
  localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
  localStorage.setItem(EXPIRES_KEY, String(accessExp.value));
}

/** Clear the session (logout / forced logout). */
export function clearSession(): void {
  accessToken.value = "";
  refreshToken.value = "";
  accessExp.value = 0;
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(EXPIRES_KEY);
}
