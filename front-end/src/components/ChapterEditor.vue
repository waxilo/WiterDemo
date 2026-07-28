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

@media (max-width: 760px) {
  .desk {
    padding: 8px 8px 0;
  }

  .paper-scroll {
    max-width: none;
    border-radius: 10px 10px 0 0;
    box-shadow: 0 6px 24px rgba(0, 0, 0, 0.05);
  }

  .paper {
    --line: 32px;
    --bind: 12px;
    --rule-offset: -6px;
    padding: 28px 18px 56px;
    font-size: 16px;
    text-align: left;
  }

  .paper-scroll::-webkit-scrollbar {
    width: 4px;
  }

  .paper-scroll::-webkit-scrollbar-thumb {
    border-width: 1px;
  }
}
</style>
