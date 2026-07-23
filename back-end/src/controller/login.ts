import * as authService from "../service/AuthService";
import { jsonResponse } from "../response";

export async function login(request, env) {

  const body = await request.json();

  const result = await authService.login(body.username, body.password, env);

  return jsonResponse(result);

}