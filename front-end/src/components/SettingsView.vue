<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, computed } from "vue";
import * as writerApi from "../api/writer";
import type { Entry, EntryType } from "../types/writer";
import { ENTRY_TYPE_LABELS } from "../types/writer";
import { useConfirm } from "../composables/useConfirm";
import { showToast } from "../composables/useToast";

/**
 * 设定资料库：人物 / 地点 / 设定 条目管理（列表 + 自动保存编辑器）。
 * 数据独立于正文，适合维护世界观、人物卡、地名表。
 */
const props = defineProps<{ bookId: number }>();

const emit = defineEmits<{ (e: "set-mode", mode: "chapters" | "entries"): void }>();

const confirm = useConfirm();

type Filter = "all" | EntryType;
const filter = ref<Filter>("all");
const entries = ref<Entry[]>([]);
const currentId = ref<number | null>(null);
const loading = ref(false);

const current = computed(
  () => entries.value.find((e) => e.id === currentId.value) ?? null
);

const saveState = ref<"saved" | "saving" | "dirty">("saved");
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let lastSavedText = ref("");

async function loadList(): Promise<void> {
  loading.value = true;
  try {
    entries.value = await writerApi.listEntries(
      props.bookId,
      filter.value === "all" ? undefined : filter.value
    );
    // 当前选中项若被过滤掉则清空。
    if (currentId.value !== null && !entries.value.some((e) => e.id === currentId.value)) {
      currentId.value = null;
    }
  } catch (error) {
    showToast(error instanceof Error ? error.message : "加载设定失败", "error");
  } finally {
    loading.value = false;
  }
}

watch(filter, () => void loadList());

onMounted(() => void loadList());
onBeforeUnmount(() => {
  // 卸载（切换回章节模式）前立即保存未落盘的修改，避免最后一段输入丢失。
  if (saveTimer !== null) {
    clearTimeout(saveTimer);
    saveTimer = null;
    void persist();
  }
});

async function onCreate(): Promise<void> {
  const type: EntryType =
    filter.value === "all" ? "character" : filter.value;
  try {
    const entry = await writerApi.createEntry(props.bookId, type);
    entries.value.push(entry);
    currentId.value = entry.id;
  } catch (error) {
    showToast(error instanceof Error ? error.message : "新建条目失败", "error");
  }
}

async function onRemove(): Promise<void> {
  const id = currentId.value;
  if (id === null) return;
  const ok = await confirm({
    title: "删除条目？",
    message: "删除后该条目的内容无法恢复。",
    confirmText: "删除",
  });
  if (!ok) return;
  try {
    await writerApi.deleteEntry(id);
    entries.value = entries.value.filter((e) => e.id !== id);
    currentId.value = null;
  } catch (error) {
    showToast(error instanceof Error ? error.message : "删除失败", "error");
  }
}

// 标题/内容变更 → 防抖自动保存。
watch(
  [() => current.value?.title, () => current.value?.content],
  () => {
    if (!current.value) return;
    saveState.value = "dirty";
    if (saveTimer !== null) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      void persist();
    }, 800);
  }
);

async function persist(): Promise<void> {
  const entry = current.value;
  if (!entry) return;
  saveTimer = null;
  saveState.value = "saving";
  try {
    const saved = await writerApi.updateEntry(entry.id, {
      title: entry.title,
      content: entry.content,
    });
    const item = entries.value.find((e) => e.id === entry.id);
    if (item) {
      item.title = saved.title;
      item.content = saved.content;
      item.updateTime = saved.updateTime;
    }
    saveState.value = "saved";
    lastSavedText.value = new Date().toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (error) {
    saveState.value = "dirty";
    showToast(error instanceof Error ? error.message : "保存失败", "error");
  }
}

function onSelect(id: number): void {
  // 立即保存未落盘的修改再切换。
  if (saveTimer !== null) {
    clearTimeout(saveTimer);
    void persist();
  }
  currentId.value = id;
}

const saveStateText = computed(() => {
  if (saveState.value === "saving") return "保存中…";
  if (saveState.value === "dirty") return "未保存";
  return lastSavedText.value ? `已保存 ${lastSavedText.value}` : "已保存";
});
</script>

<template>
  <div class="entries">
    <aside class="entry-sidebar">
      <div class="entry-tabs">
        <button
          v-for="tab in (['all', 'character', 'location', 'concept'] as const)"
          :key="tab"
          class="entry-tab"
          :class="{ active: filter === tab }"
          @click="filter = tab"
        >
          {{ tab === "all" ? "全部" : ENTRY_TYPE_LABELS[tab] }}
        </button>
        <button
          class="entry-tab entry-tab-mode"
          title="返回正文"
          @click="emit('set-mode', 'chapters')"
        >
          章节
        </button>
      </div>

      <div class="entry-list-head">
        <span class="entry-label">
          {{
            filter === "all"
              ? "全部条目"
              : ENTRY_TYPE_LABELS[filter as EntryType]
          }}
        </span>
        <button class="entry-add" title="新建条目" aria-label="新建条目" @click="onCreate">
          <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
            <path
              d="M12 5v14M5 12h14"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            />
          </svg>
        </button>
      </div>

      <p v-if="!loading && entries.length === 0" class="entry-empty">
        还没有条目，点击 + 新建
      </p>
      <nav v-else class="entry-list">
        <button
          v-for="entry in entries"
          :key="entry.id"
          class="entry-item"
          :class="{ active: entry.id === currentId }"
          @click="onSelect(entry.id)"
        >
          <span class="entry-type" :class="entry.type">{{
            ENTRY_TYPE_LABELS[entry.type]
          }}</span>
          <span class="entry-title">{{ entry.title || "未命名条目" }}</span>
        </button>
      </nav>
    </aside>

    <section class="entry-editor">
      <template v-if="current">
        <div class="entry-editor-head">
          <input
            v-model="current.title"
            class="entry-title-input"
            placeholder="未命名条目"
            aria-label="条目标题"
            spellcheck="false"
          />
          <div class="entry-editor-actions">
            <span class="entry-save-state" :class="saveState">{{
              saveStateText
            }}</span>
            <button class="entry-delete" @click="onRemove">删除</button>
          </div>
        </div>
        <textarea
          v-model="current.content"
          class="entry-content"
          placeholder="记录这个设定的一切……"
          spellcheck="false"
        ></textarea>
      </template>
      <div v-else class="entry-placeholder">
        <p>从左侧选择一个条目，或新建一个</p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.entries {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
}

.entry-sidebar {
  width: 264px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: #faf8f3;
  border-right: 1px solid rgba(0, 0, 0, 0.06);
  overflow-y: auto;
}

.entry-tabs {
  display: flex;
  gap: 2px;
  padding: 10px 10px 6px;
}

.entry-tab {
  flex: 1;
  padding: 5px 0;
  font-size: 12px;
  color: #8a8577;
  background: transparent;
  border: none;
  border-radius: 7px;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.entry-tab:hover {
  background: #f0eee7;
  color: #444;
}

.entry-tab.active {
  background: #fff;
  color: #444;
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.entry-tab-mode {
  flex: 0 0 auto;
  padding: 5px 10px;
}

.entry-list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px 6px;
}

.entry-label {
  font-size: 12.5px;
  font-weight: 600;
  color: #8a8577;
}

.entry-add {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  color: #8a8577;
  background: transparent;
  border: none;
  border-radius: 7px;
  cursor: pointer;
}

.entry-add:hover {
  background: #f0eee7;
  color: #444;
}

.entry-empty {
  margin: 10px 14px;
  font-size: 12px;
  color: #b6b0a1;
}

.entry-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0 8px 12px;
}

.entry-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 10px;
  font-size: 13px;
  text-align: left;
  color: #4a4a44;
  background: transparent;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.14s ease;
}

.entry-item:hover {
  background: rgba(255, 255, 255, 0.62);
}

.entry-item.active {
  background: #f0ede5;
  color: #333;
}

.entry-type {
  flex-shrink: 0;
  padding: 1px 6px;
  font-size: 10.5px;
  border-radius: 999px;
}

.entry-type.character {
  color: #b0524a;
  background: rgba(196, 93, 85, 0.12);
}

.entry-type.location {
  color: #3e6f9c;
  background: rgba(79, 110, 247, 0.1);
}

.entry-type.concept {
  color: #6b7d3a;
  background: rgba(122, 148, 60, 0.12);
}

.entry-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.entry-editor {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 18px 32px 24px;
  background: #f5f3ee;
}

.entry-editor-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 10px;
}

.entry-title-input {
  flex: 1;
  min-width: 0;
  padding: 4px 2px;
  font-family: "Source Han Serif SC", "Noto Serif SC", "Songti SC", "STSong",
    serif;
  font-size: 24px;
  font-weight: 700;
  color: #2b2b2b;
  background: transparent;
  border: none;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  outline: none;
}

.entry-editor-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
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

.entry-delete {
  padding: 5px 12px;
  font-size: 12.5px;
  color: #c45d55;
  background: transparent;
  border: 1px solid rgba(196, 93, 85, 0.35);
  border-radius: 7px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.entry-delete:hover {
  background: rgba(196, 93, 85, 0.08);
}

.entry-content {
  flex: 1;
  min-height: 0;
  box-sizing: border-box;
  width: 100%;
  max-width: 780px;
  align-self: center;
  padding: 20px 24px;
  font-family: "Source Han Serif SC", "Noto Serif SC", "Songti SC", "STSong",
    serif;
  font-size: 16px;
  line-height: 1.9;
  color: #333;
  background: #fffdf8;
  border: none;
  border-radius: 12px 12px 0 0;
  outline: none;
  resize: none;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.06);
}

.entry-placeholder {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: #b6b0a1;
}

@media (max-width: 760px) {
  .entry-editor {
    padding: 10px 10px 0;
  }

  .entry-content {
    max-width: none;
    font-size: 14px;
    padding: 14px 12px;
  }
}
</style>
