import { apiClient } from '../client';

export interface SystemConfiguration {
  configKey: string;
  configValue: string;
  description: string;
  etagVersion: number;
}

export interface Language {
  languageCode: string;
  languageName: string;
  direction: string;
  status: string;
}

export const AdminService = {
  getLanguages: async (): Promise<Language[]> => {
    const response = await apiClient.get('/v1/languages');
    return response.data;
  },

  addLanguage: async (payload: any): Promise<Language> => {
    const response = await apiClient.post('/v1/languages', payload);
    return response.data;
  },

  getConfig: async (): Promise<SystemConfiguration[]> => {
    const response = await apiClient.get('/v1/config');
    return response.data;
  },

  updateConfig: async (key: string, value: string, etag: number): Promise<SystemConfiguration> => {
    const response = await apiClient.patch(`/v1/config/${key}`, { configValue: value }, {
      headers: {
        'If-Match': `"${etag}"`
      }
    });
    return response.data;
  }
};
