import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Proxy API + stream requests to Express backend during development
    proxy: {
      '/api': 'http://localhost:8888',
      '/stream': 'http://localhost:8888',
      '/epg.xml': 'http://localhost:8888',
      '/playlist.m3u': 'http://localhost:8888',
      '/discover.json': 'http://localhost:8888',
      '/lineup.json': 'http://localhost:8888',
    },
  },
  build: {
    outDir: '../server/public',
    emptyOutDir: true,
  },
});