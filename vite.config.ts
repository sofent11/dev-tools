import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(() => {
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
          react(),
          tailwindcss(),
      ],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        chunkSizeWarningLimit: 650,
        rollupOptions: {
          output: {
            manualChunks(id) {
              if (!id.includes('node_modules')) return;
              if (id.includes('/react') || id.includes('/react-dom') || id.includes('/scheduler')) {
                return 'vendor-react';
              }
              if (id.includes('/three/')) {
                return 'vendor-three';
              }
              if (id.includes('/katex')) {
                return 'vendor-markdown';
              }
              if (id.includes('/pdf-lib') || id.includes('/jszip')) {
                return 'vendor-documents';
              }
              if (id.includes('/sql-formatter') || id.includes('/fast-xml-parser') || id.includes('/papaparse') || id.includes('/js-yaml')) {
                return 'vendor-data';
              }
            },
          },
        },
      }
    };
});
