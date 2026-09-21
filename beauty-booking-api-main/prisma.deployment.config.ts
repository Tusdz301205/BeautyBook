// Invoked only by deploy-main-health.mjs with an allowlisted staged migration directory.
import { defineConfig } from 'prisma/config';
if (!process.env.BEAUTYBOOK_STAGED_MIGRATIONS || !process.env.DATABASE_URL) {
  throw new Error('Controlled deployment environment required');
}
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: process.env.BEAUTYBOOK_STAGED_MIGRATIONS },
  datasource: { url: process.env.DATABASE_URL },
});
