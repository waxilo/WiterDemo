<script setup lang="ts">
import type { ChapterSummary } from "../types/chapter";

defineProps<{
  chapters: ChapterSummary[];
  currentId: number | null;
  loading: boolean;
}>();
const emit = defineEmits<{
  (e: "select", id: number): void;
  (e: "create"): void;
  (e: "remove", id: number): void;
}>();
</script>

<template>
  <aside class="list">
    <div class="head">
      <span>章节</span>
      <button class="add" title="新建章节" @click="emit('create')">+</button>
    </div>

    <p v-if="!loading && chapters.length === 0" class="hint">
      还没有章节，点击 + 新建
    </p>

    <ul>
      <li
        v-for="ch in chapters"
        :key="ch.id"
        :class="{ active: ch.id === currentId }"
        @click="emit('select', ch.id)"
      >
        <span class="name">{{ ch.title }}</span>
        <button class="del" title="删除" @click.stop="emit('remove', ch.id)">
          ×
        </button>
      </li>
    </ul>

    <div v-if="loading" class="loading-overlay">
      <span class="spinner"></span>
      <span>加载中…</span>
    </div>
  </aside>
</template>

<style scoped>
.list {
  position: relative;
  width: 240px;
  flex-shrink: 0;
  border-right: 1px solid #eee;
  background: #fafafa;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.loading-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  color: #666;
  font-size: 0.85rem;
  background: rgba(250, 250, 250, 0.6);
  backdrop-filter: blur(1px);
  z-index: 2;
}

.spinner {
  width: 1.1rem;
  height: 1.1rem;
  border: 2px solid #c7d2fe;
  border-top-color: #4f7cff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  font-weight: 600;
  color: #444;
  border-bottom: 1px solid #eee;
}

.add {
  width: 1.6rem;
  height: 1.6rem;
  border: none;
  border-radius: 6px;
  background: #edf0ff;
  color: #4f7cff;
  font-size: 1.1rem;
  line-height: 1;
  cursor: pointer;
}

.add:hover {
  background: #dce3ff;
}

.hint {
  padding: 0.75rem 1rem;
  color: #adb5bd;
  font-size: 0.85rem;
}

ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.6rem 1rem;
  cursor: pointer;
  color: #333;
  border-left: 3px solid transparent;
}

li:hover {
  background: #f1f3f5;
}

li.active {
  background: #edf0ff;
  border-left-color: #4f7cff;
  color: #4f7cff;
  font-weight: 600;
}

.name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.del {
  border: none;
  background: transparent;
  color: #adb5bd;
  cursor: pointer;
  opacity: 0;
  font-size: 1rem;
}

li:hover .del {
  opacity: 1;
}

.del:hover {
  color: #e03131;
}
</style>
