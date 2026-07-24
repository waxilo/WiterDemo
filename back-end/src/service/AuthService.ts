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
