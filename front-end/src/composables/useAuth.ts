import { ref } from "vue";
import { login as loginApi } from "../api/auth";
import { tokenRef, setToken, clearToken } from "../api/tokenStore";

/**
 * Login form state and submit logic. The token is persisted via tokenStore
 * (localStorage), so the session survives reloads and a 401 can force logout.
 */
export function useAuth() {
  const username = ref("admin");
  const password = ref("123456");
  const loading = ref(false);
  const error = ref("");
  const token = tokenRef();

  async function login() {
    if (!username.value || !password.value) {
      error.value = "请输入账号和密码";
      return;
    }

    loading.value = true;
    error.value = "";
    try {
      const value = await loginApi({
        username: username.value,
        password: password.value,
      });
      setToken(value);
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      loading.value = false;
    }
  }

  function logout() {
    clearToken();
    error.value = "";
  }

  return { username, password, loading, error, token, login, logout };
}
