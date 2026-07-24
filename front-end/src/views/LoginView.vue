<script setup lang="ts">
import { ref, computed } from "vue";
import { useAuth } from "../composables/useAuth";

const {
  mode,
  username,
  password,
  confirmPassword,
  loading,
  error,
  switchMode,
  submit,
} = useAuth();
const showPassword = ref(false);
const showConfirm = ref(false);

const isRegister = computed(() => mode.value === "register");
const submitLabel = computed(() => {
  if (loading.value) return isRegister.value ? "注册中..." : "登录中...";
  return isRegister.value ? "注册" : "登录";
});
</script>

<template>
  <main class="page">
    <section class="login-card">
      <h1>{{ isRegister ? "注册" : "登录" }}</h1>
      <p class="subtitle">
        {{ isRegister ? "创建一个新账号开始使用。" : "欢迎回来，请登录以继续。" }}
      </p>

      <form class="form" @submit.prevent="submit">
        <label class="field">
          <span>账号</span>
          <input
            v-model="username"
            type="text"
            autocomplete="username"
            placeholder="请输入账号"
            :disabled="loading"
          />
        </label>

        <label class="field">
          <span>密码</span>
          <div class="password-wrap">
            <input
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              :autocomplete="isRegister ? 'new-password' : 'current-password'"
              placeholder="请输入密码"
              :disabled="loading"
            />
            <button
              type="button"
              class="toggle"
              :disabled="loading"
              :aria-label="showPassword ? '隐藏密码' : '显示密码'"
              @click="showPassword = !showPassword"
            >
              <svg
                v-if="showPassword"
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <svg
                v-else
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path
                  d="M9.9 4.24A9.12 9.12 0 0 1 12 4c6.5 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"
                />
                <path
                  d="M6.61 6.61A13.53 13.53 0 0 0 2 12s3.5 7 10 7a9.74 9.74 0 0 0 5.39-1.61"
                />
                <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                <line x1="2" y1="2" x2="22" y2="22" />
              </svg>
            </button>
          </div>
        </label>

        <label v-if="isRegister" class="field">
          <span>确认密码</span>
          <div class="password-wrap">
            <input
              v-model="confirmPassword"
              :type="showConfirm ? 'text' : 'password'"
              autocomplete="new-password"
              placeholder="请再次输入密码"
              :disabled="loading"
            />
            <button
              type="button"
              class="toggle"
              :disabled="loading"
              :aria-label="showConfirm ? '隐藏密码' : '显示密码'"
              @click="showConfirm = !showConfirm"
            >
              <svg
                v-if="showConfirm"
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <svg
                v-else
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path
                  d="M9.9 4.24A9.12 9.12 0 0 1 12 4c6.5 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"
                />
                <path
                  d="M6.61 6.61A13.53 13.53 0 0 0 2 12s3.5 7 10 7a9.74 9.74 0 0 0 5.39-1.61"
                />
                <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                <line x1="2" y1="2" x2="22" y2="22" />
              </svg>
            </button>
          </div>
        </label>

        <p v-if="error" class="error">{{ error }}</p>

        <button type="submit" class="submit" :disabled="loading">
          {{ submitLabel }}
        </button>
      </form>

      <p class="switch">
        <template v-if="isRegister">
          已有账号？
          <button type="button" class="link" @click="switchMode('login')">
            去登录
          </button>
        </template>
        <template v-else>
          还没有账号？
          <button type="button" class="link" @click="switchMode('register')">
            去注册
          </button>
        </template>
      </p>
    </section>
  </main>
</template>

<style scoped>
.page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background-color: #ffffff;
}

.login-card {
  width: 100%;
  max-width: 340px;
  text-align: left;
}

h1 {
  margin: 0 0 0.25rem;
  font-size: 1.6rem;
  color: #1a1a1a;
}

.subtitle {
  margin: 0 0 1.5rem;
  color: #888;
  font-size: 0.9rem;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.field span {
  font-size: 0.85rem;
  font-weight: 600;
  color: #444;
}

.field input {
  padding: 0.55em 0;
  font-size: 1em;
  border: none;
  border-bottom: 1px solid #d5d5d5;
  border-radius: 0;
  background-color: transparent;
  color: #1a1a1a;
  transition: border-color 0.2s;
}

.field input:focus {
  outline: none;
  border-bottom-color: #4f7cff;
}

.field input::placeholder {
  color: #bbb;
}

/* Hide the WebView2/Edge native password reveal & clear controls so only our
   custom eye toggle shows. */
.field input::-ms-reveal,
.field input::-ms-clear {
  display: none;
}

.password-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.password-wrap input {
  flex: 1;
  padding-right: 2.5rem;
  width: 100%;
}

.toggle {
  position: absolute;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.3em 0.4em;
  color: #999;
  background-color: transparent;
  border: none;
  cursor: pointer;
  transition: color 0.2s;
}

.toggle:hover:not(:disabled) {
  color: #4f7cff;
}

.toggle:disabled {
  color: #ccc;
  cursor: default;
}

.submit {
  margin-top: 1rem;
  padding: 0.8em 1em;
  font-size: 1em;
  font-weight: 600;
  color: #ffffff;
  background-color: #4f7cff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.submit:hover:not(:disabled) {
  background-color: #3d68e8;
}

.submit:disabled {
  opacity: 0.65;
  cursor: default;
}

.error {
  margin: 0;
  color: #e03131;
  font-size: 0.88rem;
}

.switch {
  margin: 1.25rem 0 0;
  text-align: center;
  font-size: 0.88rem;
  color: #888;
}

.link {
  padding: 0;
  font-size: 0.88rem;
  font-weight: 600;
  color: #4f7cff;
  background: transparent;
  border: none;
  cursor: pointer;
}

.link:hover {
  text-decoration: underline;
}
</style>
