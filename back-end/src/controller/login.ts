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
  const ip = ctx.request.headers.get("CF-Connecting-IP") ?? "";
  const tokens = await authService.login(
    body.username,
    body.password,
    ctx.env,
    ip
  );
  return jsonResponse(tokens);
}

export async function register(ctx: Ctx): Promise<Response> {
  const body = await ctx.json<LoginBody>();
  const ip = ctx.request.headers.get("CF-Connecting-IP") ?? "";
  const tokens = await authService.register(
    body.username,
    body.password,
    ctx.env,
    ip
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

  const session = await sessionService.getActiveSession(
    ctx.env,
    check.uid,
    check.jti
  );
  if (!session) {
    // Distinguish a genuine replay (no session row at all) from a concurrent
    // refresh that just rotated this jti (row exists, revoked=1). The latter
    // is normal multi-tab behavior and must not punish every device; the
    // client retries with the newest refresh token from its local storage.
    const row = await sessionService.findSession(ctx.env, check.uid, check.jti);
    if (!row) {
      // Valid signature but no record -> the session was never created or was
      // purged; treat as a possible replay.
      await sessionService.revokeAllForUser(ctx.env, check.uid);
      return jsonResponse(null, 401, "登录状态已失效");
    }
    // Revoked (just rotated elsewhere) or expired -> let the client retry.
    return jsonResponse(null, 401, "请重新登录");
  }

  const accessToken = await createAccessToken(check.uid, ctx.env);
  const {
    token: newRefresh,
    jti: newJti,
    expMs,
  } = await createRefreshToken(check.uid, ctx.env);
  const rotated = await sessionService.rotateSession(
    ctx.env,
    check.uid,
    check.jti,
    newJti,
    newRefresh,
    expMs
  );
  if (!rotated) {
    // A concurrent refresh rotated this session first (edge of the race);
    // the client will retry with the newest token it holds.
    return jsonResponse(null, 401, "请重新登录");
  }

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
