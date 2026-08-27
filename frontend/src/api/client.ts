import axios from 'axios';

export const apiClient = axios.create({
  baseURL: '/', // Proxied by Vite in dev
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    'Authorization': 'Bearer 11111111-1111-1111-1111-111111111111',
  },
  timeout: 30000
});

apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response) {
      const status = error.response.status;
      if (status === 409) {
        console.error('Optimistic Concurrency Conflict (ETag mismatch)');
      }
    }
    return Promise.reject(error);
  }
);
