export interface PageSummary {
  pageId: string;
  pageName: string;
  tagCount: number;
}

export interface ResolvedTag {
  tagName: string;
  value: string;
  fallbackUsed: boolean;
  fallbackLang: string;
}

export interface RenderResult {
  pageId: string;
  pageName: string;
  environment: string;
  language: string;
  resolvedTags: ResolvedTag[];
}

export interface TagChange {
  tagName: string;
  before: string | null;
  after: string | null;
  type: "ADDED" | "UPDATED" | "UNCHANGED"; // UNCHANGED won't come from backend but for completion
}

export interface ChangeResult {
  pageId: string;
  environment: string;
  language: string;
  changes: TagChange[];
  unchanged: number;
  total: number;
}

const API_BASE = '/playground';

export const PlaygroundApi = {
  getPages: async (): Promise<PageSummary[]> => {
    const res = await fetch(`${API_BASE}/pages`);
    return res.json();
  },

  renderPage: async (pageId: string, lang: string, env: string): Promise<RenderResult> => {
    const res = await fetch(`${API_BASE}/pages/${pageId}/render?lang=${lang}&env=${env}`);
    return res.json();
  },

  getChanges: async (pageId: string, lang: string, env: string): Promise<ChangeResult> => {
    const res = await fetch(`${API_BASE}/changes/${pageId}?lang=${lang}&env=${env}`);
    return res.json();
  },

  reset: async (env?: string, pageId?: string) => {
    let url = `${API_BASE}/reset?`;
    if (env) url += `env=${env}&`;
    if (pageId) url += `pageId=${pageId}`;
    await fetch(url, { method: 'POST' });
  },

  seed: async () => {
    await fetch(`${API_BASE}/seed`, { method: 'POST' });
  }
};
