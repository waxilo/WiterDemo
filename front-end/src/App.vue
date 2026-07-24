<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { tokenRef, clearToken } from "./api/tokenStore";
import { getMe } from "./api/auth";
import { useBooks } from "./composables/useBooks";
import { useChapters } from "./composables/useChapters";
import type { UserInfo } from "./types/auth";
import LoginView from "./views/LoginView.vue";
import BookshelfView from "./views/BookshelfView.vue";
import EditorView from "./views/EditorView.vue";

const token = tokenRef();
const books = useBooks();
const chapters = useChapters();
const user = ref<UserInfo | null>(null);

// login -> bookshelf -> editor
const view = computed<"login" | "shelf" | "editor">(() => {
  if (!token.value) return "login";
  return books.currentId.value === null ? "shelf" : "editor";
});

const displayName = computed(
  () => user.value?.nickname || user.value?.username || ""
);

// Load the current user whenever a token appears; clear it on logout.
watch(
  token,
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

function onLogout() {
  books.backToShelf();
  clearToken();
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
