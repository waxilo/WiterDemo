// Use Tauri's HTTP plugin instead of the webview's fetch.
// Requests go through the Rust backend, so browser CORS does not apply.
import { fetch } from "@tauri-apps/plugin-http";
import { API_BASE_URL } from "../config";
import type { ApiResponse } from "../types/api";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface RequestOptions {
  method?: HttpMethod;
  /** Parsed JSON body; serialized automatically for non-GET requests. */
  body?: unknown;
  headers?: Record<string, string>;
}

function resolveUrl(path: string): string {
  if (path.startsWith("http")) return path;
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Perform a request against the API and unwrap the standard envelope.
 * Throws on transport errors, non-2xx responses, or business error codes.
 */
export async function request<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { method = "GET", body, headers } = options;

  const init: RequestInit = { method, headers: { ...headers } };
  if (method !== "GET" && body !== undefined && body !== null) {
    init.headers = { "Content-Type": "application/json", ...init.headers };
    init.body = JSON.stringify(body);
  }

  const res = await fetch(resolveUrl(path), init);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }

  const json: ApiResponse<T> = await res.json();
  if (json.code !== 200) {
    throw new Error(json.message || `Unexpected code: ${json.code}`);
  }

  return json.data;
}

/** Convenience GET helper. */
export function getJson<T>(path: string): Promise<T> {
  return request<T>(path, { method: "GET" });
}

/** Convenience POST helper. */
export function postJson<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: "POST", body });
}
