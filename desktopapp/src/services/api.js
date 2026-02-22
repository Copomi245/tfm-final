import axios from 'axios';

const API_BASE_URL = 'http://localhost:3001/api';

// Crear instancia de axios
const api = axios.create({
  baseURL: API_BASE_URL,
});

// Función para configurar la API key
export const setupApiClient = (apiKey) => {
  api.defaults.headers.common['X-API-Key'] = apiKey;
};

// Interceptor para añadir API key automáticamente
api.interceptors.request.use((config) => {
  const apiKey = localStorage.getItem('apiKey');
  if (apiKey) {
    config.headers['X-API-Key'] = apiKey;
  }
  return config;
});

// Interceptor para manejar errores de autenticación
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token inválido, hacer logout
      localStorage.removeItem('apiKey');
      localStorage.removeItem('userEmail');
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

export default api;