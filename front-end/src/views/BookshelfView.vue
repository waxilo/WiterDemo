<script setup lang="ts">
import { onMounted } from "vue";
import type { useBooks } from "../composables/useBooks";
import BookCard from "../components/BookCard.vue";

const props = defineProps<{
  books: ReturnType<typeof useBooks>;
  username: string;
}>();
const emit = defineEmits<{ (e: "logout"): void }>();

const { list, loading, error, loadList, open, create, remove } = props.books;

onMounted(loadList);

async function onCreate() {
  await create();
}

async function onRemove(id: number) {
  if (confirm("确定删除这本书及其所有章节？")) {
    await remove(id);
  }
}
</script>

<template>
  <div class="shelf">
    <header class="topbar">
      <div class="brand">写作助手</div>
      <div class="right">
        <span class="user">{{ username }}</span>
        <button class="logout" @click="emit('logout')">退出登录</button>
      </div>
    </header>

    <main class="content">
      <h2>我的书架</h2>
      <p v-if="error" class="error">{{ error }}</p>
      <p v-if="loading" class="hint">加载中…</p>

      <div class="grid">
        <BookCard
          v-for="book in list"
          :key="book.id"
          :book="book"
          @open="open"
          @remove="onRemove"
        />
        <button class="add" @click="onCreate">
          <span class="plus">+</span>
          <span>新建书籍</span>
        </button>
      </div>
    </main>
  </div>
</template>

<style scoped>
.shelf {
  min-height: 100vh;
  background: #fafafa;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1.5rem;
  background: #fff;
  border-bottom: 1px solid #eee;
}

.brand {
  font-weight: 700;
  color: #1a1a1a;
}

.right {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.user {
  color: #666;
  font-size: 0.9rem;
}

.logout {
  padding: 0.4em 0.9em;
  font-size: 0.85rem;
  color: #4f7cff;
  background: transparent;
  border: 1px solid #4f7cff;
  border-radius: 6px;
  cursor: pointer;
}

.logout:hover {
  background: rgba(79, 124, 255, 0.08);
}

.content {
  max-width: 960px;
  margin: 0 auto;
  padding: 1.5rem;
}

h2 {
  margin: 0 0 1rem;
  color: #1a1a1a;
}

.error {
  color: #e03131;
}

.hint {
  color: #888;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 1rem;
}

.add {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-height: 168px;
  border: 1px dashed #ced4da;
  border-radius: 10px;
  background: transparent;
  color: #868e96;
  cursor: pointer;
  transition: border-color 0.2s, color 0.2s;
}

.add:hover {
  border-color: #4f7cff;
  color: #4f7cff;
}

.plus {
  font-size: 2rem;
  line-height: 1;
}
</style>
