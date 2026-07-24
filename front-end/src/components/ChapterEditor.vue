<script setup lang="ts">
import { onMounted, onUnmounted, computed } from "vue";
import type { useChapters } from "../composables/useChapters";

const props = defineProps<{ chapters: ReturnType<typeof useChapters> }>();
const { current, saving, dirty, save, scheduleAutoSave } = props.chapters;

const status = computed(() => {
  if (saving.value) return { text: "保存中…", cls: "saving" };
  if (dirty.value) return { text: "未保存", cls: "dirty" };
  return { text: "已保存", cls: "saved" };
});

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
  <section class="editor">
    <template v-if="current">
      <div class="bar">
        <input
          class="title"
          v-model="current.title"
          placeholder="章节标题"
          @input="scheduleAutoSave"
        />
        <span class="status" :class="status.cls">{{ status.text }}</span>
      </div>
      <textarea
        class="body"
        v-model="current.content"
        placeholder="开始写作…（Ctrl+S 保存，停止输入片刻自动保存）"
        @input="scheduleAutoSave"
      ></textarea>
    </template>
    <div v-else class="empty">从左侧选择一个章节，或新建一个章节</div>
  </section>
</template>

<style scoped>
.editor {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.bar {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1.25rem;
  border-bottom: 1px solid #eee;
}

.title {
  flex: 1;
  font-size: 1.1rem;
  font-weight: 600;
  border: none;
  outline: none;
  color: #1a1a1a;
  background: transparent;
}

.status {
  font-size: 0.8rem;
  padding: 0.2em 0.6em;
  border-radius: 999px;
  white-space: nowrap;
}

.status.saved {
  color: #2f9e44;
  background: #ebfbee;
}

.status.dirty {
  color: #e8590c;
  background: #fff4e6;
}

.status.saving {
  color: #1971c2;
  background: #e7f5ff;
}

.body {
  flex: 1;
  border: none;
  outline: none;
  resize: none;
  padding: 1.25rem;
  font-size: 1rem;
  line-height: 1.7;
  color: #333;
  font-family: inherit;
}

.empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #adb5bd;
}
</style>
