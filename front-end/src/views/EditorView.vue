<script setup lang="ts">
import { onMounted, onUnmounted, computed, ref, nextTick } from "vue";
import type { useBooks } from "../composables/useBooks";
import type { useChapters } from "../composables/useChapters";
import ChapterList from "../components/ChapterList.vue";
import ChapterEditor from "../components/ChapterEditor.vue";

const props = defineProps<{
  books: ReturnType<typeof useBooks>;
  chapters: ReturnType<typeof useChapters>;
  username: string;
}>();
const emit = defineEmits<{ (e: "logout"): void }>();

// Avatar initial for the user menu (falls back to a neutral glyph).
const avatarText = computed(() => props.username?.trim().charAt(0).toUpperCase() || "○");

const bookId = computed(() => props.books.currentId.value);
const bookTitle = computed(() => props.books.current.value?.title ?? "");

const {
  list,
  current,
  loading,
  saving,
  dirty,
  select,
  create,
  remove,
  reorder,
  flush,
} = props.chapters;

/** Save-state indicator shown in the top bar (only when a chapter is open). */
const saveStatus = computed(() => {
  if (!current.value) return null;
  if (saving.value) return { text: "保存中", cls: "saving" };
  if (dirty.value) return { text: "未保存", cls: "dirty" };
  return { text: "已保存", cls: "saved" };
});

// --- book title inline rename (double-click) ---------------------------------
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

// --- user menu ---------------------------------------------------------------
const menuOpen = ref(false);

function toggleMenu() {
  menuOpen.value = !menuOpen.value;
}

function closeMenu() {
  menuOpen.value = false;
}

function onLogout() {
  closeMenu();
  emit("logout");
}

// --- navigation --------------------------------------------------------------
onMounted(() => {
  if (bookId.value !== null) void props.chapters.loadList(bookId.value);
  window.addEventListener("keydown", onEsc);
});

onUnmounted(() => window.removeEventListener("keydown", onEsc));

function onEsc(e: KeyboardEvent) {
  if (e.key === "Escape") closeMenu();
}

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

function onReorder(ids: number[]) {
  if (bookId.value !== null) void reorder(bookId.value, ids);
}
</script>

<template>
  <div class="workspace">
    <header class="topbar">
      <div class="bar-left">
        <button class="back" @click="onBack">
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path
              d="M15 18l-6-6 6-6"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <span>书架</span>
        </button>
      </div>

      <div class="bar-center">
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
      </div>

      <div class="bar-right">
        <Transition name="fade">
          <span v-if="saveStatus" class="status" :class="saveStatus.cls">
            <span class="dot"></span>{{ saveStatus.text }}
          </span>
        </Transition>

        <div class="user">
          <button
            class="user-trigger"
            :class="{ open: menuOpen }"
            @click.stop="toggleMenu"
          >
            <span class="avatar">{{ avatarText }}</span>
            <span class="uname">{{ username || "用户" }}</span>
            <svg class="chevron" viewBox="0 0 24 24" width="14" height="14">
              <path
                d="M6 9l6 6 6-6"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>

          <Transition name="menu">
            <div v-if="menuOpen" class="menu" @click.stop>
              <button class="menu-item" @click="closeMenu">个人中心</button>
              <button class="menu-item" @click="closeMenu">设置</button>
              <button class="menu-item" @click="closeMenu">主题</button>
              <div class="menu-sep"></div>
              <button class="menu-item danger" @click="onLogout">
                退出登录
              </button>
            </div>
          </Transition>
        </div>
      </div>
    </header>

    <!-- click-away layer for the user menu -->
    <div v-if="menuOpen" class="menu-backdrop" @click="closeMenu"></div>

    <div class="panes">
      <ChapterList
        :chapters="list"
        :current-id="current?.id ?? null"
        :loading="loading"
        @select="onSelect"
        @create="onCreate"
        @remove="onRemove"
        @reorder="onReorder"
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
  background: #f5f3ee;
}

/* ---- top bar ---- */
.topbar {
  height: 58px;
  flex-shrink: 0;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  padding: 0 24px;
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: saturate(180%) blur(16px);
  -webkit-backdrop-filter: saturate(180%) blur(16px);
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  z-index: 20;
}

.bar-left {
  justify-self: start;
}

.bar-center {
  justify-self: center;
  min-width: 0;
  max-width: 60vw;
}

.bar-right {
  justify-self: end;
  display: flex;
  align-items: center;
  gap: 0.9rem;
}

.back {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.45em 0.85em;
  font-size: 0.9rem;
  color: #555;
  background: transparent;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.18s ease, color 0.18s ease, transform 0.18s ease;
}

.back:hover {
  background: rgba(0, 0, 0, 0.05);
  color: #222;
}

.back:active {
  transform: scale(0.97);
}

.book-title {
  display: block;
  font-size: 18px;
  font-weight: 600;
  color: #2a2a2a;
  letter-spacing: 0.01em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 0.25em 0.55em;
  border-radius: 8px;
  cursor: default;
  transition: background 0.2s ease;
}

.book-title:hover {
  background: rgba(0, 0, 0, 0.04);
}

.book-title-input {
  font-size: 18px;
  font-weight: 600;
  color: #2a2a2a;
  text-align: center;
  padding: 0.25em 0.6em;
  border: 1px solid #dcd7cb;
  border-radius: 8px;
  outline: none;
  background: #fffdf8;
  min-width: 220px;
}

.status {
  display: inline-flex;
  align-items: center;
  gap: 0.45em;
  font-size: 0.8rem;
  color: #888;
  opacity: 0.85;
  user-select: none;
}

.status .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #8ba57b;
  transition: background 0.3s ease;
}

.status.saving .dot {
  background: #7f95d8;
}

.status.dirty .dot {
  background: #cbb06a;
}

/* ---- user menu ---- */
.user {
  position: relative;
}

.user-trigger {
  display: inline-flex;
  align-items: center;
  gap: 0.5em;
  padding: 0.3em 0.5em 0.3em 0.35em;
  background: transparent;
  border: none;
  border-radius: 999px;
  cursor: pointer;
  color: #555;
  transition: background 0.2s ease;
}

.user-trigger:hover,
.user-trigger.open {
  background: rgba(0, 0, 0, 0.05);
}

.avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, #eef1f7, #e3e8f2);
  color: #6b7a9c;
  font-size: 0.8rem;
  font-weight: 700;
}

.uname {
  font-size: 0.88rem;
  font-weight: 500;
  color: #444;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chevron {
  color: #aaa;
  transition: transform 0.2s ease;
}

.user-trigger.open .chevron {
  transform: rotate(180deg);
}

.menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  min-width: 168px;
  padding: 6px;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.07);
  border-radius: 12px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.12);
  z-index: 30;
}

.menu-item {
  display: block;
  width: 100%;
  padding: 0.55em 0.7em;
  font-size: 0.88rem;
  text-align: left;
  color: #444;
  background: transparent;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.menu-item:hover {
  background: #f5f4f0;
}

.menu-item.danger {
  color: #d9645a;
}

.menu-item.danger:hover {
  background: rgba(217, 100, 90, 0.09);
}

.menu-sep {
  height: 1px;
  margin: 6px 4px;
  background: rgba(0, 0, 0, 0.06);
}

.menu-backdrop {
  position: fixed;
  inset: 0;
  z-index: 15;
}

/* ---- transitions ---- */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.menu-enter-active,
.menu-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.menu-enter-from,
.menu-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

/* ---- body ---- */
.panes {
  flex: 1;
  display: flex;
  min-height: 0;
}
</style>
