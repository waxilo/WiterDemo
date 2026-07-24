import { ref, computed } from "vue";
import * as bookApi from "../api/book";
import type { Book } from "../types/chapter";

/**
 * Bookshelf state: the user's books and which one is currently open.
 * `currentId` drives the login/bookshelf/editor view switch in App.vue.
 */
export function useBooks() {
  const list = ref<Book[]>([]);
  const currentId = ref<number | null>(null);
  const loading = ref(false);
  const error = ref("");

  const current = computed(
    () => list.value.find((b) => b.id === currentId.value) ?? null
  );

  async function loadList(): Promise<void> {
    loading.value = true;
    error.value = "";
    try {
      list.value = await bookApi.listBooks();
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      loading.value = false;
    }
  }

  /** Open a book -> switch to the editor view. */
  function open(id: number): void {
    currentId.value = id;
  }

  /** Return to the bookshelf. Caller should flush unsaved edits first. */
  function backToShelf(): void {
    currentId.value = null;
  }

  async function create(): Promise<void> {
    const book = await bookApi.createBook();
    list.value.push(book);
    currentId.value = book.id;
  }

  async function remove(id: number): Promise<void> {
    await bookApi.deleteBook(id);
    list.value = list.value.filter((b) => b.id !== id);
    if (currentId.value === id) currentId.value = null;
  }

  return {
    list,
    current,
    currentId,
    loading,
    error,
    loadList,
    open,
    backToShelf,
    create,
    remove,
  };
}
