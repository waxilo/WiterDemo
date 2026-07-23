import { createToken } from "../utils/token";

export async function login(username, password, env) {

  const db = env.DB;


  const user = await db.prepare(`
      select *
      from t_user
      where username=?
      and password=?
      `)
    .bind(username, password).first();


  if (!user) {

    throw new Error("账号密码错误");

  }

  const token = createToken();

  return token.value;

}