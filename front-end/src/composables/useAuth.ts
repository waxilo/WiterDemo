import { ref } from "vue";
import { login as loginApi, register as registerApi } from "../api/auth";
import { tokenRef, setToken, clearToken } from "../api/tokenStore";

export type AuthMode = "login" | "register";

/**
 * Auth form state and submit logic for both login and registration. The token
 * is persisted via tokenStore (localStorage), so the session survives reloads
 * and a 401 can force logout. Registration auto-logs the user in on success.
 */
export function useAuth() {
  const mode = ref<AuthMode>("login");
  const username = ref("");
  const password = ref("");
  const confirmPassword = ref("");
  const loading = ref(false);
  const error = ref("");
  const token = tokenRef();

  /** Switch between login and register, clearing transient state. */
  function switchMode(next: AuthMode) {
    mode.value = next;
    error.value = "";
    password.value = "";
    confirmPassword.value = "";
  }

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

  async function register() {
    if (!username.value || !password.value) {
      error.value = "请输入账号和密码";
      return;
    }
    if (password.value !== confirmPassword.value) {
      error.value = "两次输入的密码不一致";
      return;
    }

    loading.value = true;
    error.value = "";
    try {
      const value = await registerApi({
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

  /** Submit the form according to the current mode. */
  function submit() {
    return mode.value === "login" ? login() : register();
  }

  function logout() {
    clearToken();
    error.value = "";
  }

  return {
    mode,
    username,
    password,
    confirmPassword,
    loading,
    error,
    token,
    switchMode,
    submit,
    login,
    register,
    logout,
  };
}
