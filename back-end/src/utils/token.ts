// Stateless signed auth tokens (compact JWT, HS256).
// The token embeds { uid, iat, exp } and is signed with TOKEN_SECRET, so it can
// be verified without a database lookup.

import type { TokenCheck } from "../types";

const EXPIRE_SECONDS = 7 * 24 * 60 * 60;

const HEADER = { alg: "HS256", typ: "JWT" };

interface Payload {
  uid: number;
  iat: number;
  exp: number;
}

/** URL-safe base64 encode a UTF-8 string. */
function base64UrlEncode(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Decode a URL-safe base64 string back to UTF-8. */
function base64UrlDecode(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

/** Compute the HS256 signature (URL-safe base64) over `${header}.${payload}`. */
async function sign(signingInput: string, secret: string): Promise<string> {
  const key = await importKey(secret);
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(signingInput)
  );
  let binary = "";
  const bytes = new Uint8Array(sig);
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Issue a signed token for the given user id. */
export async function createToken(userId: number, env: Env): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: Payload = { uid: userId, iat: now, exp: now + EXPIRE_SECONDS };

  const encodedHeader = base64UrlEncode(JSON.stringify(HEADER));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = await sign(signingInput, env.TOKEN_SECRET);

  return `${signingInput}.${signature}`;
}

/** Verify a token's signature and expiry; return the user id on success. */
export async function checkToken(token: string, env: Env): Promise<TokenCheck> {
  const parts = token.split(".");
  if (parts.length !== 3) return { success: false };

  const [encodedHeader, encodedPayload, signature] = parts;
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const expected = await sign(signingInput, env.TOKEN_SECRET);
  const sigBytes = new TextEncoder().encode(signature);
  const expectedBytes = new TextEncoder().encode(expected);
  if (
    sigBytes.byteLength !== expectedBytes.byteLength ||
    !crypto.subtle.timingSafeEqual(sigBytes, expectedBytes)
  ) {
    return { success: false };
  }

  let payload: Payload;
  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload)) as Payload;
  } catch {
    return { success: false };
  }

  if (typeof payload.uid !== "number" || typeof payload.exp !== "number") {
    return { success: false };
  }
  if (payload.exp * 1000 <= Date.now()) {
    return { success: false };
  }

  return { success: true, userId: payload.uid };
}
