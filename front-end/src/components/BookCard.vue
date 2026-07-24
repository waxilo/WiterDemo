<script setup lang="ts">
import type { Book } from "../types/chapter";

defineProps<{ book: Book }>();
const emit = defineEmits<{
  (e: "open", id: number): void;
  (e: "remove", id: number): void;
}>();
</script>

<template>
  <div class="card" @click="emit('open', book.id)">
    <button
      class="delete"
      title="删除"
      @click.stop="emit('remove', book.id)"
    >
      ×
    </button>
    <div class="cover">{{ book.title.slice(0, 1) }}</div>
    <div class="title">{{ book.title }}</div>
    <div class="meta">{{ book.updateTime }}</div>
  </div>
</template>

<style scoped>
.card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem;
  border: 1px solid #eee;
  border-radius: 10px;
  cursor: pointer;
  background: #fff;
  transition: box-shadow 0.2s, transform 0.2s;
}

.card:hover {
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.08);
  transform: translateY(-2px);
}

.delete {
  position: absolute;
  top: 0.4rem;
  right: 0.4rem;
  width: 1.5rem;
  height: 1.5rem;
  line-height: 1;
  border: none;
  border-radius: 50%;
  background: #f1f3f5;
  color: #868e96;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s;
}

.card:hover .delete {
  opacity: 1;
}

.delete:hover {
  background: #ffe3e3;
  color: #e03131;
}

.cover {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 90px;
  border-radius: 8px;
  background: linear-gradient(135deg, #4f7cff, #7048e8);
  color: #fff;
  font-size: 2rem;
  font-weight: 700;
}

.title {
  font-weight: 600;
  color: #1a1a1a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.meta {
  font-size: 0.78rem;
  color: #adb5bd;
}
</style>
