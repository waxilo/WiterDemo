import { checkToken } from "../utils/token";
import type { Ctx } from "../context";

export interface AuthResult {
  success: boolean;
  message?: string;
  userId?: number;
}

/**
 * Stateless auth check: verify the Bearer token's signature and expiry, and
 * return the embedded user id. No database access.
 */
export async function checkAuth(ctx: Ctx): Promise<AuthResult> {
  const header = ctx.request.headers.get("Authorization");
  if (!header) {
    return { success: false, message: "未登录" };
  }

  const token = header.replace("Bearer ", "");
  const result = await checkToken(token, ctx.env);
  if (!result.success || result.userId === undefined) {
    return { success: false, message: "请重新登录" };
  }

  return { success: true, userId: result.userId };
}
