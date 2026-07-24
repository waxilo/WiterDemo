export interface LoginParams {
  username: string;
  password: string;
}

/** The backend returns the session token string in `data`. */
export type LoginResult = string;

/** Current user info returned by GET /me. */
export interface UserInfo {
  id: number;
  username: string;
  nickname: string | null;
  avatar: string | null;
}
