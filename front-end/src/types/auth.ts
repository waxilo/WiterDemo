export interface LoginParams {
  username: string;
  password: string;
}

/** The backend returns the session token string in `data`. */
export type LoginResult = string;
