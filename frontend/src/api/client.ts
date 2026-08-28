import axios from 'axios';

export const apiClient = axios.create({
  baseURL: '/', // Proxied by Vite in dev
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
  timeout: 30000
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('miotranslate_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  const simulatedRole = localStorage.getItem('miotranslate_simulate_role');
  if (simulatedRole && config.headers) {
    config.headers['X-Simulate-Roles'] = simulatedRole;
  }
  
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const status = error.response.status;
      if (status === 401) {
        // Clear token and redirect to login
        localStorage.removeItem('miotranslate_token');
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
      if (status === 409) {
        console.error('Optimistic Concurrency Conflict (ETag mismatch)');
      }
    }
    return Promise.reject(error);
  }
);
