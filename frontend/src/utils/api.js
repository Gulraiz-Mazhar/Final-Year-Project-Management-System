// src/utils/api.js
import axios from 'axios';

const api = axios.create({
  // Ensure this matches your backend URL
  baseURL: 'http://localhost:5000/api', 
  // 🔒 CRITICAL FIX: Instructs the browser to send the httpOnly cookie automatically
  withCredentials: true, 
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000, 
});

api.interceptors.request.use(
  (config) => {
    // 🔒 SECURITY FIX: We no longer manually extract or inject JWTs from localStorage. 
    // The browser handles the secure cookie automatically.

    // Let the browser set the boundary for multipart/form-data (Cloudinary uploads)
    if (config.data instanceof FormData) {
        delete config.headers['Content-Type'];
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // 401: Unauthorized (Cookie missing or expired)
    if (error.response && error.response.status === 401) {
      console.error('Session expired. Redirecting to login...');
      // Soft logout triggered by the backend rejection
      localStorage.removeItem('user');
      window.location.href = '/';
    }

    // 403: Forbidden (Role restricted)
    if (error.response && error.response.status === 403) {
      console.error('Access denied:', error.response.data?.message);
    }

    return Promise.reject(error);
  }
);

export default api;