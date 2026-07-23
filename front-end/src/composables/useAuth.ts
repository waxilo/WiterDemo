import { ref } from "vue";
import { login as loginApi } from "../api/auth";

/**
 * Login form state and submit logic. Holds the credentials, request status,
 * and the token returned on success.
 */
export function useAuth() {
  const username = ref("admin");
  const password = ref("123456");
  const loading = ref(false);
  const error = ref("");
  const token = ref("");

  async function login() {
    if (!username.value || !password.value) {
      error.value = "Please enter username and password";
      return;
    }

    loading.value = true;
    error.value = "";
    token.value = "";
    try {
      token.value = await loginApi({
        username: username.value,
        password: password.value,
      });
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      loading.value = false;
    }
  }

  function logout() {
    token.value = "";
    error.value = "";
  }

  return { username, password, loading, error, token, login, logout };
}
