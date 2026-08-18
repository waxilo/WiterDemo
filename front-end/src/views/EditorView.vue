<script setup lang="ts">
import { onMounted, onUnmounted, computed, ref, nextTick, watch } from "vue";
import type { useBooks } from "../composables/useBooks";
import type { useChapters } from "../composables/useChapters";
import ChapterList from "../components/ChapterList.vue";
import ChapterEditor from "../components/ChapterEditor.vue";
import { useConfirm } from "../composables/useConfirm";
import { showToast } from "../composables/useToast";
import { formatCount, getTextStats } from "../utils/textStats";

const confirm = useConfirm();

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
  saveError,
  select,
  create,
  remove,
  rename,
  duplicate,
  reorder,
  flush,
} = props.chapters;

/** Save-state indicator shown in the top bar (only when a chapter is open). */
const saveStatus = computed(() => {
  if (!current.value) return null;
  if (saving.value) return { text: "保存中", cls: "saving" };
  if (saveError.value) return { text: "保存失败", cls: "error" };
  if (dirty.value) return { text: "未保存", cls: "dirty" };
  return { text: "已保存", cls: "saved" };
});

// Surface save failures (e.g. a 409 conflict from another window) as a toast.
// Only toast when the message CHANGES — autosave retries after a failure and
// would otherwise re-toast the same message every few seconds.
watch(saveError, (message, previous) => {
  if (message && message !== previous) showToast(message, "error");
});

// --- word/char stats, debounced so typing never pays full-text cost ---------
const currentStats = ref(getTextStats(current.value?.content ?? ""));
let statsTimer: ReturnType<typeof setTimeout> | null = null;

watch(
  () => current.value?.content,
  () => {
    if (statsTimer !== null) clearTimeout(statsTimer);
    statsTimer = setTimeout(() => {
      currentStats.value = getTextStats(current.value?.content ?? "");
    }, 120);
  }
);

watch(
  () => current.value?.id,
  () => {
    // Chapter switch recomputes immediately (no need to wait for debounce).
    if (statsTimer !== null) clearTimeout(statsTimer);
    currentStats.value = getTextStats(current.value?.content ?? "");
  },
  { immediate: true }
);

const currentChapterNumber = computed(() => {
  if (!current.value) return null;
  const index = list.value.findIndex((chapter) => chapter.id === current.value?.id);
  return index < 0 ? null : index + 1;
});

const currentChapterLabel = computed(() =>
  currentChapterNumber.value === null ? "" : `第${currentChapterNumber.value}章`
);

const overallStats = computed(() =>
  list.value.reduce(
    (total, chapter) => {
      const isCurrent = chapter.id === current.value?.id;
      total.wordCount += isCurrent
        ? currentStats.value.wordCount
        : chapter.wordCount ?? 0;
      total.charCount += isCurrent
        ? currentStats.value.charCount
        : chapter.charCount ?? 0;
      return total;
    },
    { wordCount: 0, charCount: 0 }
  )
);

const now = ref(Date.now());
let relativeTimeTimer: ReturnType<typeof setInterval> | null = null;

const lastSavedText = computed(() => {
  const updateTime = current.value?.updateTime;
  if (!updateTime) return "尚未保存";
  const normalized = updateTime.includes("T")
    ? updateTime
    : `${updateTime.replace(" ", "T")}Z`;
  const savedAt = new Date(normalized).getTime();
  if (Number.isNaN(savedAt)) return "已保存";

  const elapsedSeconds = Math.max(0, Math.floor((now.value - savedAt) / 1000));
  if (elapsedSeconds < 60) return "刚刚";
  if (elapsedSeconds < 3600) return `${Math.floor(elapsedSeconds / 60)} 分钟前`;
  if (elapsedSeconds < 86400) return `${Math.floor(elapsedSeconds / 3600)} 小时前`;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
  }).format(savedAt);
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
  try {
    await props.books.rename(bookId.value, next);
  } catch (error) {
    showToast(error instanceof Error ? error.message : "重命名失败", "error");
  }
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
  relativeTimeTimer = setInterval(() => {
    now.value = Date.now();
  }, 30_000);
});

onUnmounted(() => {
  window.removeEventListener("keydown", onEsc);
  if (relativeTimeTimer !== null) clearInterval(relativeTimeTimer);
});

function onEsc(e: KeyboardEvent) {
  if (e.key === "Escape") closeMenu();
}

async function onBack() {
  try {
    await flush();
  } catch (error) {
    showToast(error instanceof Error ? error.message : "保存失败", "error");
  }
  props.books.backToShelf();
}

function onSelect(id: number) {
  select(id).catch((error: unknown) => {
    showToast(error instanceof Error ? error.message : "加载失败", "error");
  });
}

async function onCreate() {
  try {
    if (bookId.value !== null) await create(bookId.value);
  } catch (error) {
    showToast(error instanceof Error ? error.message : "创建失败", "error");
  }
}

async function onRemove(id: number) {
  const ok = await confirm({
    title: "删除章节？",
    message: "删除后该章节内容无法恢复。",
    confirmText: "删除",
    cancelText: "取消",
  });
  if (ok) {
    try {
      await remove(id);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "删除失败", "error");
    }
  }
}

async function onRename(id: number, title: string) {
  try {
    await rename(id, title);
  } catch (error) {
    showToast(error instanceof Error ? error.message : "重命名失败", "error");
  }
}

async function onDuplicate(id: number) {
  try {
    await duplicate(id);
  } catch (error) {
    showToast(error instanceof Error ? error.message : "复制失败", "error");
  }
}

function onReorder(ids: number[]) {
  if (bookId.value !== null) {
    reorder(bookId.value, ids).catch((error: unknown) => {
      showToast(error instanceof Error ? error.message : "排序失败", "error");
    });
  }
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
        <div class="title-line">
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
        <div v-if="current" class="writing-meta">
          <span>{{ currentChapterLabel }}</span>
          <span class="meta-separator">·</span>
          <Transition name="count" mode="out-in">
            <span :key="currentStats.wordCount" class="numeric">
              {{ formatCount(currentStats.wordCount) }} 字
            </span>
          </Transition>
          <span class="meta-separator">·</span>
          <span class="save-meta" :class="saveStatus?.cls">
            {{ saveStatus?.text }}
          </span>
        </div>
      </div>

      <div class="bar-right">
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
              <button class="menu-item" @click="closeMenu">个人设置</button>
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
        :current-word-count="currentStats.wordCount"
        :loading="loading"
        @select="onSelect"
        @create="onCreate"
        @remove="onRemove"
        @rename="onRename"
        @duplicate="onDuplicate"
        @reorder="onReorder"
      />
      <div class="editor-column">
        <ChapterEditor :chapters="chapters" />
        <footer class="writing-status">
          <div class="status-overall">
            全书 {{ list.length }} 章 ·
            {{ formatCount(overallStats.wordCount) }} 字
          </div>
          <div v-if="current" class="status-current">
            <span>{{ currentChapterLabel }}</span>
            <span>
              字数
              <Transition name="count" mode="out-in">
                <b :key="currentStats.wordCount">
                  {{ formatCount(currentStats.wordCount) }}
                </b>
              </Transition>
            </span>
            <span>
              字符
              <Transition name="count" mode="out-in">
                <b :key="currentStats.charCount">
                  {{ formatCount(currentStats.charCount) }}
                </b>
              </Transition>
            </span>
            <span>最后保存：{{ lastSavedText }}</span>
          </div>
          <div v-else class="status-current">选择章节后开始写作</div>
        </footer>
      </div>
    </div>
  </div>
</template>

<style scoped>
.workspace {
  height: 100vh;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  background: #f5f3ee;
  overflow: hidden;
}

/* ---- top bar ---- */
.topbar {
  height: 64px;
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
  min-width: 0;
}

.bar-center {
  justify-self: center;
  min-width: 0;
  max-width: 60vw;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.bar-right {
  justify-self: end;
  min-width: 0;
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

.title-line {
  width: 100%;
  min-width: 0;
}

.writing-meta {
  min-height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  font-size: 12px;
  line-height: 1.2;
  color: #888;
  white-space: nowrap;
}

.meta-separator {
  color: #bbb5aa;
}

.numeric,
.writing-status b {
  display: inline-block;
  font-weight: 400;
  font-variant-numeric: tabular-nums;
}

.save-meta.saving {
  color: #78849c;
}

.save-meta.dirty {
  color: #a48a56;
}

.save-meta.error {
  color: #c45d55;
  font-weight: 600;
}

.book-title:hover {
  background: rgba(0, 0, 0, 0.04);
}

.book-title-input {
  box-sizing: border-box;
  width: 100%;
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
  position: relative;
  flex: 1;
  display: flex;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.editor-column {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.writing-status b {
  display: inline-block;
  font-weight: 400;
  font-variant-numeric: tabular-nums;
}

.save-meta.saving {
  color: #78849c;
}

.save-meta.dirty {
  color: #a48a56;
}

.save-meta.error {
  color: #c45d55;
  font-weight: 600;
}

.book-title:hover {
  background: rgba(0, 0, 0, 0.04);
}

.book-title-input {
  box-sizing: border-box;
  width: 100%;
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
  position: relative;
  flex: 1;
  display: flex;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.editor-column {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.writing-status {
  box-sizing: border-box;
  min-height: 36px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 0 22px;
  color: #999;
  background: rgba(245, 243, 238, 0.92);
  border-top: 1px solid rgba(0, 0, 0, 0.035);
  font-size: 12px;
  line-height: 1;
}

.status-overall,
.status-current {
  display: flex;
  align-items: center;
  gap: 18px;
  white-space: nowrap;
}

.count-enter-active,
.count-leave-active {
  transition: opacity 0.14s ease, transform 0.14s ease;
}

.count-enter-from {
  opacity: 0;
  transform: translateY(3px);
}

.count-leave-to {
  opacity: 0;
  transform: translateY(-3px);
}

@media (max-width: 760px) {
  .topbar {
    height: 56px;
    grid-template-columns: 44px minmax(0, 1fr) 52px;
    padding: 0 8px;
  }

  .bar-center {
    width: 100%;
    max-width: none;
  }

  .bar-right {
    gap: 0;
  }

  .back {
    width: 40px;
    height: 40px;
    justify-content: center;
    padding: 0;
  }

  .back span,
  .uname,
  .chevron {
    display: none;
  }

  .book-title {
    max-width: 100%;
    padding-inline: 0.35em;
    font-size: 16px;
    text-align: center;
  }

  .writing-meta {
    gap: 3px;
    font-size: 11px;
  }

  .book-title-input {
    min-width: 0;
    font-size: 16px;
  }

  .status {
    margin-right: 6px;
  }

  .status .dot {
    width: 7px;
    height: 7px;
  }

  .user-trigger {
    padding: 4px;
  }

  .avatar {
    width: 32px;
    height: 32px;
  }

  .menu {
    position: fixed;
    top: 62px;
    right: 8px;
  }

  .writing-status {
    min-height: calc(36px + env(safe-area-inset-bottom));
    padding: 0 10px env(safe-area-inset-bottom);
    font-size: 11px;
  }

  .status-overall {
    display: none;
  }

  .status-current {
    width: 100%;
    justify-content: space-between;
    gap: 6px;
  }
}

@media (max-width: 390px) {
  .status-current span:last-child {
    display: none;
  }
}
</style>
