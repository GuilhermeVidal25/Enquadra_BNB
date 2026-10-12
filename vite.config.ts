import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { FileBucket } from './server/file-bucket';
import { localAPIMiddleware } from './server/local-api';
const bucket = new FileBucket(resolve('.local-data'));
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'enquadra-local-api',
      configureServer(server) {
        server.middlewares.use(localAPIMiddleware(bucket));
      },
      configurePreviewServer(server) {
        server.middlewares.use(localAPIMiddleware(bucket));
      },
    },
  ],
  server: { host: '127.0.0.1', port: 5173 },
  preview: { host: '127.0.0.1', port: 4173 },
});
