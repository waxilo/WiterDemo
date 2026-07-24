import { createToken } from "../utils/token";
import type { BookRow } from "../types";

/**
 * Validate credentials and, on success, issue a signed token.
 * Throws on invalid credentials.
 */
export async function login(
  username: string,
  password: string,
  env: Env
): Promise<string> {
  const user = await env.DB.prepare(
    `select id from t_user where username = ? and password = ?`
  )
    .bind(username, password)
    .first<Pick<BookRow, "id">>();

  if (!user) {
    throw new Error("账号密码错误");
  }

  return createToken(user.id, env);
}

/**
 * Register a new user and, on success, issue a signed token (auto login).
 * Throws if the username is taken or the input is invalid.
 */
export async function register(
  username: string,
  password: string,
  env: Env
): Promise<string> {
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
  return createToken(userId, env);
}
