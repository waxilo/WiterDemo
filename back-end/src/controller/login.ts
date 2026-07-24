import * as authService from "../service/AuthService";
import * as sessionService from "../service/SessionService";
import {
  createAccessToken,
  createRefreshToken,
  verifyRefresh,
  ACCESS_TTL,
} from "../utils/token";
import { jsonResponse } from "../response";
import type { Ctx } from "../context";

interface LoginBody {
  username: string;
  password: string;
}

interface RefreshBody {
  refreshToken: string;
}

export async function login(ctx: Ctx): Promise<Response> {
  const body = await ctx.json<LoginBody>();
  const tokens = await authService.login(body.username, body.password, ctx.env);
  return jsonResponse(tokens);
}

export async function register(ctx: Ctx): Promise<Response> {
  const body = await ctx.json<LoginBody>();
  const tokens = await authService.register(
    body.username,
    body.password,
    ctx.env
  );
  return jsonResponse(tokens);
}

/**
 * Exchange a valid refresh token for a new token pair, rotating the refresh
 * session. A refresh token whose session is missing/revoked is treated as a
 * possible replay: all of that user's sessions are revoked.
 */
export async function refresh(ctx: Ctx): Promise<Response> {
  const body = await ctx.json<RefreshBody>().catch(() => ({} as RefreshBody));
  const check = await verifyRefresh(body.refreshToken ?? "", ctx.env);
  if (!check.success || check.uid === undefined || !check.jti) {
    return jsonResponse(null, 401, "请重新登录");
  }

  const session = await sessionService.getActiveSession(ctx.env, check.jti);
  if (!session) {
    // Unknown/revoked jti with a valid signature -> possible replay.
    await sessionService.revokeAllForUser(ctx.env, check.uid);
    return jsonResponse(null, 401, "登录状态已失效");
  }

  const accessToken = await createAccessToken(check.uid, ctx.env);
  const {
    token: newRefresh,
    jti: newJti,
    expMs,
  } = await createRefreshToken(check.uid, ctx.env);
  await sessionService.rotateSession(
    ctx.env,
    check.uid,
    check.jti,
    newJti,
    newRefresh,
    expMs
  );

  return jsonResponse({
    accessToken,
    refreshToken: newRefresh,
    expiresIn: ACCESS_TTL,
  });
}

/** Revoke the current refresh session (logout). Always succeeds. */
export async function logout(ctx: Ctx): Promise<Response> {
  const body = await ctx.json<RefreshBody>().catch(() => ({} as RefreshBody));
  if (body.refreshToken) {
    const check = await verifyRefresh(body.refreshToken, ctx.env);
    if (check.success && check.jti) {
      await sessionService.revokeSession(ctx.env, check.jti);
    }
  }
  return jsonResponse({ ok: true });
}
