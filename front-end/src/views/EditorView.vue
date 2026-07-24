<script setup lang="ts">
import { onMounted, computed, ref, nextTick } from "vue";
import type { useBooks } from "../composables/useBooks";
import type { useChapters } from "../composables/useChapters";
import ChapterList from "../components/ChapterList.vue";
import ChapterEditor from "../components/ChapterEditor.vue";

const props = defineProps<{
  books: ReturnType<typeof useBooks>;
  chapters: ReturnType<typeof useChapters>;
}>();
const emit = defineEmits<{ (e: "logout"): void }>();

const bookId = computed(() => props.books.currentId.value);
const bookTitle = computed(() => props.books.current.value?.title ?? "");

const editingTitle = ref(false);
const titleDraft = ref("");
const titleInput = ref<HTMLInputElement | null>(null);

function startEditTitle() {
  titleDraft.value = bookTitle.value;
  editingTitle.value = true;
  void nextTick(() => {
    titleInput.value?.focus();
    titleInput.value?.select();
  });
}

async function saveTitle() {
  if (!editingTitle.value) return;
  editingTitle.value = false;
  const next = titleDraft.value.trim();
  if (bookId.value === null || !next || next === bookTitle.value) return;
  await props.books.rename(bookId.value, next);
}

function cancelEditTitle() {
  editingTitle.value = false;
}

const { list, current, loading, select, create, remove, flush } =
  props.chapters;

onMounted(() => {
  if (bookId.value !== null) void props.chapters.loadList(bookId.value);
});

async function onBack() {
  await flush();
  props.books.backToShelf();
}

function onSelect(id: number) {
  void select(id);
}

async function onCreate() {
  if (bookId.value !== null) await create(bookId.value);
}

async function onRemove(id: number) {
  if (confirm("确定删除该章节？")) await remove(id);
}
</script>

<template>
  <div class="workspace">
    <header class="topbar">
      <button class="back" @click="onBack">← 返回书架</button>
      <input
        v-if="editingTitle"
        ref="titleInput"
        v-model="titleDraft"
        class="book-title-input"
        @keyup.enter="saveTitle"
        @keyup.esc="cancelEditTitle"
        @blur="saveTitle"
      />
      <span
        v-else
        class="book-title"
        title="双击修改书名"
        @dblclick="startEditTitle"
        >{{ bookTitle }}</span
      >
      <button class="logout" @click="emit('logout')">退出登录</button>
    </header>

    <div class="panes">
      <ChapterList
        :chapters="list"
        :current-id="current?.id ?? null"
        :loading="loading"
        @select="onSelect"
        @create="onCreate"
        @remove="onRemove"
      />
      <ChapterEditor :chapters="chapters" />
    </div>
  </div>
</template>

<style scoped>
.workspace {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.topbar {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.6rem 1.25rem;
  border-bottom: 1px solid #eee;
  background: #fff;
}

.back {
  padding: 0.4em 0.9em;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  background: transparent;
  color: #495057;
  cursor: pointer;
}

.back:hover {
  background: #f1f3f5;
}

.book-title {
  flex: 1;
  font-weight: 600;
  color: #1a1a1a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: text;
}

.book-title-input {
  flex: 1;
  min-width: 0;
  font-weight: 600;
  font-size: 1em;
  color: #1a1a1a;
  padding: 0.2em 0.4em;
  border: 1px solid #4f7cff;
  border-radius: 6px;
  outline: none;
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

.panes {
  flex: 1;
  display: flex;
  min-height: 0;
}
</style>
