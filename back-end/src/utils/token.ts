const EXPIRE =
  7 * 24 * 60 * 60;


export function createToken() {

  const uuid = crypto.randomUUID();


  const issuedAt = Math.floor(Date.now() / 1000);


  const expiredAt = issuedAt + EXPIRE;


  return {
    uuid,
    issuedAt,
    expiredAt,
    value: `${issuedAt}@${uuid}@${expiredAt}`

  };

}

export function checkToken(token) {

  const uuid = crypto.randomUUID();

  return { "success": true, "uuid": uuid };
}