import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
process.env.VITE_API_BASE='http://localhost:3012/api/v1';
const server=await createServer({configFile:false,plugins:[react()],server:{host:'127.0.0.1',port:5176,strictPort:true,watch:{ignored:['**/report-output/**','**/test-results/**','**/playwright-report/**']}}});
await server.listen(); console.log('Full QA web: http://localhost:5176 (isolated API 3012)');
