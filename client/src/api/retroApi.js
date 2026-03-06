import axios from 'axios';

// Axios instance targeting the Express backend.
// In dev: Vite proxy forwards /api/* to localhost:8888
// In production: same origin (React is served by Express)
const retroApi = axios.create({
  baseURL: '/api',
  timeout: 10_000,
});

export default retroApi;
