import * as authService from "../service/AuthService";
import { jsonResponse } from "../response";
import type { Ctx } from "../context";

interface LoginBody {
  username: string;
  password: string;
}

export async function login(ctx: Ctx): Promise<Response> {
  const body = await ctx.json<LoginBody>();
  const token = await authService.login(body.username, body.password, ctx.env);
  return jsonResponse(token);
}

export async function register(ctx: Ctx): Promise<Response> {
  const body = await ctx.json<LoginBody>();
  const token = await authService.register(
    body.username,
    body.password,
    ctx.env
  );
  return jsonResponse(token);
}
