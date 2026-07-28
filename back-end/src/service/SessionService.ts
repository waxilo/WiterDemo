// Refresh-token session store, backed by t_login_log. A session is created at
// login and rotated on every refresh (old session revoked, new one inserted),
// which enables logout and stolen-token replay detection.

import { sha256Hex } from "../utils/token";

interface SessionRow {
  id: number;
  user_id: number;
  jti: string;
  revoked: number;
  /** Refresh token lifetime in ms (a duration, relative to `login_time`). */
  token_expire_ms: number;
  /** Derived in SQL: `login_time + token_expire_ms`, as ms since epoch. */
  expire_at_ms: number;
}

/** Register a new refresh-token session (stores only the token hash). */
export async function createSession(
  env: Env,
  userId: number,
  jti: string,
  token: string,
  ttlMs: number
): Promise<void> {
  const hash = await sha256Hex(token);
  await env.DB.prepare(
    `insert into t_login_log (user_id, token, token_expire_ms, jti, revoked, last_used)
     values (?, ?, ?, ?, 0, CURRENT_TIMESTAMP)`
  )
    .bind(userId, hash, ttlMs, jti)
    .run();
}

/**
 * Look up an active (not revoked, not expired) session by jti.
 * `token_expire_ms` is a lifetime, so the absolute expiry is computed from
 * `login_time` (stored by SQLite as UTC) inside SQL.
 */
export async function getActiveSession(
  env: Env,
  jti: string
): Promise<SessionRow | null> {
  const row = await env.DB.prepare(
    `select id, user_id, jti, revoked, token_expire_ms,
            strftime('%s', login_time) * 1000 + token_expire_ms as expire_at_ms
     from t_login_log where jti = ?`
  )
    .bind(jti)
    .first<SessionRow>();

  if (!row) return null;
  if (row.revoked === 1) return null;
  if (row.expire_at_ms <= Date.now()) return null;
  return row;
}

/**
 * Rotate a session: revoke the old jti (recording which jti superseded it, for
 * replay detection) and insert the new session, in one batch.
 */
export async function rotateSession(
  env: Env,
  userId: number,
  oldJti: string,
  newJti: string,
  newToken: string,
  newTtlMs: number
): Promise<void> {
  const hash = await sha256Hex(newToken);
  await env.DB.batch([
    env.DB.prepare(
      `update t_login_log set revoked = 1, rotated_to = ?, last_used = CURRENT_TIMESTAMP where jti = ?`
    ).bind(newJti, oldJti),
    env.DB.prepare(
      `insert into t_login_log (user_id, token, token_expire_ms, jti, revoked, last_used)
       values (?, ?, ?, ?, 0, CURRENT_TIMESTAMP)`
    ).bind(userId, hash, newTtlMs, newJti),
  ]);
}

/** Revoke a single session (logout). */
export async function revokeSession(env: Env, jti: string): Promise<void> {
  await env.DB.prepare(`update t_login_log set revoked = 1 where jti = ?`)
    .bind(jti)
    .run();
}

/** Revoke every session for a user (used on refresh-token replay detection). */
export async function revokeAllForUser(
  env: Env,
  userId: number
): Promise<void> {
  await env.DB.prepare(
    `update t_login_log set revoked = 1 where user_id = ? and revoked = 0`
  )
    .bind(userId)
    .run();
}
