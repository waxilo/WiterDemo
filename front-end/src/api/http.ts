// Use the platform's native fetch so the same code runs both in the browser
// (web deployment) and inside the Tauri webview. The backend sends permissive
// CORS headers and auth uses Bearer tokens (not cookies), so cross-origin
// requests work in both environments.
//
// Auth model: a short-lived access token + a long-lived refresh token. This
// module transparently keeps the access token fresh:
//   - before each request, if the access token is expired/near-expiry, it is
//     refreshed first (single-flight so concurrent requests share one refresh);
//   - if a request still comes back 401, one refresh + retry is attempted;
//   - a proactive timer refreshes shortly before expiry so it happens in the
//     background, invisible to the user.
import { API_BASE_URL } from "../config";
import type { ApiResponse } from "../types/api";
import type { AuthTokens } from "../types/auth";
import {
  getAccessToken,
  getRefreshToken,
  getAccessExp,
  setSession,
  clearSession,
} from "./tokenStore";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface RequestOptions {
  method?: HttpMethod;
  /** Parsed JSON body; serialized automatically for non-GET requests. */
  body?: unknown;
  headers?: Record<string, string>;
  /** Skip the auth token injection and silent-refresh flow (e.g. /logout). */
  skipAuthRefresh?: boolean;
}

/** Refresh proactively this many ms before the access token actually expires. */
const SKEW_MS = 60_000;

function resolveUrl(path: string): string {
  if (path.startsWith("http")) return path;
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

// --- silent refresh (single-flight) -----------------------------------------

let refreshPromise: Promise<boolean> | null = null;
let proactiveTimer: ReturnType<typeof setTimeout> | null = null;

/** Perform the actual /refresh call. Returns true on success. */
async function doRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  try {
    const res = await fetch(resolveUrl("/refresh"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    const json: ApiResponse<AuthTokens> = await res.json();
    if (json.code !== 200 || !json.data) {
      // Refresh token rejected/revoked -> force logout.
      clearSession();
      return false;
    }
    setSession(json.data);
    scheduleProactiveRefresh();
    return true;
  } catch {
    // Network error: don't force logout, let the next attempt retry.
    return false;
  }
}

/**
 * Ensure the access token is fresh. Refreshes if expired/near-expiry, sharing a
 * single in-flight refresh across concurrent callers.
 */
export function ensureFreshToken(): Promise<boolean> {
  if (!getRefreshToken()) return Promise.resolve(false);
  if (Date.now() < getAccessExp() - SKEW_MS) return Promise.resolve(true);
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

/** (Re)schedule a background refresh to fire shortly before the token expires. */
export function scheduleProactiveRefresh(): void {
  if (proactiveTimer) clearTimeout(proactiveTimer);
  if (!getRefreshToken()) return;
  const delay = Math.max(getAccessExp() - Date.now() - SKEW_MS, 0);
  proactiveTimer = setTimeout(() => void ensureFreshToken(), delay);
}

// --- request -----------------------------------------------------------------

function buildInit(
  method: HttpMethod,
  body: unknown,
  headers: Record<string, string> | undefined,
  withAuth: boolean
): RequestInit {
  const init: RequestInit = { method, headers: { ...headers } };
  if (withAuth) {
    const token = getAccessToken();
    if (token) {
      init.headers = { Authorization: `Bearer ${token}`, ...init.headers };
    }
  }
  if (method !== "GET" && body !== undefined && body !== null) {
    init.headers = { "Content-Type": "application/json", ...init.headers };
    init.body = JSON.stringify(body);
  }
  return init;
}

/**
 * Perform a request against the API and unwrap the standard envelope.
 * Transparently keeps the access token fresh and retries once on a 401.
 * Throws on transport errors or error codes.
 */
export async function request<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { method = "GET", body, headers, skipAuthRefresh = false } = options;
  const url = resolveUrl(path);

  if (!skipAuthRefresh) {
    await ensureFreshToken(); // pre-flight: refresh if expired/near-expiry
  }

  let res = await fetch(url, buildInit(method, body, headers, !skipAuthRefresh));
  let json: ApiResponse<T> = await parse(res);

  // Recovery: access token rejected despite pre-flight (e.g. clock skew).
  if (json.code === 401 && !skipAuthRefresh) {
    const ok = await ensureFreshToken();
    if (ok) {
      res = await fetch(url, buildInit(method, body, headers, true));
      json = await parse(res);
    }
  }

  if (json.code === 401) {
    clearSession();
    throw new Error(json.message || "登录已失效，请重新登录");
  }
  if (json.code !== 200) {
    throw new Error(json.message || `Unexpected code: ${json.code}`);
  }
  return json.data;
}

async function parse<T>(res: Response): Promise<ApiResponse<T>> {
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }
  return res.json();
}

/** Convenience GET helper. */
export function getJson<T>(path: string): Promise<T> {
  return request<T>(path, { method: "GET" });
}

/** Convenience POST helper. */
export function postJson<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: "POST", body });
}
