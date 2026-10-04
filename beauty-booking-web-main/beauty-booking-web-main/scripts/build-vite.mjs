import { build } from 'vite';
import react from '@vitejs/plugin-react';

await build({
  configFile: false,
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom', 'zustand'],
          charts: ['recharts'],
          icons: ['lucide-react'],
          'date-vendor': ['date-fns'],
        },
      },
    },
  },
});
