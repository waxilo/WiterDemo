import { request } from "./http";
import type { LoginParams, LoginResult, UserInfo } from "../types/auth";

/** Authenticate a user; resolves to the session token on success. */
export function login(params: LoginParams): Promise<LoginResult> {
  return request<LoginResult>("/login", { method: "POST", body: params });
}

/** Register a new user; resolves to the session token (auto login). */
export function register(params: LoginParams): Promise<LoginResult> {
  return request<LoginResult>("/register", { method: "POST", body: params });
}

/** Fetch the currently authenticated user's info. */
export function getMe(): Promise<UserInfo> {
  return request<UserInfo>("/me", { method: "GET" });
}
