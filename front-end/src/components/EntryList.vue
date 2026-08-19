<script setup lang="ts">
import type { Entry, EntryType } from "../types/writer";
import { ENTRY_TYPE_LABELS } from "../types/writer";
import LoadingIndicator from "./LoadingIndicator.vue";

/**
 * 设定条目列表（类型 tabs + 列表），普通窄面板与全屏铺开共用。
 * 多根节点（fragment），由父容器承担 flex 布局。
 */
defineProps<{
  filter: EntryType;
  entries: Entry[];
  loading: boolean;
  editingId: number | null;
}>();

const emit = defineEmits<{
  (e: "update:filter", type: EntryType): void;
  (e: "select", id: number): void;
}>();
</script>

<template>
  <div class="settings-tabs">
    <button
      v-for="tab in (['character', 'location', 'concept'] as const)"
      :key="tab"
      class="settings-tab"
      :class="{ active: filter === tab }"
      @click="emit('update:filter', tab)"
    >
      {{ ENTRY_TYPE_LABELS[tab] }}
    </button>
  </div>

  <div class="settings-list-head">
    <span class="settings-label">{{ ENTRY_TYPE_LABELS[filter] }}</span>
    <div v-if="$slots.headActions" class="settings-head-actions">
      <slot name="headActions" />
    </div>
  </div>

  <div v-if="loading" class="settings-loading">
    <LoadingIndicator text="加载中" />
  </div>
  <p v-else-if="entries.length === 0" class="settings-empty">
    还没有条目，点击右上角 + 新建
  </p>
  <nav v-else class="settings-list">
    <button
      v-for="entry in entries"
      :key="entry.id"
      class="settings-item"
      :class="{ active: editingId === entry.id }"
      @click="emit('select', entry.id)"
    >
      <span class="settings-type" :class="entry.type">{{
        ENTRY_TYPE_LABELS[entry.type]
      }}</span>
      <span class="settings-title">{{ entry.title || "未命名条目" }}</span>
    </button>
  </nav>
</template>

<style scoped>
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

.settings-head-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}

.settings-label {
  font-size: 12.5px;
  font-weight: 600;
  color: #8a8577;
}

.settings-loading {
  padding: 18px 14px;
  display: flex;
  justify-content: center;
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
