const RECENT_STORAGE_KEY = "miotranslate_recent_edits_v1";

export interface RecentEditItem {
  id: string;
  pageId: string;
  tagId?: string;
  title: string;
  module?: string;
  language?: string;
  editedAt: string;
}

export class RecentlyEditedService {
  private static getStored(): RecentEditItem[] {
    try {
      const data = localStorage.getItem(RECENT_STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  private static save(items: RecentEditItem[]): void {
    try {
      localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(items.slice(0, 10)));
    } catch (e) {
      console.error("Failed to save recent edits", e);
    }
  }

  static getRecentEdits(): RecentEditItem[] {
    return this.getStored();
  }

  static recordEdit(item: Omit<RecentEditItem, "editedAt">): void {
    const list = this.getStored().filter((r) => r.id !== item.id);
    list.unshift({ ...item, editedAt: new Date().toISOString() });
    this.save(list);
  }
}
