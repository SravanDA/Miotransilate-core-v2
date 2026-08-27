import { apiClient } from '../client';

export interface CoverageMetric {
  pageId: string;
  languageCode: string;
  coveragePercent: number;
  totalTags: number;
  translatedTags: number;
}

export const ReportingService = {
  getCoverageDashboard: async (): Promise<CoverageMetric[]> => {
    const response = await apiClient.get('/v1/dashboard/coverage');
    return response.data;
  }
};
