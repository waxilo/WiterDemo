<script setup lang="ts">
import { ref } from "vue";
import { useAuth } from "./composables/useAuth";

const { username, password, loading, error, token, login, logout } = useAuth();

// Toggle password visibility.
const showPassword = ref(false);
</script>

<template>
  <main class="page">
    <section class="login-card">
      <h1>Sign in</h1>
      <p class="subtitle">Welcome back, please log in to continue.</p>

      <form class="form" @submit.prevent="login">
        <label class="field">
          <span>Username</span>
          <input
            v-model="username"
            type="text"
            autocomplete="username"
            placeholder="admin"
            :disabled="loading || !!token"
          />
        </label>

        <label class="field">
          <span>Password</span>
          <div class="password-wrap">
            <input
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="current-password"
              placeholder="••••••"
              :disabled="loading || !!token"
            />
            <button
              type="button"
              class="toggle"
              :disabled="loading || !!token"
              :aria-label="showPassword ? 'Hide password' : 'Show password'"
              @click="showPassword = !showPassword"
            >
              {{ showPassword ? "Hide" : "Show" }}
            </button>
          </div>
        </label>

        <p v-if="error" class="error">{{ error }}</p>

        <button v-if="!token" type="submit" class="submit" :disabled="loading">
          {{ loading ? "Signing in..." : "Sign in" }}
        </button>
      </form>

      <div v-if="token" class="success">
        <p class="success-title">Signed in successfully</p>
        <code class="token">{{ token }}</code>
        <button type="button" class="logout" @click="logout">Log out</button>
      </div>
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
  padding: 0;
  background-color: transparent;
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

.success {
  margin-top: 1.25rem;
  padding-top: 1.25rem;
  border-top: 1px solid #eee;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.success-title {
  margin: 0;
  color: #2f9e44;
  font-weight: 600;
}

.token {
  display: block;
  padding: 0.6rem 0.75rem;
  border-radius: 8px;
  background-color: #f1f3f5;
  color: #333;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.8rem;
  word-break: break-all;
}

.logout {
  align-self: flex-start;
  padding: 0.5em 1em;
  font-size: 0.9em;
  color: #4f7cff;
  background-color: transparent;
  border: 1px solid #4f7cff;
  border-radius: 8px;
  cursor: pointer;
}

.logout:hover {
  background-color: rgba(79, 124, 255, 0.08);
}
</style>

<style>
:root {
  font-family: Inter, Avenir, Helvetica, Arial, sans-serif;
  font-size: 16px;
  line-height: 1.5;
  font-weight: 400;
  color: #1a1a1a;

  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
}
</style>
