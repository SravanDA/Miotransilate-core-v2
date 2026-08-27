import { apiClient } from '../client';

export interface DeploymentEnvironment {
  environment: string; // "DEV", "QA", "PRODUCTION"
  version: number;
}

export const PublishingService = {
  getEnvironmentStatusMatrix: async (): Promise<DeploymentEnvironment[]> => {
    // API-0607
    const response = await apiClient.get('/v1/dashboard/environments');
    return response.data;
  },

  publishRelease: async (environment: string): Promise<any> => {
    // API-0402
    const payload = { environment, triggerSource: "MANUAL_PUSH" };
    const response = await apiClient.post('/v1/publishing/releases', payload);
    return response.data;
  }
};
