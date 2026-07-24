<script setup lang="ts">
import { ref } from "vue";
import { useAuth } from "../composables/useAuth";

const { username, password, loading, error, login } = useAuth();
const showPassword = ref(false);
</script>

<template>
  <main class="page">
    <section class="login-card">
      <h1>登录</h1>
      <p class="subtitle">欢迎回来，请登录以继续。</p>

      <form class="form" @submit.prevent="login">
        <label class="field">
          <span>账号</span>
          <input
            v-model="username"
            type="text"
            autocomplete="username"
            placeholder="admin"
            :disabled="loading"
          />
        </label>

        <label class="field">
          <span>密码</span>
          <div class="password-wrap">
            <input
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="current-password"
              placeholder="••••••"
              :disabled="loading"
            />
            <button
              type="button"
              class="toggle"
              :disabled="loading"
              :aria-label="showPassword ? '隐藏密码' : '显示密码'"
              @click="showPassword = !showPassword"
            >
              {{ showPassword ? "隐藏" : "显示" }}
            </button>
          </div>
        </label>

        <p v-if="error" class="error">{{ error }}</p>

        <button type="submit" class="submit" :disabled="loading">
          {{ loading ? "登录中..." : "登录" }}
        </button>
      </form>
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

.password-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.password-wrap input {
  flex: 1;
  padding-right: 3.5rem;
  width: 100%;
}

.toggle {
  position: absolute;
  right: 0;
  padding: 0.3em 0.6em;
  font-size: 0.8rem;
  font-weight: 600;
  color: #4f7cff;
  background-color: transparent;
  border: none;
  cursor: pointer;
}

.toggle:hover:not(:disabled) {
  text-decoration: underline;
}

.toggle:disabled {
  color: #aaa;
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
</style>
