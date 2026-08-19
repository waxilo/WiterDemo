<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, computed } from "vue";
import * as writerApi from "../api/writer";
import type { Entry, EntryType } from "../types/writer";
import { ENTRY_TYPE_LABELS } from "../types/writer";
import { useConfirm } from "../composables/useConfirm";
import { showToast } from "../composables/useToast";
import { useBusy } from "../composables/useBusy";
import { AUTOSAVE_IDLE_MS } from "../config";
import LoadingIndicator from "./LoadingIndicator.vue";

/**
 * 设定条目编辑器（表单核心）：标题 + 内容 + 防抖自动保存 + 删除。
 * 可被弹层（EntryEditDialog）或全屏视图（SettingsPanel）复用。
 */
const props = defineProps<{ entryId: number }>();

const emit = defineEmits<{
  (e: "saved", entry: Entry): void;
  (e: "deleted"): void;
  (e: "close"): void;
}>();

const confirm = useConfirm();

const entry = ref<Entry | null>(null);
const loading = ref(true);
const saveState = ref<"saved" | "saving" | "dirty">("saved");
const { busy: deleting, run: runDelete } = useBusy();
let saveTimer: ReturnType<typeof setTimeout> | null = null;
/** 加载序号：丢弃过期响应（快速切换条目时防串写）。 */
let loadSeq = 0;
/** 保存序号：丢弃过期响应（并发保存时旧响应不得回退新响应设置的状态）。 */
let saveSeq = 0;
/** 删除进行中：在途保存的 404 属预期，不再弹错误。 */
let removing = false;
/** 串行化：同一时间只有一个保存请求在途，避免并发写乱序覆盖服务器值。 */
let persistInFlight = false;
/**
 * 排队中的保存（固定快照，续存不依赖 entry.value——切条目后它会被置 null，
 * 否则挂起修改会丢失）。按条目 id 去重，不同条目各自排队。
 */
let queuedSaves: Array<{ id: number; title: string; content: string }> = [];

function queueSave(id: number, title: string, content: string): void {
  const item = { id, title, content };
  const idx = queuedSaves.findIndex((q) => q.id === id);
  if (idx >= 0) queuedSaves[idx] = item;
  else queuedSaves.push(item);
}

/** 用户输入后的防抖保存入口。 */
async function persist(): Promise<void> {
  const current = entry.value;
  if (!current) return;
  await saveSnapshot(current.id, current.title, current.content);
}

/**
 * 保存指定条目（串行化）。排队时固定快照，切条目/卸载后仍能落盘。
 */
async function saveSnapshot(
  id: number,
  title: string,
  content: string
): Promise<void> {
  if (persistInFlight) {
    queueSave(id, title, content);
    return;
  }
  persistInFlight = true;
  saveTimer = null;
  // 仅当前条目才更新保存状态：切条目后的续存不应影响当前显示。
  if (entry.value && entry.value.id === id) saveState.value = "saving";
  // 发送快照：响应返回时仅当用户未继续修改才写回服务器回显，
  // 防止慢请求把正在输入的内容回滚成旧值。
  const snapshot = { title, content };
  const seq = ++saveSeq;
  try {
    const saved = await writerApi.updateEntry(id, { title, content });
    // 已有更新的保存请求：旧响应不得覆盖新响应的状态/内容。
    if (seq !== saveSeq) return;
    // 守卫 id：切换条目后旧保存响应不得覆盖新条目。
    if (entry.value && entry.value.id === id) {
      if (
        entry.value.title === snapshot.title &&
        entry.value.content === snapshot.content
      ) {
        // 用户未继续修改：同步服务器回显（trim 等规范化）+ 标记已保存。
        entry.value.title = saved.title;
        entry.value.content = saved.content;
        saveState.value = "saved";
        emit("saved", saved);
      } else {
        // 用户已继续输入：不覆盖，保持待保存；队列会再次保存新内容。
        saveState.value = "dirty";
        // 通知父级时带上最新本地值，避免列表标题被慢响应回退成旧值。
        emit("saved", { ...saved, title: entry.value.title, content: entry.value.content });
      }
    } else {
      // 已切换到其他条目：仅同步列表项。
      emit("saved", saved);
    }
  } catch (error) {
    // 删除进行中：条目已不存在，404 属预期，不打扰用户。
    if (removing) return;
    if (seq !== saveSeq) return;
    if (entry.value && entry.value.id === id) {
      saveState.value = "dirty";
    }
    showToast(error instanceof Error ? error.message : "保存失败", "error");
  } finally {
    persistInFlight = false;
    const next = queuedSaves.shift();
    if (next) {
      void saveSnapshot(next.id, next.title, next.content); // 续存排队期间的最新修改
    }
  }
}

async function loadEntry(id: number): Promise<void> {
  const seq = ++loadSeq;
  loading.value = true;
  entry.value = null;
  saveState.value = "saved";
  try {
    const data = await writerApi.getEntry(id);
    if (seq !== loadSeq) return; // 已切到其他条目，丢弃
    entry.value = data;
  } catch (error) {
    if (seq !== loadSeq) return;
    showToast(error instanceof Error ? error.message : "加载条目失败", "error");
  } finally {
    if (seq === loadSeq) loading.value = false;
  }
}

onMounted(() => {
  void loadEntry(props.entryId);
});

// 条目切换（全屏点左侧不同条目/弹窗换条目）：先落盘旧条目挂起修改，再加载新条目。
watch(
  () => props.entryId,
  (id) => {
    if (saveTimer !== null) {
      clearTimeout(saveTimer);
      saveTimer = null;
      void persist();
    }
    void loadEntry(id);
  }
);

/** 用户输入（@input 驱动）：标记待保存并防抖落盘。IME 组合中不触发。 */
function onUserInput(e: Event): void {
  if (!entry.value) return;
  // 中文输入法组合中（未确认），不触发保存；compositionend 后会再发一次
  // input 事件（isComposing=false）补上。
  if ((e as InputEvent).isComposing) return;
  saveState.value = "dirty";
  if (saveTimer !== null) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    void persist();
  }, AUTOSAVE_IDLE_MS);
}

/** 完成：先落盘未保存修改，再通知关闭。 */
function onDone(): void {
  if (saveTimer !== null) {
    clearTimeout(saveTimer);
    saveTimer = null;
    void persist();
  }
  emit("close");
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
  // 在途保存的 404 属预期（条目即将不存在），不弹错误。
  removing = true;
  await runDelete(async () => {
    await writerApi.deleteEntry(props.entryId);
    emit("deleted");
    emit("close");
  }).catch((error) => {
    // 删除失败：恢复 removing，之后的保存失败仍需正常提示。
    removing = false;
    showToast(error instanceof Error ? error.message : "删除失败", "error");
  });
}

const saveStateText = computed(() => {
  if (saveState.value === "saving") return "保存中…";
  if (saveState.value === "dirty") return "未保存";
  return "已保存";
});

onBeforeUnmount(() => {
  // 卸载前立即保存未落盘的修改，避免最后一段输入丢失。
  if (saveTimer !== null) {
    clearTimeout(saveTimer);
    saveTimer = null;
    void persist();
  }
});
</script>

<template>
  <div v-if="loading" class="entry-loading">
    <LoadingIndicator text="加载中" />
  </div>
  <template v-else-if="entry">
    <div class="entry-head">
      <span class="entry-type-badge" :class="entry.type">{{
        ENTRY_TYPE_LABELS[entry.type as EntryType]
      }}</span>
      <div class="entry-head-right">
        <span class="entry-save-state" :class="saveState">{{
          saveStateText
        }}</span>
        <button class="entry-delete" :disabled="deleting" @click="onRemove">
          {{ deleting ? "删除中…" : "删除" }}
        </button>
      </div>
    </div>
    <input
      :value="entry.title"
      class="entry-title-input"
      placeholder="未命名条目"
      aria-label="条目标题"
      spellcheck="false"
      @input="entry.title = ($event.target as HTMLInputElement).value; onUserInput($event)"
    />
    <textarea
      :value="entry.content"
      class="entry-content"
      placeholder="记录这个设定的一切……"
      spellcheck="false"
      @input="entry.content = ($event.target as HTMLTextAreaElement).value; onUserInput($event)"
    ></textarea>
    <div class="entry-actions">
      <button class="entry-close" @click="onDone">完成</button>
    </div>
  </template>
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

.entry-head-right {
  display: flex;
  align-items: center;
  gap: 10px;
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
