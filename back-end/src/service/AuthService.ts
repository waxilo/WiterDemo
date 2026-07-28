import {
  createAccessToken,
  createRefreshToken,
  ACCESS_TTL,
} from "../utils/token";
import { createSession } from "./SessionService";
import type { BookRow } from "../types";

/** Access + refresh token pair returned on login/register/refresh. */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  /** Access token lifetime in seconds, so the client can schedule renewal. */
  expiresIn: number;
}

/** Issue an access + refresh token pair and register the refresh session. */
export async function issueTokens(
  userId: number,
  env: Env
): Promise<AuthTokens> {
  const accessToken = await createAccessToken(userId, env);
  const { token, jti, ttlMs } = await createRefreshToken(userId, env);
  await createSession(env, userId, jti, token, ttlMs);
  return { accessToken, refreshToken: token, expiresIn: ACCESS_TTL };
}

/**
 * Validate credentials and, on success, issue a token pair.
 * Throws on invalid credentials.
 */
export async function login(
  username: string,
  password: string,
  env: Env
): Promise<AuthTokens> {
  const user = await env.DB.prepare(
    `select id from t_user where username = ? and password = ?`
  )
    .bind(username, password)
    .first<Pick<BookRow, "id">>();

  if (!user) {
    throw new Error("账号密码错误");
  }

  return issueTokens(user.id, env);
}

/**
 * Register a new user and, on success, issue a token pair (auto login).
 * Throws if the username is taken or the input is invalid.
 */
export async function register(
  username: string,
  password: string,
  env: Env
): Promise<AuthTokens> {
  const name = username?.trim();
  if (!name || !password) {
    throw new Error("账号和密码不能为空");
  }

  const existing = await env.DB.prepare(
    `select id from t_user where username = ?`
  )
    .bind(name)
    .first<Pick<BookRow, "id">>();

  if (existing) {
    throw new Error("该账号已存在");
  }

  const result = await env.DB.prepare(
    `insert into t_user (username, password, nickname) values (?, ?, ?)`
  )
    .bind(name, password, name)
    .run();

  const userId = Number(result.meta.last_row_id);
  return issueTokens(userId, env);
}
