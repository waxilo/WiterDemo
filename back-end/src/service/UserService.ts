import { createToken } from "../utils/token";

export async function getUserInfoById(userId, env) {

  const db = env.DB;


  const user = await db.prepare(`
      select *
      from t_user
      where id=?
      `)
    .bind(userId).first();


  if (!user) {
    throw new Error("账号信息不存在");
  }

  return user;

}