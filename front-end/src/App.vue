<script setup lang="ts">
import { computed } from "vue";
import { tokenRef, clearToken } from "./api/tokenStore";
import { useBooks } from "./composables/useBooks";
import { useChapters } from "./composables/useChapters";
import LoginView from "./views/LoginView.vue";
import BookshelfView from "./views/BookshelfView.vue";
import EditorView from "./views/EditorView.vue";

const token = tokenRef();
const books = useBooks();
const chapters = useChapters();

// login -> bookshelf -> editor
const view = computed<"login" | "shelf" | "editor">(() => {
  if (!token.value) return "login";
  return books.currentId.value === null ? "shelf" : "editor";
});

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
    username="admin"
    @logout="onLogout"
  />
  <EditorView v-else :books="books" :chapters="chapters" @logout="onLogout" />
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
