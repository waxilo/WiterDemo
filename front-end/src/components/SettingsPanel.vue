<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from "vue";
import * as writerApi from "../api/writer";
import type { Entry, EntryType } from "../types/writer";
import { ENTRY_TYPE_LABELS } from "../types/writer";
import { showToast } from "../composables/useToast";
import EntryEditDialog from "./EntryEditDialog.vue";
import EntryEditor from "./EntryEditor.vue";

/**
 * 设定资料库（右侧面板）：人物 / 地点 / 设定 条目列表。
 * 窄面板点击条目弹层编辑；「全屏」按钮铺开覆盖整个屏幕（左列表 + 右内联编辑）。
 */
const props = defineProps<{ bookId: number }>();

type Filter = EntryType;
const filter = ref<Filter>("character");
const entries = ref<Entry[]>([]);
const loading = ref(false);
const editingId = ref<number | null>(null);
/** 全屏铺开模式（覆盖整个屏幕）。 */
const expanded = ref(false);

function onKeydown(e: KeyboardEvent): void {
  if (e.key === "Escape" && expanded.value) {
    expanded.value = false;
  }
}

onMounted(() => {
  void loadList();
  window.addEventListener("keydown", onKeydown);
});
onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));

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
      <div class="settings-head-actions">
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
        <button
          class="settings-add"
          title="全屏展开"
          aria-label="全屏展开"
          @click="expanded = true"
        >
          <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
            <path
              d="M4 9V5a1 1 0 0 1 1-1h4M20 9V5a1 1 0 0 0-1-1h-4M4 15v4a1 1 0 0 0 1 1h4M20 15v4a1 1 0 0 1-1 1h-4"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
      </div>
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
      v-if="editingId !== null && !expanded"
      :entry-id="editingId"
      @close="onEditedClose(false)"
      @saved="onSaved"
      @deleted="onEditedClose(true)"
    />

    <!-- 全屏铺开：左列表 + 右内联编辑器，覆盖整个屏幕 -->
    <Teleport to="body">
      <div v-if="expanded" class="settings-expanded">
        <div class="expanded-head">
          <span class="expanded-title">📚 设定资料库</span>
          <div class="expanded-actions">
            <button class="expanded-new" @click="onCreate">＋ 新建条目</button>
            <button class="expanded-close" @click="expanded = false">
              关闭（Esc）
            </button>
          </div>
        </div>

        <div class="expanded-body">
          <aside class="expanded-sidebar">
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
          </aside>

          <section class="expanded-editor">
            <EntryEditor
              v-if="editingId !== null"
              :entry-id="editingId"
              @saved="onSaved"
              @deleted="onEditedClose(true)"
              @close="editingId = null"
            />
            <div v-else class="expanded-placeholder">
              <p>从左侧选择一个条目，或点击「＋ 新建条目」</p>
            </div>
          </section>
        </div>
      </div>
    </Teleport>
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

/* ---- 全屏铺开模式 ---- */
.settings-head-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}

.settings-expanded {
  position: fixed;
  inset: 0;
  z-index: 150;
  display: flex;
  flex-direction: column;
  background: #f5f3ee;
}

.expanded-head {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  height: 56px;
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: saturate(180%) blur(16px);
  -webkit-backdrop-filter: saturate(180%) blur(16px);
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.expanded-title {
  font-size: 15px;
  font-weight: 600;
  color: #3a3a3a;
}

.expanded-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.expanded-new {
  padding: 7px 14px;
  font-size: 12.5px;
  color: #fff;
  background: #4f6ef7;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}

.expanded-new:hover {
  background: #3f5de0;
}

.expanded-close {
  padding: 7px 14px;
  font-size: 12.5px;
  color: #666;
  background: transparent;
  border: 1px solid #ddd6c8;
  border-radius: 8px;
  cursor: pointer;
}

.expanded-close:hover {
  background: rgba(0, 0, 0, 0.05);
}

.expanded-body {
  flex: 1;
  min-height: 0;
  display: flex;
}

.expanded-sidebar {
  width: 280px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: #faf8f3;
  border-right: 1px solid rgba(0, 0, 0, 0.06);
  overflow-y: auto;
}

.expanded-editor {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  padding: 28px 40px;
  overflow-y: auto;
}

.expanded-editor > :deep(.entry-loading) {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.expanded-editor > :deep(textarea.entry-content) {
  height: auto;
  flex: 1;
  min-height: 320px;
  max-width: 780px;
  align-self: center;
  width: 100%;
  font-size: 15.5px;
  line-height: 2;
  background: #fffdf8;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.06);
}

.expanded-editor > :deep(.entry-title-input) {
  max-width: 780px;
  align-self: center;
  font-size: 24px;
}

.expanded-editor > :deep(.entry-head),
.expanded-editor > :deep(.entry-actions) {
  max-width: 780px;
  width: 100%;
  align-self: center;
}

.expanded-placeholder {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: #b6b0a1;
}

@media (max-width: 760px) {
  .expanded-sidebar {
    width: 42vw;
  }

  .expanded-editor {
    padding: 12px;
  }
}

</style>
