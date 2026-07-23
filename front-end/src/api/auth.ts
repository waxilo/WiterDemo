import { request } from "./http";
import type { LoginParams, LoginResult } from "../types/auth";

/** Authenticate a user; resolves to the session token on success. */
export function login(params: LoginParams): Promise<LoginResult> {
  return request<LoginResult>("/login", { method: "POST", body: params });
}
