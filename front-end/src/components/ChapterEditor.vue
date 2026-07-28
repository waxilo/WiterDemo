<script setup lang="ts">
import { onMounted, onUnmounted, computed, ref, watch, nextTick } from "vue";
import type { useChapters } from "../composables/useChapters";

const props = defineProps<{ chapters: ReturnType<typeof useChapters> }>();
const { current, save, scheduleAutoSave } = props.chapters;

const editorRef = ref<HTMLElement | null>(null);

/** Indent inserted by Tab while writing. */
const TAB_INDENT = "\t";

/** Placeholder shows only when the current chapter has no content. */
const isEmpty = computed(() => !current.value?.content);

/**
 * Load the chapter text into the contenteditable ONLY when the open chapter
 * changes. We never write the DOM back during typing, so the caret stays put.
 * (Setting innerText on every render is what makes the caret jump to the
 * start.)
 */
watch(
  () => current.value?.id,
  async () => {
    await nextTick();
    if (editorRef.value) editorRef.value.innerText = current.value?.content ?? "";
  },
  { immediate: true }
);

function onInput(e: Event) {
  if (!current.value) return;
  current.value.content = (e.target as HTMLElement).innerText;
  scheduleAutoSave();
}

function onKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
    e.preventDefault();
    void save();
  }
}

/** Insert indent at the caret instead of moving focus out of the editor. */
function onEditorKeydown(e: KeyboardEvent) {
  if (e.key !== "Tab" || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
  e.preventDefault();
  if (!current.value || !editorRef.value) return;

  const inserted = document.execCommand("insertText", false, TAB_INDENT);
  if (!inserted) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    range.deleteContents();
    const textNode = document.createTextNode(TAB_INDENT);
    range.insertNode(textNode);
    range.setStartAfter(textNode);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    current.value.content = editorRef.value.innerText;
    scheduleAutoSave();
  }
}

onMounted(() => window.addEventListener("keydown", onKeydown));
onUnmounted(() => window.removeEventListener("keydown", onKeydown));
</script>

<template>
  <section class="desk">
    <template v-if="current">
      <!--
        Scroll on the outer frame so the paper can grow with content.
        Background rules live on .paper (not the scrollport), which avoids
        mobile Safari cutting off lines and drifting with attachment: local.
      -->
      <div class="paper-scroll">
        <article
          :key="current.id"
          class="paper"
          :class="{ 'is-empty': isEmpty }"
          data-placeholder="开始写作……"
          contenteditable="plaintext-only"
          spellcheck="false"
          ref="editorRef"
          @input="onInput"
          @keydown="onEditorKeydown"
        ></article>
      </div>
    </template>

    <div v-else class="placeholder-state">
      <p>从左侧选择一个章节开始写作</p>
    </div>
  </section>
</template>

<style scoped>
.desk {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  justify-content: center;
  align-items: stretch;
  padding: 18px 32px 0;
  background: #f5f3ee;
  overflow: hidden;
}

.paper-scroll {
  flex: 1;
  min-width: 0;
  min-height: 0;
  max-width: 780px;
  width: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  border-radius: 12px 12px 0 0;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.06);
  background: #fffdf8;
  animation: paper-in 0.28s ease both;
}

/*
 * Manuscript rules:
 *   1. left binding line
 *   2. ruled lines tiled exactly to --line (must match line-height)
 *   3. paper fill
 * Tile height uses background-size so text never drifts from the rules.
 */
.paper {
  --line: 36px;
  --bind: 48px;
  --rule-offset: -6px;
  box-sizing: border-box;
  width: 100%;
  min-height: 100%;
  padding: 72px 72px 96px;
  outline: none;
  border: none;

  font-family: "Source Han Serif SC", "Noto Serif SC", "Songti SC", "STSong",
    "思源宋体", serif;
  font-size: 18px;
  line-height: var(--line);
  color: #333;
  caret-color: #4f6ef7;
  text-align: justify;
  word-break: break-word;
  white-space: pre-wrap;
  tab-size: 2;

  background-color: #fffdf8;
  background-image:
    linear-gradient(
      to right,
      transparent 0 calc(var(--bind) - 1px),
      rgba(255, 120, 120, 0.18) calc(var(--bind) - 1px) var(--bind),
      transparent var(--bind)
    ),
    linear-gradient(
      to bottom,
      transparent calc(var(--line) - 1px),
      rgba(120, 120, 120, 0.12) 0
    ),
    linear-gradient(#fffdf8, #fffdf8);
  background-size: 100% 100%, 100% var(--line), 100% 100%;
  background-repeat: no-repeat, repeat-y, no-repeat;
  background-origin: border-box, content-box, border-box;
  background-clip: border-box, content-box, border-box;
  /*
   * Chinese glyphs sit above the bottom of their line box. Lift the rule so
   * it follows the visual baseline instead of leaving a large gap below text.
   */
  background-position: 0 0, 0 var(--rule-offset), 0 0;
}

.paper.is-empty::before {
  content: attr(data-placeholder);
  color: #bbb;
  pointer-events: none;
}

.paper ::selection {
  background: rgba(79, 110, 247, 0.15);
}

.paper-scroll::-webkit-scrollbar {
  width: 10px;
}

.paper-scroll::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.12);
  border: 3px solid #fffdf8;
  border-radius: 999px;
}

.paper-scroll::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.2);
}

@keyframes paper-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.placeholder-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  text-align: center;
  color: #b6b0a1;
  font-size: 0.95rem;
}

/*
 * ---- 移动端阅读布局（≤768px）----
 * 目标：接近微信读书 / 番茄小说的沉浸式阅读体验。
 * 纸张铺满整屏，不再缩放 PC 版式；左右留白由 .paper 的 padding 承担。
 */
@media (max-width: 768px) {
  .desk {
    /* 内容区占满屏宽，取消 PC 的桌面留白 */
    padding: 0;
    overflow-x: hidden;
  }

  .paper-scroll {
    /* 移除 PC 的 780px 固定宽度限制 */
    max-width: none;
    width: 100%;
    border-radius: 0;
    box-shadow: none;
    /* 自然纵向滚动，且不把滚动传递给外层 */
    overscroll-behavior-y: contain;
    -webkit-overflow-scrolling: touch;
  }

  .paper {
    /*
     * 稿纸横线必须与行高 1:1 对齐，否则文字会从横线上漂走。
     * 18px 正文 + 40px 行高 ≈ 2.2 倍行距，横线密度相比原来的 32px
     * 降低约 25%，接近真实稿纸又不干扰阅读。
     */
    --line: 40px;
    --bind: 10px;
    /* 行高变大后中文字形离行底更远，横线要多抬一点才贴着视觉基线 */
    --rule-offset: -8px;

    /*
     * 上留白同时避开章节栏收起后的悬浮按钮（left/top 12px，36px 见方），
     * 左右 22px 落在 20~24px 的舒适区间。
     */
    padding: 56px 22px 72px;

    font-family: "Noto Serif SC", "Source Han Serif SC", "思源宋体",
      "Source Han Serif CN", "Songti SC", "STSong", serif;
    font-size: 18px;
    letter-spacing: 0.01em;
    /* 窄屏两端对齐会拉出难看的字间空隙，改为左对齐 + 自然换行 */
    text-align: left;
    word-break: break-word;
    overflow-wrap: break-word;

    /* 文字渲染优化 */
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;

    /*
     * 首行缩进沿用写作时插入的制表符（TAB_INDENT + tab-size: 2），
     * 正好等于 2 个汉字宽度。这里不叠加 text-indent，否则第一段会缩进 4 字。
     */
    tab-size: 2;
  }

  /* 细滚动条：手机端本身用系统 overlay，这里主要照顾窄窗口的桌面浏览器 */
  .paper-scroll::-webkit-scrollbar {
    width: 3px;
  }

  .paper-scroll::-webkit-scrollbar-thumb {
    border: none;
  }
}
</style>
