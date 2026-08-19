<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, computed } from "vue";
import BaseDialog from "./dialog/BaseDialog.vue";
import * as writerApi from "../api/writer";
import type { Entry, EntryType } from "../types/writer";
import { ENTRY_TYPE_LABELS } from "../types/writer";
import { useConfirm } from "../composables/useConfirm";
import { showToast } from "../composables/useToast";

/**
 * 设定条目编辑弹层：标题 + 内容，防抖自动保存，可删除。
 * 关闭前立即保存未落盘修改。
 */
const props = defineProps<{ entryId: number }>();

const emit = defineEmits<{
  (e: "close", entry: Entry | null): void;
  (e: "saved", entry: Entry): void;
  (e: "deleted"): void;
}>();

const confirm = useConfirm();

const entry = ref<Entry | null>(null);
const loading = ref(true);
const saveState = ref<"saved" | "saving" | "dirty">("saved");
let saveTimer: ReturnType<typeof setTimeout> | null = null;

onMounted(async () => {
  try {
    entry.value = await writerApi.getEntry(props.entryId);
  } catch (error) {
    showToast(error instanceof Error ? error.message : "加载条目失败", "error");
  } finally {
    loading.value = false;
  }
});

// 标题/内容变更 → 防抖自动保存。
watch(
  [() => entry.value?.title, () => entry.value?.content],
  () => {
    if (!entry.value) return;
    saveState.value = "dirty";
    if (saveTimer !== null) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      void persist();
    }, 800);
  }
);

async function persist(): Promise<void> {
  const current = entry.value;
  if (!current) return;
  saveTimer = null;
  saveState.value = "saving";
  try {
    const saved = await writerApi.updateEntry(current.id, {
      title: current.title,
      content: current.content,
    });
    // 字段级同步（不替换对象，避免输入框 v-model 重新绑定）。
    if (entry.value) {
      entry.value.title = saved.title;
      entry.value.content = saved.content;
    }
    saveState.value = "saved";
    emit("saved", saved);
  } catch (error) {
    saveState.value = "dirty";
    showToast(error instanceof Error ? error.message : "保存失败", "error");
  }
}

function close(): void {
  if (saveTimer !== null) {
    clearTimeout(saveTimer);
    saveTimer = null;
    void persist();
  }
  emit("close", entry.value);
}

async function onRemove(): Promise<void> {
  const ok = await confirm({
    title: "删除条目？",
    message: "删除后该条目的内容无法恢复。",
    confirmText: "删除",
  });
  if (!ok) return;
  // 取消挂起的自动保存：删除后卸载时的 persist 会对已删除条目报 404。
  if (saveTimer !== null) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  try {
    await writerApi.deleteEntry(props.entryId);
    emit("deleted");
    emit("close", null);
  } catch (error) {
    showToast(error instanceof Error ? error.message : "删除失败", "error");
  }
}

const saveStateText = computed(() => {
  if (saveState.value === "saving") return "保存中…";
  if (saveState.value === "dirty") return "未保存";
  return "已保存";
});

onBeforeUnmount(() => {
  if (saveTimer !== null) {
    clearTimeout(saveTimer);
    saveTimer = null;
    void persist();
  }
});
</script>

<template>
  <BaseDialog :visible="true" :close-on-mask="false" @close="close">
    <div v-if="loading" class="entry-loading">加载中…</div>
    <template v-else-if="entry">
      <div class="entry-head">
        <span class="entry-type-badge" :class="entry.type">{{
          ENTRY_TYPE_LABELS[entry.type as EntryType]
        }}</span>
        <span class="entry-save-state" :class="saveState">{{
          saveStateText
        }}</span>
      </div>
      <input
        v-model="entry.title"
        class="entry-title-input"
        placeholder="未命名条目"
        aria-label="条目标题"
        spellcheck="false"
      />
      <textarea
        v-model="entry.content"
        class="entry-content"
        placeholder="记录这个设定的一切……"
        spellcheck="false"
      ></textarea>
      <div class="entry-actions">
        <button class="entry-delete" @click="onRemove">删除条目</button>
        <button class="entry-close" @click="close">完成</button>
      </div>
    </template>
  </BaseDialog>
</template>

<style scoped>
.entry-loading {
  padding: 30px 0;
  text-align: center;
  font-size: 13px;
  color: #b6b0a1;
}

.entry-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.entry-type-badge {
  padding: 2px 10px;
  font-size: 11.5px;
  border-radius: 999px;
}

.entry-type-badge.character {
  color: #b0524a;
  background: rgba(196, 93, 85, 0.12);
}

.entry-type-badge.location {
  color: #3e6f9c;
  background: rgba(79, 110, 247, 0.1);
}

.entry-type-badge.concept {
  color: #6b7d3a;
  background: rgba(122, 148, 60, 0.12);
}

.entry-save-state {
  font-size: 12px;
  color: #b6b0a1;
}

.entry-save-state.dirty {
  color: #a48a56;
}

.entry-save-state.saving {
  color: #78849c;
}

.entry-title-input {
  box-sizing: border-box;
  width: 100%;
  padding: 6px 2px;
  font-family: "Source Han Serif SC", "Noto Serif SC", "Songti SC", "STSong",
    serif;
  font-size: 20px;
  font-weight: 700;
  color: #2b2b2b;
  background: transparent;
  border: none;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  outline: none;
}

.entry-content {
  box-sizing: border-box;
  width: 100%;
  height: 260px;
  margin-top: 12px;
  padding: 14px 16px;
  font-family: "Source Han Serif SC", "Noto Serif SC", "Songti SC", "STSong",
    serif;
  font-size: 14.5px;
  line-height: 1.9;
  color: #333;
  background: #faf8f3;
  border: none;
  border-radius: 10px;
  outline: none;
  resize: vertical;
}

.entry-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 14px;
}

.entry-delete {
  padding: 6px 14px;
  font-size: 12.5px;
  color: #c45d55;
  background: transparent;
  border: 1px solid rgba(196, 93, 85, 0.35);
  border-radius: 8px;
  cursor: pointer;
}

.entry-delete:hover {
  background: rgba(196, 93, 85, 0.08);
}

.entry-close {
  padding: 6px 16px;
  font-size: 12.5px;
  color: #fff;
  background: #4f6ef7;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}

.entry-close:hover {
  background: #3f5de0;
}
</style>
