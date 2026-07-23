import { checkToken } from "../utils/token";


export async function checkAuth(request, env) {

  const header = request.headers.get("Authorization");


  if (!header) {

    return {
      success: false,
      message: "未登录"
    };
  }


  const token = header.replace("Bearer ", "");

  const checkResult = checkToken(token);

  if (!checkResult.success) {
    return { success: false, message: "请重新登录" };
  }


  const record = await env.DB.prepare(
    `
      select *
      from t_login_log
      where uuid=?
      ` )
    .bind(checkResult.uuid)
    .first();

  return {
    success: true,
    userId: record.user_id
  };
}