import { ref, computed } from "vue";
import SparkMD5 from "spark-md5";
import * as chapterApi from "../api/chapter";
import type { Chapter, ChapterSummary } from "../types/chapter";
import { AUTOSAVE_IDLE_MS } from "../config";
import { getTextStats } from "../utils/textStats";

/** Hash rule shared with the save flow: md5 of the JSON {title, content}. */
function hashOf(title: string, content: string): string {
  return SparkMD5.hash(JSON.stringify({ title, content }));
}

function toSummary(chapter: Chapter): ChapterSummary {
  return {
    id: chapter.id,
    bookId: chapter.bookId,
    title: chapter.title,
    sortOrder: chapter.sortOrder,
    updateTime: chapter.updateTime,
    ...getTextStats(chapter.content),
  };
}

/**
 * Chapter state for the currently open book: the chapter list, the selected
 * chapter (with editable title/content), and save logic (manual Ctrl+S,
 * idle autosave, and flush) with MD5 dedup.
 */
export function useChapters() {
  const list = ref<ChapterSummary[]>([]);
  const current = ref<Chapter | null>(null);
  const loading = ref(false);
  const saving = ref(false);
  const savedHash = ref<string | null>(null);

  let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;

  function currentHash(): string {
    if (!current.value) return "";
    return hashOf(current.value.title, current.value.content);
  }

  const dirty = computed(
    () => current.value !== null && currentHash() !== savedHash.value
  );

  function clearAutoSaveTimer(): void {
    if (autoSaveTimer !== null) {
      clearTimeout(autoSaveTimer);
      autoSaveTimer = null;
    }
  }

  /** Reset all chapter state synchronously (e.g. when opening a book). */
  function reset(): void {
    clearAutoSaveTimer();
    list.value = [];
    current.value = null;
    savedHash.value = null;
  }

  async function loadList(bookId: number): Promise<void> {
    // Clear stale state up front so the editor doesn't flash the previously
    // opened chapter while the new list is loading.
    reset();
    loading.value = true;
    try {
      list.value = await chapterApi.listChapters(bookId);
    } finally {
      loading.value = false;
    }
  }

  async function select(id: number): Promise<void> {
    if (current.value?.id === id) return;
    await flush();
    const chapter = await chapterApi.getChapter(id);
    current.value = chapter;
    // Seed savedHash from the loaded content so it starts "clean".
    savedHash.value = hashOf(chapter.title, chapter.content);
  }

  async function create(bookId: number): Promise<void> {
    await flush();
    const chapter = await chapterApi.createChapter(bookId);
    list.value.push(toSummary(chapter));
    current.value = chapter;
    savedHash.value = hashOf(chapter.title, chapter.content);
  }

  async function save(): Promise<void> {
    clearAutoSaveTimer();
    const chapter = current.value;
    if (!chapter) return;

    const hash = currentHash();
    if (hash === savedHash.value) return; // no change
    if (saving.value) return; // avoid re-entrancy

    saving.value = true;
    try {
      const saved = await chapterApi.saveChapter(chapter.id, {
        title: chapter.title,
        content: chapter.content,
        hash,
      });
      savedHash.value = hash;
      chapter.updateTime = saved.updateTime;
      chapter.contentHash = saved.contentHash;
      // Reflect updated metadata in the list.
      const item = list.value.find((c) => c.id === saved.id);
      if (item) {
        item.title = saved.title;
        item.updateTime = saved.updateTime;
        Object.assign(item, getTextStats(saved.content));
      }
    } finally {
      saving.value = false;
    }
  }

  /** Debounced autosave: called on every edit; fires after an idle period. */
  function scheduleAutoSave(): void {
    clearAutoSaveTimer();
    autoSaveTimer = setTimeout(() => {
      void save();
    }, AUTOSAVE_IDLE_MS);
  }

  /** Immediately persist if there are unsaved changes. */
  async function flush(): Promise<void> {
    clearAutoSaveTimer();
    if (dirty.value) await save();
  }

  async function remove(id: number): Promise<void> {
    await chapterApi.deleteChapter(id);
    list.value = list.value.filter((c) => c.id !== id);
    if (current.value?.id === id) {
      current.value = null;
      savedHash.value = null;
    }
  }

  async function rename(id: number, title: string): Promise<void> {
    const normalizedTitle = title.trim() || "未命名章节";
    const item = list.value.find((chapter) => chapter.id === id);
    if (item?.title === normalizedTitle) return;

    if (current.value?.id === id) {
      const previousTitle = current.value.title;
      current.value.title = normalizedTitle;
      if (item) item.title = normalizedTitle;
      try {
        await save();
      } catch (error) {
        current.value.title = previousTitle;
        if (item) item.title = previousTitle;
        throw error;
      }
      return;
    }

    const chapter = await chapterApi.getChapter(id);
    const saved = await chapterApi.saveChapter(id, {
      title: normalizedTitle,
      content: chapter.content,
      hash: hashOf(normalizedTitle, chapter.content),
    });
    if (item) Object.assign(item, toSummary(saved));
  }

  async function duplicate(id: number): Promise<void> {
    await flush();
    const source =
      current.value?.id === id
        ? current.value
        : await chapterApi.getChapter(id);
    const duplicateTitle = `${source.title || "未命名章节"} 副本`;
    const created = await chapterApi.createChapter(source.bookId, duplicateTitle);

    try {
      const copied = await chapterApi.saveChapter(created.id, {
        title: duplicateTitle,
        content: source.content,
        hash: hashOf(duplicateTitle, source.content),
      });
      const sourceIndex = list.value.findIndex((chapter) => chapter.id === id);
      const insertIndex = sourceIndex < 0 ? list.value.length : sourceIndex + 1;
      list.value.splice(insertIndex, 0, toSummary(copied));

      const orderedIds = list.value.map((chapter) => chapter.id);
      list.value = await chapterApi.reorderChapters(source.bookId, orderedIds);
      current.value = copied;
      savedHash.value = hashOf(copied.title, copied.content);
    } catch (error) {
      list.value = list.value.filter((chapter) => chapter.id !== created.id);
      await chapterApi.deleteChapter(created.id).catch(() => undefined);
      throw error;
    }
  }

  /**
   * Persist a new chapter order. Applies the order optimistically to the local
   * list, then syncs with the server; on failure re-fetches the list.
   */
  async function reorder(bookId: number, orderedIds: number[]): Promise<void> {
    const byId = new Map(list.value.map((c) => [c.id, c]));
    const next = orderedIds
      .map((id) => byId.get(id))
      .filter((c): c is ChapterSummary => c !== undefined);
    if (next.length === list.value.length) list.value = next;

    try {
      list.value = await chapterApi.reorderChapters(bookId, orderedIds);
    } catch (e) {
      list.value = await chapterApi.listChapters(bookId);
      throw e;
    }
  }

  return {
    list,
    current,
    loading,
    saving,
    dirty,
    loadList,
    select,
    create,
    save,
    scheduleAutoSave,
    flush,
    remove,
    rename,
    duplicate,
    reorder,
  };
}
