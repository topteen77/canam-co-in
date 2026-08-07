import axios from 'axios';

// Backend API: set VITE_API_URL in project-root .env (must match PUBLIC_BACKEND_URL + /api)
const API_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) ||
  'http://localhost:5001/api'; 

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT from localStorage on every request
apiClient.interceptors.request.use((config) => {
  const token = typeof localStorage !== 'undefined' && localStorage.getItem('crmToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.warn('API Error:', error.response?.status, error.message);
    return Promise.reject(error);
  }
);

export default apiClient;