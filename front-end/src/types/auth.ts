export interface LoginParams {
  username: string;
  password: string;
}

/** The backend returns an access + refresh token pair on login/register/refresh. */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  /** Access token lifetime in seconds. */
  expiresIn: number;
}

export type LoginResult = AuthTokens;

/** Current user info returned by GET /me. */
export interface UserInfo {
  id: number;
  username: string;
  nickname: string | null;
  avatar: string | null;
}
