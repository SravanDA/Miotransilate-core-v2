import { apiClient } from '../client';

export interface ImportValidationRow {
  rowNumber: number;
  pageId: string;
  tagName: string;
  englishText: string;
  status: "IMPORTED" | "UPDATED" | "SKIPPED";
  reason: string;
}

export interface ImportSummary {
  timestamp: string;
  fileName: string;
  fileSizeBytes: number;
  totalRows: number;
  importedCount?: number;
  updatedCount?: number;
  skippedCount?: number;
  pagesCount: number;
  tagsCount: number;
  translationsCount: number;
  rows: ImportValidationRow[];
}

export interface ImportEvent {
  importEventId: string;
  // Other fields based on backend definition
}

export const MigrationService = {
  resetMigratedData: async (): Promise<any> => {
    const response = await apiClient.delete('/v1/migrations/reset');
    return response.data;
  },

  uploadImportFile: async (formData: FormData): Promise<ImportEvent> => {
    // Explicitly let axios handle Content-Type for FormData
    const response = await apiClient.post('/v1/migrations', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  },

  executeImport: async (importEventId: string): Promise<void> => {
    await apiClient.post(`/v1/migrations/${importEventId}/execute`);
  }
};
