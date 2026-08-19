<script setup lang="ts">
import { ref, watch } from "vue";
import type { useChapters } from "../composables/useChapters";
import * as chapterApi from "../api/chapter";
import type { BookOutline, OutlineHeading } from "../types/chapter";
import { showToast } from "../composables/useToast";

/**
 * 右侧导航面板：解析行首 `#` 标记的标题，按层级展示。
 * - 章内：当前章节的标题，滚动时高亮当前所在标题，点击定位。
 * - 全书：所有章节的标题汇总（后端接口，只传标题不传正文），点击跳章并定位。
 */
const props = defineProps<{
  chapters: ReturnType<typeof useChapters>;
  bookId: number;
  /** 当前处于视口顶部的标题序号（-1 无），由父组件滚动监听驱动。 */
  activeIndex?: number;
}>();

const emit = defineEmits<{
  (e: "jump", index: number): void;
  (e: "jump-chapter", chapterId: number, headingIndex: number): void;
}>();

const scope = ref<"chapter" | "book">("chapter");
const headings = ref<OutlineHeading[]>([]);
const bookOutline = ref<BookOutline | null>(null);
const loadingBook = ref(false);
let parseTimer: ReturnType<typeof setTimeout> | null = null;

const HEADING_PATTERN = /^(#{1,6})\s+(.+)$/;

function parseHeadings(content: string): OutlineHeading[] {
  const result: OutlineHeading[] = [];
  for (const line of content.split("\n")) {
    const match = line.match(HEADING_PATTERN);
    if (match) {
      result.push({ level: match[1].length, text: match[2].trim() });
    }
  }
  return result;
}

// 防抖解析：打字时不阻塞，停顿后更新章内大纲。
watch(
  () => props.chapters.current.value?.content,
  () => {
    if (parseTimer !== null) clearTimeout(parseTimer);
    parseTimer = setTimeout(() => {
      headings.value = parseHeadings(
        props.chapters.current.value?.content ?? ""
      );
    }, 150);
  }
);

// 章节切换时立即解析。
watch(
  () => props.chapters.current.value?.id,
  () => {
    if (parseTimer !== null) clearTimeout(parseTimer);
    headings.value = parseHeadings(
      props.chapters.current.value?.content ?? ""
    );
  },
  { immediate: true }
);

// 切换到全书时拉取一次（每次进入都刷新，保证最新）。
watch(scope, (value) => {
  if (value === "book") void refreshBookOutline();
});

async function refreshBookOutline(): Promise<void> {
  loadingBook.value = true;
  try {
    bookOutline.value = await chapterApi.getBookOutline(props.bookId);
  } catch (error) {
    showToast(error instanceof Error ? error.message : "加载全书大纲失败", "error");
  } finally {
    loadingBook.value = false;
  }
}

function onJump(index: number): void {
  emit("jump", index);
}

function onJumpChapter(chapterId: number, headingIndex: number): void {
  emit("jump-chapter", chapterId, headingIndex);
}

const outlineBodyRef = ref<HTMLElement | null>(null);

// 当前激活标题变化时，让章内大纲列表滚动到该项可见。
watch(
  () => props.activeIndex,
  (index) => {
    if (typeof index !== "number" || index < 0) return;
    const body = outlineBodyRef.value;
    if (!body) return;
    const item = body.querySelector<HTMLElement>(
      `.outline-item[data-idx="${index}"]`
    );
    item?.scrollIntoView({ block: "nearest" });
  }
);
</script>

<template>
  <div class="outline">
    <div class="outline-head">
      <div class="outline-tabs" role="tablist">
        <button
          class="outline-tab"
          :class="{ active: scope === 'chapter' }"
          role="tab"
          :aria-selected="scope === 'chapter'"
          @click="scope = 'chapter'"
        >
          章内
        </button>
        <button
          class="outline-tab"
          :class="{ active: scope === 'book' }"
          role="tab"
          :aria-selected="scope === 'book'"
          @click="scope = 'book'"
        >
          全书
        </button>
      </div>
      <button
        v-if="scope === 'book'"
        class="outline-refresh"
        title="刷新全书大纲"
        aria-label="刷新全书大纲"
        :disabled="loadingBook"
        @click="refreshBookOutline"
      >
        ↻
      </button>
    </div>

    <!-- 章内模式 -->
    <template v-if="scope === 'chapter'">
      <div ref="outlineBodyRef" v-if="headings.length > 0" class="outline-body">
        <button
          v-for="(heading, index) in headings"
          :key="index"
          class="outline-item"
          :class="[
            `lv-${Math.min(heading.level, 6)}`,
            { active: index === activeIndex },
          ]"
          :data-idx="index"
          :title="heading.text"
          @click="onJump(index)"
        >
          <span class="outline-marker">{{ "#".repeat(heading.level) }}</span>
          <span class="outline-text">{{ heading.text }}</span>
        </button>
      </div>

      <div v-else class="outline-empty">
        <p>本段还没有标题</p>
        <p class="outline-hint">
          在行首输入 <code># 空格</code> 创建一级标题，<code>##</code>
          二级、<code>###</code> 三级…
        </p>
      </div>
    </template>

    <!-- 全书模式 -->
    <template v-else>
      <div v-if="loadingBook" class="outline-loading">加载中…</div>
      <div v-else-if="bookOutline && bookOutline.chapters.length > 0" class="outline-body book">
        <section
          v-for="chapter in bookOutline.chapters"
          :key="chapter.id"
          class="book-chapter"
          :class="{ active: chapter.id === chapters.current.value?.id }"
        >
          <div class="book-chapter-title">
            {{ chapter.title || "未命名章节" }}
            <span v-if="chapter.headings.length" class="outline-count">{{
              chapter.headings.length
            }}</span>
          </div>
          <button
            v-for="(heading, index) in chapter.headings"
            :key="index"
            class="outline-item"
            :class="`lv-${Math.min(heading.level, 6)}`"
            :title="heading.text"
            @click="onJumpChapter(chapter.id, index)"
          >
            <span class="outline-marker">{{ "#".repeat(heading.level) }}</span>
            <span class="outline-text">{{ heading.text }}</span>
          </button>
          <p v-if="chapter.headings.length === 0" class="book-no-headings">
            无标题
          </p>
        </section>
      </div>
      <div v-else class="outline-empty">
        <p>全书还没有任何标题</p>
        <p class="outline-hint">
          在行首输入 <code># 空格</code> 创建标题后，可在此总览全书结构
        </p>
      </div>
    </template>
  </div>
</template>

<style scoped>
.outline {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.outline-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 12px 8px;
}

.outline-tabs {
  display: flex;
  gap: 2px;
  padding: 2px;
  background: #f0eee7;
  border-radius: 8px;
}

.outline-tab {
  padding: 4px 12px;
  font-size: 12px;
  color: #8a8577;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.outline-tab.active {
  background: #fff;
  color: #444;
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.outline-refresh {
  width: 24px;
  height: 24px;
  font-size: 14px;
  color: #8a8577;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.outline-refresh:hover {
  background: #f0eee7;
  color: #444;
}

.outline-refresh:disabled {
  opacity: 0.5;
  cursor: default;
}

.outline-count {
  font-size: 11px;
  font-weight: 500;
  color: #b6b0a1;
  font-variant-numeric: tabular-nums;
}

.outline-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 2px 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.outline-item {
  display: flex;
  align-items: baseline;
  gap: 6px;
  width: 100%;
  padding: 5px 8px;
  font-size: 12.5px;
  line-height: 1.45;
  text-align: left;
  color: #555;
  background: transparent;
  border: none;
  border-radius: 7px;
  cursor: pointer;
  transition: background 0.14s ease, color 0.14s ease;
}

.outline-item:hover {
  background: rgba(0, 0, 0, 0.05);
  color: #222;
}

.outline-item.active {
  background: #e8edfb;
  color: #2b4bcf;
  font-weight: 600;
}

.outline-item.lv-1 {
  font-weight: 600;
  color: #3a3a3a;
}

.outline-item.lv-2 {
  padding-left: 18px;
}

.outline-item.lv-3 {
  padding-left: 30px;
  font-size: 12px;
}

.outline-item.lv-4 {
  padding-left: 42px;
  font-size: 12px;
  color: #777;
}

.outline-item.lv-5,
.outline-item.lv-6 {
  padding-left: 54px;
  font-size: 11.5px;
  color: #888;
}

.outline-marker {
  flex-shrink: 0;
  font-size: 10px;
  color: #c9c2b2;
  font-variant-numeric: tabular-nums;
}

.outline-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ---- book-wide mode ---- */
.outline-body.book {
  gap: 4px;
}

.book-chapter {
  padding: 6px 2px 8px;
  border-bottom: 1px dashed rgba(0, 0, 0, 0.06);
}

.book-chapter.active {
  background: rgba(79, 110, 247, 0.05);
  border-radius: 8px;
  padding-left: 6px;
  padding-right: 6px;
}

.book-chapter-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 4px 8px 6px;
  font-size: 12px;
  font-weight: 700;
  color: #4a4a44;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.book-no-headings {
  margin: 0;
  padding: 2px 8px 4px;
  font-size: 11px;
  color: #c0baab;
}

.outline-loading {
  padding: 20px;
  text-align: center;
  font-size: 12px;
  color: #b6b0a1;
}

.outline-empty {
  padding: 16px 14px;
  text-align: center;
}

.outline-empty p {
  margin: 0 0 6px;
  font-size: 12px;
  color: #b6b0a1;
}

.outline-hint {
  line-height: 1.7;
  color: #c5bfb0 !important;
}

.outline-hint code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  background: rgba(0, 0, 0, 0.05);
  padding: 1px 4px;
  border-radius: 4px;
}
</style>
