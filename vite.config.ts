import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001, // Match the port in server.js
    ws: true,
  },
  build: {
    rollupOptions: {
      external: ['@supabase/supabase-js'],
    },
  },
});
