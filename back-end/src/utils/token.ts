// Stateless signed auth tokens (compact JWT, HS256).
//
// Two token types share the same JWT machinery but use different secrets and
// TTLs, and carry a `typ` claim so an access token can never be used where a
// refresh token is expected (and vice versa):
//   - access  : short-lived (ACCESS_TTL), verified on every API request.
//   - refresh : long-lived (REFRESH_TTL), carries a `jti` and is only accepted
//               at /refresh, cross-checked against a server-side session.

import type { TokenCheck } from "../types";

export const ACCESS_TTL = 15 * 60; // 15 minutes
export const REFRESH_TTL = 30 * 24 * 60 * 60; // 30 days

const HEADER = { alg: "HS256", typ: "JWT" };

type TokenType = "access" | "refresh";

interface AccessPayload {
  uid: number;
  iat: number;
  exp: number;
  typ: "access";
}

interface RefreshPayload {
  uid: number;
  iat: number;
  exp: number;
  typ: "refresh";
  jti: string;
}

type AnyPayload = AccessPayload | RefreshPayload;

/** Result of verifying a refresh token. */
export interface RefreshCheck {
  success: boolean;
  uid?: number;
  jti?: string;
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

/** Sign a JWT with the given payload claims, TTL and secret. */
async function signJwt(
  claims: Record<string, unknown>,
  ttlSeconds: number,
  secret: string
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload = { ...claims, iat: now, exp: now + ttlSeconds };

  const encodedHeader = base64UrlEncode(JSON.stringify(HEADER));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = await sign(signingInput, secret);
  return `${signingInput}.${signature}`;
}

/** Verify a JWT's signature and expiry with the given secret; return payload. */
async function verifyJwt<T extends AnyPayload>(
  token: string,
  secret: string
): Promise<T | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, signature] = parts;
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const expected = await sign(signingInput, secret);
  const sigBytes = new TextEncoder().encode(signature);
  const expectedBytes = new TextEncoder().encode(expected);
  if (
    sigBytes.byteLength !== expectedBytes.byteLength ||
    !crypto.subtle.timingSafeEqual(sigBytes, expectedBytes)
  ) {
    return null;
  }

  let payload: T;
  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload)) as T;
  } catch {
    return null;
  }

  if (typeof payload.exp !== "number" || payload.exp * 1000 <= Date.now()) {
    return null;
  }
  return payload;
}

/** Issue a short-lived access token for the given user id. */
export function createAccessToken(userId: number, env: Env): Promise<string> {
  return signJwt(
    { uid: userId, typ: "access" satisfies TokenType },
    ACCESS_TTL,
    env.TOKEN_SECRET
  );
}

/** Issue a long-lived refresh token; returns the token plus its jti/expiry. */
export async function createRefreshToken(
  userId: number,
  env: Env
): Promise<{ token: string; jti: string; expMs: number }> {
  const jti = crypto.randomUUID();
  const token = await signJwt(
    { uid: userId, typ: "refresh" satisfies TokenType, jti },
    REFRESH_TTL,
    env.REFRESH_SECRET
  );
  return { token, jti, expMs: (Math.floor(Date.now() / 1000) + REFRESH_TTL) * 1000 };
}

/** Verify an access token; returns the embedded user id on success. */
export async function verifyAccess(
  token: string,
  env: Env
): Promise<TokenCheck> {
  const payload = await verifyJwt<AccessPayload>(token, env.TOKEN_SECRET);
  if (!payload || payload.typ !== "access" || typeof payload.uid !== "number") {
    return { success: false };
  }
  return { success: true, userId: payload.uid };
}

/** Verify a refresh token; returns the embedded user id and jti on success. */
export async function verifyRefresh(
  token: string,
  env: Env
): Promise<RefreshCheck> {
  const payload = await verifyJwt<RefreshPayload>(token, env.REFRESH_SECRET);
  if (
    !payload ||
    payload.typ !== "refresh" ||
    typeof payload.uid !== "number" ||
    typeof payload.jti !== "string"
  ) {
    return { success: false };
  }
  return { success: true, uid: payload.uid, jti: payload.jti };
}

/** SHA-256 hash (hex) of a string; used to store refresh tokens at rest. */
export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input)
  );
  const bytes = new Uint8Array(digest);
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}
