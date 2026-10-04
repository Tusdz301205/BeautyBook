import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

process.env.VITE_API_BASE = 'http://localhost:3011/api/v1';
const server = await createServer({
  root: process.cwd(), configFile: false, plugins: [react()],
  server: { host: '127.0.0.1', port: 5175, strictPort: true, fs: { allow: [process.cwd()] },
    watch: { ignored: ['**/test-results/**', '**/playwright-report/**', '**/report-output/**'] } },
});
await server.listen(); server.printUrls();
