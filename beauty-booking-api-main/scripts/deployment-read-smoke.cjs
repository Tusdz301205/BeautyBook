// Controlled HTTP smoke: no background workers; only reads and explicitly authorized login.
const assert = require('node:assert/strict');
const { readFileSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
const id = process.env.BEAUTYBOOK_DEPLOYMENT_ID;
assert.match(id ?? '', /^\d{12,14}$/);
const main = process.argv[2] === 'main';
assert.ok(main || process.argv[2] === 'copy');
const root = resolve(`../tmp/main-deployment-${id}`);
assert.equal(JSON.parse(readFileSync(resolve(root, main ? 'main-deploy.json' : 'copy-deploy.json'))).status, 'PASS');
const url = new URL(process.env.DATABASE_URL);
assert.equal(url.pathname, '/glowbook_db');
assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
if (!main) url.pathname = `/beautybook_test_restriction_${id}`;
// Database-level maintenance remains in place for all ordinary application connections.
if (main) url.searchParams.set('options', '-c default_transaction_read_only=off');
process.env.DATABASE_URL = url.toString();
const accounts = [
  ['customer', process.env.PW_CUSTOMER_EMAIL, process.env.PW_CUSTOMER_PASSWORD, 'CUSTOMER'],
  ['owner', process.env.PW_BUSINESS_OWNER_EMAIL, process.env.PW_BUSINESS_OWNER_PASSWORD, 'SALON'],
];
for (const [role, email, password] of accounts) assert.ok(email && password, role + ' smoke credentials required');
const { Test } = require('@nestjs/testing');
const { ValidationPipe } = require('@nestjs/common');
const request = require('supertest');
const { AppModule } = require('../dist/src/app.module');
const { PrismaExceptionFilter } = require('../dist/src/common/filters/prisma-exception.filter');
const workers = [
  ['bookings/pending-bookings.cron', 'PendingBookingsCron'],
  ['bookings/change-request-expiry.worker', 'ChangeRequestExpiryWorker'],
  ['recurring/recurring-plan-recovery.worker', 'RecurringPlanRecoveryWorker'],
  ['operations/waitlist-expiry.worker', 'WaitlistExpiryWorker'],
  ['operations/impact-deadline.worker', 'ImpactDeadlineWorker'],
  ['scheduler/trust-snapshot.cron', 'TrustSnapshotCron'],
  ['scheduler/policy-notification.cron', 'PolicyNotificationCron'],
  ['ownership/ownership-execution.worker', 'OwnershipExecutionWorker'],
  ['notifications/notification-outbox.worker', 'NotificationOutboxWorker'],
];
async function smoke() {
  let builder = Test.createTestingModule({ imports: [AppModule] });
  for (const [file, name] of workers) builder = builder.overrideProvider(require('../dist/src/' + file)[name]).useValue({});
  const module = await builder.compile();
  const app = module.createNestApplication({ logger: false });
  const result = { database: url.pathname.slice(1), startedAt: new Date().toISOString(), workersDisabled: workers.map(w => w[1]), checks: [], status: 'RUNNING' };
  app.use((req, res, next) => {
    if (req.method === 'GET' || (req.method === 'POST' && req.url === '/api/v1/auth/login')) return next();
    res.status(405).json({ message: 'Controlled smoke permits reads and login only' });
  });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: true } }));
  app.useGlobalFilters(new PrismaExceptionFilter());
  try {
    await app.init();
    async function get(path, token, label) {
      let req = request(app.getHttpServer()).get('/api/v1/' + path);
      if (token) req = req.set('Authorization', 'Bearer ' + token);
      const r = await req;
      result.checks.push({ label, status: r.status });
      assert.equal(r.status, 200, label + ' failed');
    }
    for (const path of ['health', 'branches', 'services']) await get(path, null, 'public ' + path);
    for (const [role, email, password, workspace] of accounts) {
      const r = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email, password, workspace });
      result.checks.push({ label: role + ' login', status: r.status });
      assert.equal(r.status, 200, role + ' login failed');
      assert.ok(r.body.accessToken);
      await get('bookings?limit=5', r.body.accessToken, role + ' booking list');
      await get(role === 'customer' ? 'bookings/my-appointments?tab=completed' : 'branches/accessible', r.body.accessToken, role + ' workspace/history');
    }
    result.status = 'PASS';
  } catch (error) {
    result.status = 'FAILED'; result.error = error.message; throw error;
  } finally {
    await app.close();
    result.finishedAt = new Date().toISOString();
    writeFileSync(resolve(root, main ? 'main-read-smoke.json' : 'copy-read-smoke.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
  }
}
smoke().catch(error => { console.error(error.message); process.exitCode = 1; });
