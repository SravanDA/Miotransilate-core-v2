import { apiClient } from '../client';

export interface Page {
  pageId: string;
  name: string;
  tagsCount: number;
}

export interface Tag {
  tagId: string;
  pageId: string;
  englishCopy: string;
  status?: string;
  translations?: any[];
}

export const ContentService = {
  getPages: async (): Promise<Page[]> => {
    const response = await apiClient.get('/v1/pages');
    return response.data;
  },

  getPageTags: async (pageId: string): Promise<Tag[]> => {
    const response = await apiClient.get(`/v1/pages/${pageId}/tags`);
    return response.data;
  }
};
