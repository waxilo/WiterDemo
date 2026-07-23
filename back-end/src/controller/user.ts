import * as userService from "../service/UserService";
import { jsonResponse } from "../response";

export async function login(request, env) {

  const body = await request.json();

  const result = await userService.getUserInfoById(body.userId, env);

  return jsonResponse(result);

}