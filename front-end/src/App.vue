<script setup lang="ts">
import { computed, ref, watch, onMounted } from "vue";
import {
  sessionRef,
  clearSession,
  getRefreshToken,
} from "./api/tokenStore";
import { scheduleProactiveRefresh } from "./api/http";
import { getMe, logout as logoutApi } from "./api/auth";
import { useBooks } from "./composables/useBooks";
import { useChapters } from "./composables/useChapters";
import type { UserInfo } from "./types/auth";
import LoginView from "./views/LoginView.vue";
import BookshelfView from "./views/BookshelfView.vue";
import EditorView from "./views/EditorView.vue";
import ConfirmDialog from "./components/dialog/ConfirmDialog.vue";

const loggedIn = sessionRef();
const books = useBooks();
const chapters = useChapters();
const user = ref<UserInfo | null>(null);

// login -> bookshelf -> editor
const view = computed<"login" | "shelf" | "editor">(() => {
  if (!loggedIn.value) return "login";
  return books.currentId.value === null ? "shelf" : "editor";
});

const displayName = computed(
  () => user.value?.nickname || user.value?.username || ""
);

// Resume background token refresh if a session survived a reload.
onMounted(() => {
  if (getRefreshToken()) scheduleProactiveRefresh();
});

// Load the current user whenever we become logged in; clear it on logout.
watch(
  loggedIn,
  async (value) => {
    if (!value) {
      user.value = null;
      return;
    }
    try {
      user.value = await getMe();
    } catch {
      user.value = null;
    }
  },
  { immediate: true }
);

async function onLogout() {
  books.backToShelf();
  const rt = getRefreshToken();
  if (rt) {
    try {
      await logoutApi(rt);
    } catch {
      // ignore
    }
  }
  clearSession();
}
</script>

<template>
  <LoginView v-if="view === 'login'" />
  <BookshelfView
    v-else-if="view === 'shelf'"
    :books="books"
    :username="displayName"
    @logout="onLogout"
  />
  <EditorView
    v-else
    :books="books"
    :chapters="chapters"
    :username="displayName"
    @logout="onLogout"
  />

  <!-- 全局统一确认弹窗：整个项目共用此实例 -->
  <ConfirmDialog />
</template>

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
