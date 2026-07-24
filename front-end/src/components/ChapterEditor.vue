<script setup lang="ts">
import { onMounted, onUnmounted, computed, ref, watch, nextTick } from "vue";
import type { useChapters } from "../composables/useChapters";

const props = defineProps<{ chapters: ReturnType<typeof useChapters> }>();
const { current, save, scheduleAutoSave } = props.chapters;

const editorRef = ref<HTMLElement | null>(null);

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

onMounted(() => window.addEventListener("keydown", onKeydown));
onUnmounted(() => window.removeEventListener("keydown", onKeydown));
</script>

<template>
  <section class="desk">
    <template v-if="current">
      <article
        :key="current.id"
        class="paper"
        :class="{ 'is-empty': isEmpty }"
        data-placeholder="开始写作……"
        contenteditable="plaintext-only"
        spellcheck="false"
        ref="editorRef"
        @input="onInput"
      ></article>
    </template>

    <div v-else class="placeholder-state">
      <p>从左侧选择一个章节开始写作</p>
    </div>
  </section>
</template>

<style scoped>
/* Writing desk: warm neutral backdrop that frames the sheet. */
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

/*
 * The sheet. A single centered page that scrolls internally, so it stays put
 * (and stays centered) while you write.
 *
 * The manuscript rules are pure CSS, layered as three backgrounds:
 *   1. left binding line  (border-box, full height)
 *   2. faint writing rules (content-box, so top/side margins stay clean)
 *   3. solid paper fill    (border-box)
 * background-attachment: local keeps the rules scrolling with the text, so
 * every line always sits on a rule.
 */
.paper {
  --line: 36px;
  box-sizing: border-box;
  width: 100%;
  max-width: 780px;
  height: 100%;
  overflow-y: auto;
  padding: 72px 72px 96px;
  border-radius: 12px 12px 0 0;
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

  background-color: #fffdf8;
  background-image:
    linear-gradient(
      to right,
      transparent 0 47px,
      rgba(255, 120, 120, 0.18) 47px 48px,
      transparent 48px
    ),
    repeating-linear-gradient(
      to bottom,
      transparent 0 35px,
      rgba(120, 120, 120, 0.12) 35px 36px
    ),
    linear-gradient(#fffdf8, #fffdf8);
  background-repeat: no-repeat, repeat, no-repeat;
  background-origin: border-box, content-box, border-box;
  background-clip: border-box, content-box, border-box;
  background-attachment: local, local, local;

  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.06);
  animation: paper-in 0.28s ease both;
}

/* placeholder for the empty contenteditable */
.paper.is-empty::before {
  content: attr(data-placeholder);
  color: #bbb;
  pointer-events: none;
}

.paper ::selection {
  background: rgba(79, 110, 247, 0.15);
}

/* subtle scrollbar so it doesn't intrude on the page feel */
.paper::-webkit-scrollbar {
  width: 10px;
}

.paper::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.12);
  border: 3px solid #fffdf8;
  border-radius: 999px;
}

.paper::-webkit-scrollbar-thumb:hover {
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

/* empty state (no chapter selected) */
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

  .paper {
    --line: 32px;
    max-width: none;
    padding: 28px 18px 56px;
    border-radius: 10px 10px 0 0;
    font-size: 16px;
    text-align: left;
    background-image:
      linear-gradient(
        to right,
        transparent 0 11px,
        rgba(255, 120, 120, 0.14) 11px 12px,
        transparent 12px
      ),
      repeating-linear-gradient(
        to bottom,
        transparent 0 31px,
        rgba(120, 120, 120, 0.1) 31px 32px
      ),
      linear-gradient(#fffdf8, #fffdf8);
    box-shadow: 0 6px 24px rgba(0, 0, 0, 0.05);
  }

  .paper::-webkit-scrollbar {
    width: 4px;
  }

  .paper::-webkit-scrollbar-thumb {
    border-width: 1px;
  }
}
</style>
