import * as userService from "../service/UserService";
import { jsonResponse } from "../response";
import type { Ctx } from "../context";

/** Return the authenticated user's info. */
export async function me(ctx: Ctx): Promise<Response> {
  const user = await userService.getUser(ctx.env, ctx.userId);
  return jsonResponse(user);
}
