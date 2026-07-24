<script setup lang="ts">
import { ref, watch } from "vue";
import type { ChapterSummary } from "../types/chapter";

const props = defineProps<{
  chapters: ChapterSummary[];
  currentId: number | null;
  loading: boolean;
}>();
const emit = defineEmits<{
  (e: "select", id: number): void;
  (e: "create"): void;
  (e: "remove", id: number): void;
  (e: "reorder", ids: number[]): void;
}>();

// Local, reorderable copy of the list. Kept in sync with the prop except while
// a drag is in progress (so the live reorder isn't clobbered by a re-render).
const items = ref<ChapterSummary[]>([...props.chapters]);
const dragIndex = ref<number | null>(null);
const overIndex = ref<number | null>(null);
const isCollapsed = ref(false);

watch(
  () => props.chapters,
  (next) => {
    if (dragIndex.value === null) items.value = [...next];
  },
  { deep: true }
);

function onDragStart(index: number, e: DragEvent) {
  dragIndex.value = index;
  overIndex.value = index;
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = "move";
    // Firefox requires data to be set for dragging to start.
    e.dataTransfer.setData("text/plain", String(index));
  }
}

function onDragOver(index: number, e: DragEvent) {
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
  const from = dragIndex.value;
  if (from === null || from === index) {
    overIndex.value = index;
    return;
  }
  // Live-move the dragged item so the reorder is visible during the drag.
  const list = items.value;
  const [moved] = list.splice(from, 1);
  list.splice(index, 0, moved);
  dragIndex.value = index;
  overIndex.value = index;
}

function onDrop() {
  finishDrag();
}

function onDragEnd() {
  finishDrag();
}

function finishDrag() {
  if (dragIndex.value === null) return;
  dragIndex.value = null;
  overIndex.value = null;
  const orderedIds = items.value.map((c) => c.id);
  const original = props.chapters.map((c) => c.id);
  // Only notify if the order actually changed.
  if (orderedIds.join(",") !== original.join(",")) {
    emit("reorder", orderedIds);
  }
}
</script>

<template>
  <aside class="sidebar" :class="{ collapsed: isCollapsed }">
    <div class="head">
      <span v-if="!isCollapsed" class="label">章节</span>
      <div class="head-actions">
        <button
          v-if="!isCollapsed"
          class="add"
          title="新建章节"
          @click="emit('create')"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
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
          class="collapse"
          :title="isCollapsed ? '展开章节栏' : '收起章节栏'"
          :aria-label="isCollapsed ? '展开章节栏' : '收起章节栏'"
          :aria-expanded="!isCollapsed"
          @click="isCollapsed = !isCollapsed"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path
              d="M15 18l-6-6 6-6"
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

    <p v-if="!isCollapsed && !loading && items.length === 0" class="empty">
      还没有章节，点击右上角 + 新建
    </p>

    <nav v-if="!isCollapsed" class="items">
      <div
        v-for="(ch, index) in items"
        :key="ch.id"
        class="item"
        :class="{
          active: ch.id === currentId,
          dragging: dragIndex === index,
        }"
        draggable="true"
        @click="emit('select', ch.id)"
        @dragstart="onDragStart(index, $event)"
        @dragover="onDragOver(index, $event)"
        @drop="onDrop"
        @dragend="onDragEnd"
      >
        <span class="grip" title="拖动排序" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="14" height="14">
            <circle cx="9" cy="6" r="1.4" fill="currentColor" />
            <circle cx="15" cy="6" r="1.4" fill="currentColor" />
            <circle cx="9" cy="12" r="1.4" fill="currentColor" />
            <circle cx="15" cy="12" r="1.4" fill="currentColor" />
            <circle cx="9" cy="18" r="1.4" fill="currentColor" />
            <circle cx="15" cy="18" r="1.4" fill="currentColor" />
          </svg>
        </span>
        <span class="name">{{ ch.title || "未命名章节" }}</span>
        <span class="del" title="删除章节" @click.stop="emit('remove', ch.id)">
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
            <path
              d="M6 6l12 12M18 6L6 18"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            />
          </svg>
        </span>
      </div>
    </nav>

    <div v-if="!isCollapsed && loading" class="loading">
      <span class="spinner"></span>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  position: relative;
  width: 264px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: #faf8f3;
  border-right: 1px solid rgba(0, 0, 0, 0.06);
  overflow-x: hidden;
  overflow-y: auto;
  transition: width 0.24s ease;
}

.sidebar.collapsed {
  width: 48px;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.15rem 1.15rem 0.7rem;
}

.collapsed .head {
  justify-content: center;
  padding: 1.15rem 0 0.7rem;
}

.head-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}

.label {
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: #666;
}

.add {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  color: #8a8577;
  background: transparent;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease, transform 0.2s ease;
}

.add:hover {
  background: #f0efea;
  color: #444;
}

.add:active {
  transform: scale(0.9);
}

.collapse {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  color: #8a8577;
  background: transparent;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease, transform 0.24s ease;
}

.collapse:hover {
  color: #444;
  background: #f0efea;
}

.collapsed .collapse {
  transform: rotate(180deg);
}

.empty {
  margin: 0.5rem 1.1rem;
  font-size: 0.82rem;
  line-height: 1.6;
  color: #b6b0a1;
}

.items {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 0.25rem 0.6rem 1rem;
}

.item {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  width: 100%;
  height: 44px;
  padding: 0 0.6rem;
  font-size: 0.9rem;
  text-align: left;
  color: #4a4a44;
  background: transparent;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease, transform 0.15s ease,
    box-shadow 0.2s ease, opacity 0.2s ease;
}

.item:hover {
  background: #f7f7f7;
}

.item.active {
  background: #eef4ff;
  color: #4f6ef7;
  font-weight: 600;
}

.item.dragging {
  opacity: 0.6;
  background: #fffdf8;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.12);
  cursor: grabbing;
}

.grip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 16px;
  color: #cfc9ba;
  cursor: grab;
  opacity: 0;
  transition: opacity 0.18s ease, color 0.18s ease;
}

.item:hover .grip,
.item.dragging .grip {
  opacity: 1;
}

.grip:active {
  cursor: grabbing;
}

.name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: transform 0.2s ease;
}

.item:hover .name {
  transform: translateX(2px);
}

.del {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  color: #b6b0a1;
  border-radius: 6px;
  opacity: 0;
  transition: opacity 0.18s ease, background 0.18s ease, color 0.18s ease;
}

.item:hover .del {
  opacity: 1;
}

.del:hover {
  background: rgba(224, 49, 49, 0.1);
  color: #e03131;
}

/* ---- loading overlay (no layout shift) ---- */
.loading {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(250, 248, 243, 0.55);
  backdrop-filter: blur(1px);
}

.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(79, 110, 247, 0.25);
  border-top-color: #4f6ef7;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
