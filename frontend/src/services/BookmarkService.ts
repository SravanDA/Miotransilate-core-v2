const BOOKMARKS_STORAGE_KEY = "miotranslate_bookmarks_v1";

export interface BookmarkItem {
  id: string;
  type: "page" | "tag";
  pageId: string;
  tagId?: string;
  name: string;
  bookmarkedAt: string;
}

export class BookmarkService {
  private static getStoredBookmarks(): BookmarkItem[] {
    try {
      const data = localStorage.getItem(BOOKMARKS_STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  private static saveBookmarks(items: BookmarkItem[]): void {
    try {
      localStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.error("Failed to save bookmarks", e);
    }
  }

  static getBookmarks(): BookmarkItem[] {
    return this.getStoredBookmarks();
  }

  static isBookmarked(id: string): boolean {
    return this.getStoredBookmarks().some((b) => b.id === id);
  }

  static toggleBookmark(item: Omit<BookmarkItem, "bookmarkedAt">): boolean {
    const list = this.getStoredBookmarks();
    const existingIndex = list.findIndex((b) => b.id === item.id);
    
    if (existingIndex >= 0) {
      list.splice(existingIndex, 1);
      this.saveBookmarks(list);
      return false; // Removed
    } else {
      list.unshift({ ...item, bookmarkedAt: new Date().toISOString() });
      this.saveBookmarks(list);
      return true; // Added
    }
  }
}
