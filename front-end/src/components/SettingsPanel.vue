<script setup lang="ts">
import { ref, watch, onMounted } from "vue";
import * as writerApi from "../api/writer";
import type { Entry, EntryType } from "../types/writer";
import { ENTRY_TYPE_LABELS } from "../types/writer";
import { showToast } from "../composables/useToast";
import EntryEditDialog from "./EntryEditDialog.vue";

/**
 * 设定资料库（右侧面板）：人物 / 地点 / 设定 条目列表。
 * 点击条目在弹层中编辑（不打断正文写作）。
 */
const props = defineProps<{ bookId: number }>();

type Filter = EntryType;
const filter = ref<Filter>("character");
const entries = ref<Entry[]>([]);
const loading = ref(false);
const editingId = ref<number | null>(null);

async function loadList(): Promise<void> {
  loading.value = true;
  try {
    entries.value = await writerApi.listEntries(props.bookId, filter.value);
  } catch (error) {
    showToast(error instanceof Error ? error.message : "加载设定失败", "error");
  } finally {
    loading.value = false;
  }
}

watch(filter, () => void loadList());
onMounted(() => void loadList());

async function onCreate(): Promise<void> {
  const type: EntryType = filter.value;
  try {
    const entry = await writerApi.createEntry(props.bookId, type);
    entries.value.push(entry);
    editingId.value = entry.id;
  } catch (error) {
    showToast(error instanceof Error ? error.message : "新建条目失败", "error");
  }
}

/** 保存成功：仅同步列表项，不关闭弹窗。 */
function onSaved(saved: Entry): void {
  const index = entries.value.findIndex((e) => e.id === saved.id);
  if (index !== -1) entries.value[index] = saved;
  else entries.value.push(saved);
}

/** 关闭/删除：关闭弹窗；删除时同步移除列表项。 */
function onEditedClose(deleted: boolean): void {
  const id = editingId.value;
  editingId.value = null;
  if (deleted && id !== null) {
    entries.value = entries.value.filter((e) => e.id !== id);
  }
}
</script>

<template>
  <div class="settings">
    <div class="settings-tabs">
      <button
        v-for="tab in (['character', 'location', 'concept'] as const)"
        :key="tab"
        class="settings-tab"
        :class="{ active: filter === tab }"
        @click="filter = tab"
      >
        {{ ENTRY_TYPE_LABELS[tab] }}
      </button>
    </div>

    <div class="settings-list-head">
      <span class="settings-label">{{ ENTRY_TYPE_LABELS[filter] }}</span>
      <button
        class="settings-add"
        title="新建条目"
        aria-label="新建条目"
        @click="onCreate"
      >
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

    <p v-if="!loading && entries.length === 0" class="settings-empty">
      还没有条目，点击右上角 + 新建
    </p>
    <nav v-else class="settings-list">
      <button
        v-for="entry in entries"
        :key="entry.id"
        class="settings-item"
        :class="{ active: editingId === entry.id }"
        @click="editingId = entry.id"
      >
        <span class="settings-type" :class="entry.type">{{
          ENTRY_TYPE_LABELS[entry.type]
        }}</span>
        <span class="settings-title">{{ entry.title || "未命名条目" }}</span>
      </button>
    </nav>

    <EntryEditDialog
      v-if="editingId !== null"
      :entry-id="editingId"
      @close="onEditedClose(false)"
      @saved="onSaved"
      @deleted="onEditedClose(true)"
    />
  </div>
</template>

<style scoped>
.settings {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.settings-tabs {
  display: flex;
  gap: 2px;
  padding: 12px 10px 6px;
}

.settings-tab {
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

.settings-tab:hover {
  background: #f0eee7;
  color: #444;
}

.settings-tab.active {
  background: #fff;
  color: #444;
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.settings-list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px 6px;
}

.settings-label {
  font-size: 12.5px;
  font-weight: 600;
  color: #8a8577;
}

.settings-add {
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

.settings-add:hover {
  background: #f0eee7;
  color: #444;
}

.settings-empty {
  margin: 10px 14px;
  font-size: 12px;
  color: #b6b0a1;
}

.settings-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0 8px 12px;
}

.settings-item {
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

.settings-item:hover {
  background: rgba(255, 255, 255, 0.62);
}

.settings-item.active {
  background: #f0ede5;
  color: #333;
}

.settings-type {
  flex-shrink: 0;
  padding: 1px 6px;
  font-size: 10.5px;
  border-radius: 999px;
}

.settings-type.character {
  color: #b0524a;
  background: rgba(196, 93, 85, 0.12);
}

.settings-type.location {
  color: #3e6f9c;
  background: rgba(79, 110, 247, 0.1);
}

.settings-type.concept {
  color: #6b7d3a;
  background: rgba(122, 148, 60, 0.12);
}

.settings-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
