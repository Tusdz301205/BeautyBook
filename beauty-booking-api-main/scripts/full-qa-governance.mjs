import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import bcrypt from 'bcryptjs';

// No dotenv fallback: this runner is restricted to the explicitly assigned runtime.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const env = JSON.parse(readFileSync(resolve(root, 'report-output/full-system-qa/runtime.json'), 'utf8'));
const fixture = JSON.parse(readFileSync(resolve(root, 'report-output/full-system-qa/actors.json'), 'utf8'));
const database = 'beautybook_test_restriction_1791039047659';
assert.equal(new URL(env.DATABASE_URL).pathname, `/${database}`);
assert.equal(fixture.database, database);
assert.equal(env.NODE_ENV, 'test');
assert.equal(String(env.PORT), '3012');
assert.ok(!env.EMAIL_USER && !env.EMAIL_PASS, 'SMTP must be disabled');
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(env.DATABASE_URL).hostname));
const output = resolve(root, 'docs/full-system-qa/evidence/current');
mkdirSync(output, { recursive: true });
const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });
const refreshFinalRegression = process.argv[2] === 'final-regression';
const rounds = process.argv[2] ? [refreshFinalRegression ? 'final' : process.argv[2]] : ['baseline', 'exceptions', 'final'];
assert.ok(rounds.every(r => ['baseline', 'exceptions', 'final'].includes(r)));
const requestedLabel = process.argv[3] || (refreshFinalRegression ? 'final-regression' : undefined);
assert.ok(!requestedLabel || (rounds.length === 1 && /^[a-z0-9-]+$/.test(requestedLabel)), 'Evidence label must be a safe filename component');
let requestNumber = 0;
const bugFields = ['accountNumberCiphertext', 'accountNumberIv', 'authenticationTag'];
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

async function protectedSnapshot() {
  const ids = Object.values(fixture.actors).map(a => a.id);
  const businesses = fixture.businesses.map(b => b.id);
  const data = await Promise.all([
    db.user.findMany({ where: { id: { in: ids } }, select: { id: true, isActive: true, email: true, passwordHash: true, deletedAt: true }, orderBy: { id: 'asc' } }),
    db.userRole.findMany({ where: { userId: { in: ids } }, orderBy: { id: 'asc' } }),
    db.business.findMany({ where: { id: { in: businesses } }, orderBy: { id: 'asc' } }),
    db.businessOwnerProfile.findMany({ where: { userId: { in: ids } }, orderBy: { id: 'asc' } }),
    db.businessService.findMany({ where: { businessId: { in: businesses } }, orderBy: { id: 'asc' } }),
    db.branchServiceOffering.findMany({ where: { branch: { businessId: { in: businesses } } }, orderBy: { id: 'asc' } }),
    pool.query('SELECT * FROM platform_settings ORDER BY id').then(r => r.rows),
  ]);
  return data.map(hash);
}

async function run(round) {
  const suffix = `${Date.now()}-${randomBytes(3).toString('hex')}`;
  const password = randomBytes(20).toString('base64url') + 'aA1!';
  const passwordHash = await bcrypt.hash(password, 10);
  const actors = {}, tokens = {}, refreshTokens = {}, ownedUsers = new Set(), ownedBusinesses = new Set(), ownedTransfers = new Set(), ownedVersions = new Set();
  const evidence = { database, api: 'http://localhost:3012/api/v1', round, startedAt: new Date().toISOString(), syntheticOnly: true, smtpDisabled: true, results: [], requests: [], setup: [], bugs: [] };
  const label = requestedLabel || round;
  const preferredPath = resolve(output, `governance-${label}.json`);
  if (refreshFinalRegression && existsSync(preferredPath)) {
    writeFileSync(resolve(output, `governance-${label}-preserved-${suffix}.json`), readFileSync(preferredPath), { flag: 'wx' });
  }
  const evidencePath = existsSync(preferredPath) && !refreshFinalRegression ? resolve(output, `governance-${label}-${suffix}.json`) : preferredPath;
  let sequence = 0;
  function save() { evidence.updatedAt = new Date().toISOString(); writeFileSync(evidencePath, JSON.stringify(evidence, null, 2)); }
  async function test(name, fn) {
    const id = `GOV-${round.toUpperCase()}-${String(++sequence).padStart(3, '0')}`;
    const requestStart = evidence.requests.length;
    try { evidence.results.push({ id, name, status: 'PASS', kind: 'REAL_API_DATABASE', detail: await fn(), requests: [requestStart, evidence.requests.length] }); }
    catch (error) {
      // Assertions intentionally use fixed messages; never serialize Prisma or response objects.
      const message = error instanceof assert.AssertionError ? error.message.split('\n')[0] : `Runner error (${error?.name || 'Error'}); response bodies suppressed`;
      evidence.results.push({ id, name, status: 'FAIL', kind: 'REAL_API_DATABASE', error: message, requests: [requestStart, evidence.requests.length] });
      console.log(`FAIL ${id}: ${name}: ${message}`);
    }
    save();
  }
  function bug(code, detail) { if (!evidence.bugs.some(b => b.code === code)) { evidence.bugs.push({ code, confirmed: true, detail }); console.log(`CONFIRMED_BUG ${code}: ${detail}`); save(); } }
  async function call(method, path, actor, body) {
    const form = body instanceof FormData;
    const r = await fetch(`http://localhost:3012/api/v1${path}`, { method, signal: AbortSignal.timeout(20000), headers: {
      ...(form ? {} : { 'Content-Type': 'application/json' }), 'X-Forwarded-For': `127.17.${Math.floor(++requestNumber / 200) % 200}.${requestNumber % 200 + 1}`,
      ...(actor ? { Authorization: `Bearer ${tokens[actor]}` } : {}),
    }, ...(body === undefined ? {} : { body: form ? body : JSON.stringify(body) }) });
    const text = await r.text(); let parsed; try { parsed = JSON.parse(text); } catch { parsed = null; }
    evidence.requests.push({ method, path, actor: actor || 'anonymous', status: r.status });
    return { status: r.status, body: parsed };
  }
  function ok(r, expected = [200, 201]) { assert.ok([].concat(expected).includes(r.status), `HTTP ${r.status}; expected ${[].concat(expected).join('/')}`); return r.body; }
  async function login(key, businessId) {
    const a = key === 'admin' ? fixture.actors.platform_admin : actors[key];
    const data = ok(await call('POST', '/auth/login', null, { email: a.email, password: key === 'admin' ? a.password : password, workspace: key === 'admin' ? 'PLATFORM' : a.workspace, ...(businessId ? { businessId } : {}), refreshTokenTransport: 'BODY' }), 200);
    assert.equal(typeof data.accessToken, 'string', 'Login must issue access token'); tokens[key] = data.accessToken; refreshTokens[key] = data.refreshToken;
    return data;
  }
  async function account(key, role) {
    const r = await db.role.findUniqueOrThrow({ where: { code: role } });
    const user = await db.user.create({ data: { email: `qa-governance-${key.toLowerCase()}-${suffix}@example.test`, fullName: `Synthetic governance ${key}`, passwordHash, isEmailVerified: true, isPhoneVerified: true,
      ...(role === 'BUSINESS_OWNER' ? { ownerProfile: { create: { companyName: 'Synthetic governance company' } } } : { customerProfile: { create: {} } }),
      userRoles: { create: { roleId: r.id } },
    }, include: { ownerProfile: true } });
    ownedUsers.add(user.id); actors[key] = { id: user.id, email: user.email, workspace: role === 'CUSTOMER' ? 'CUSTOMER' : 'SALON', ownerId: user.ownerProfile?.id };
    evidence.setup.push({ action: 'CREATE_SYNTHETIC_ACCOUNT', key, id: user.id, role }); return user;
  }
  function assertBusiness(id) { assert.ok(ownedBusinesses.has(id), 'Mutation target must be a business created by this run'); }
  async function businessCall(method, id, suffixPath, actor, body) { assertBusiness(id); return call(method, `/business/${id}${suffixPath}`, actor, body); }
  async function transferCall(method, id, suffixPath, actor, body) { assert.ok(ownedTransfers.has(id), 'Mutation target must be a transfer created by this run'); return call(method, `/ownership-transfers/${id}${suffixPath}`, actor, body); }
  async function createTransfer(businessId, target = 'newOwner', extra = {}) {
    assertBusiness(businessId);
    const r = await call('POST', '/ownership-transfers', 'owner', { businessId, newOwnerEmail: actors[target].email, effectiveAt: new Date(Date.now() + 120000).toISOString(), reason: 'Synthetic governance transfer', ...extra });
    if (r.status === 201 && r.body?.id) ownedTransfers.add(r.body.id);
    return r;
  }
  async function version(businessId, type, data) {
    assertBusiness(businessId); const value = ok(await call('POST', `/ownership-transfers/business/${businessId}/${type}`, 'owner', data));
    ownedVersions.add(value.id); return value;
  }
  async function verify(type, id, actor = 'admin', body = { approve: true, reason: 'Synthetic verification' }) {
    assert.ok(ownedVersions.has(id), 'Verification target must be a version created by this run');
    return call('PATCH', `/ownership-transfers/platform/${type}/${id}/verify`, actor, body);
  }
  const before = await protectedSnapshot();
  let business, transfer, legal, payout;
  try {
    assert.equal((await pool.query('SELECT current_database() name')).rows[0].name, database);
    for (const [key, role] of [['owner', 'BUSINESS_OWNER'], ['newOwner', 'BUSINESS_OWNER'], ['stranger', 'BUSINESS_OWNER'], ['customer', 'CUSTOMER']]) await account(key, role);
    await test('Runtime provenance: API authentication writes a session to the guarded DB', async () => {
      await login('owner'); const session = await db.userSession.findFirst({ where: { userId: actors.owner.id, revokedAt: null, workspace: 'SALON' } });
      assert.ok(session, 'API session must exist in guarded database'); return { currentDatabaseVerified: true, apiSessionInGuardedDb: true };
    });
    // Abort writes through the API if provenance failed.
    assert.equal(evidence.results.at(-1).status, 'PASS', 'Runtime provenance must pass');
    await login('admin'); await login('newOwner'); await login('stranger'); await login('customer');
    await test('Onboarding rejects missing brand and slug', async () => { ok(await call('POST', '/business/onboarding/draft', 'owner', {}), 400); });
    await test('Customer cannot create business draft', async () => { ok(await call('POST', '/business/onboarding/draft', 'customer', { name: 'Synthetic forbidden', slug: `forbidden-${suffix}` }), 403); });
    await test('Create new business through actual onboarding API', async () => {
      business = ok(await call('POST', '/business/onboarding/draft', 'owner', { name: `Governance QA ${round}`, slug: `governance-${suffix}` }));
      ownedBusinesses.add(business.id); assert.equal(business.status, 'DRAFT', 'New business must be DRAFT');
      const stored = await db.business.findUniqueOrThrow({ where: { id: business.id } }); assert.equal(stored.ownerId, actors.owner.ownerId, 'Owner profile must match');
      await login('owner', business.id); return { id: business.id, status: stored.status };
    });
    assert.ok(business, 'Business setup required');
    await test('Incomplete onboarding submit is rejected without status mutation', async () => { ok(await businessCall('POST', business.id, '/submit', 'owner'), 400); assert.equal((await db.business.findUniqueOrThrow({ where: { id: business.id } })).status, 'DRAFT', 'Invalid submit must leave DRAFT'); });
    await test('Onboarding configuration contract', async () => { const config = ok(await call('GET', '/business/onboarding/config', 'owner')); assert.ok(config.businessTypes.some(x => x.code === 'HAIR_SALON'), 'Business type catalog must contain HAIR_SALON'); return { requiredDocuments: config.requiredDocuments, requirePhoneVerification: config.requirePhoneVerification }; });
    await test('Upload private synthetic legal documents and complete onboarding', async () => {
      const docs = [];
      for (const documentType of ['BUSINESS_LICENSE', 'OWNER_ID_CARD']) {
        const form = new FormData(); form.append('entityType', 'LEGAL_DOCUMENT'); form.append('entityId', business.id); form.append('businessId', business.id);
        form.append('file', new Blob(['%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n'], { type: 'application/pdf' }), 'synthetic-qa.pdf');
        const media = ok(await call('POST', '/media/upload', 'owner', form)); assert.equal(media.visibility, 'PRIVATE', 'Legal documents must be private');
        docs.push({ documentType, documentName: `Synthetic ${documentType}`, documentUrl: `/api/v1/media/${media.id}/content`, mediaId: media.id });
      }
      ok(await businessCall('PATCH', business.id, '/onboarding', 'owner', { companyName: 'Synthetic governance corporation', taxCode: suffix.replace(/[^0-9]/g, '').slice(-10), contactEmail: actors.owner.email, contactPhone: '0909991234', addressLine: 'Synthetic address for QA', legalRepresentative: 'Synthetic QA Representative', onboardingData: { businessType: 'HAIR_SALON' }, legalDocuments: docs }));
      const stored = await db.business.findUniqueOrThrow({ where: { id: business.id } }); assert.equal(stored.contactPhone, '+84909991234', 'Vietnam phone must normalize');
      return { privateDocumentCount: docs.length, normalizedPhone: true };
    });
    await test('Stranger cannot edit newly created onboarding entity', async () => { ok(await businessCall('PATCH', business.id, '/onboarding', 'stranger', { name: 'Unauthorized synthetic edit' }), 403); });
    await test('Submit, request information, resubmit and approve new onboarding entity', async () => {
      const submitted = ok(await businessCall('POST', business.id, '/submit', 'owner'));
      if (submitted.status === 'APPROVED') return { status: 'APPROVED', policyAutoApproved: true, manualReviewNotApplicable: true };
      assert.equal(submitted.status, 'PENDING_REVIEW', 'Submission must require review');
      ok(await businessCall('POST', business.id, '/submit', 'owner'), 409);
      assert.equal(ok(await businessCall('PATCH', business.id, '/review', 'admin', { decision: 'REQUEST_INFO', note: 'Synthetic request information' })).status, 'NEED_MORE_INFO', 'Request info must transition');
      ok(await businessCall('PATCH', business.id, '/onboarding', 'owner', { description: 'Synthetic supplementary information' }));
      assert.equal(ok(await businessCall('POST', business.id, '/submit', 'owner')).status, 'PENDING_REVIEW', 'Resubmit must transition');
      assert.equal(ok(await businessCall('PATCH', business.id, '/review', 'admin', { decision: 'APPROVE', note: 'Synthetic QA approval' })).status, 'APPROVED', 'Review must approve');
      const events = await db.businessReviewEvent.findMany({ where: { businessId: business.id } }); assert.ok(['SUBMIT', 'REQUEST_INFO', 'RESUBMIT', 'APPROVE'].every(action => events.some(e => e.action === action)), 'All onboarding review events must persist');
      return { status: 'APPROVED', eventCount: events.length };
    });
    await test('Approved onboarding cannot be edited or reviewed twice', async () => { ok(await businessCall('PATCH', business.id, '/onboarding', 'owner', { name: 'Synthetic forbidden edit' }), 409); ok(await businessCall('PATCH', business.id, '/review', 'admin', { decision: 'APPROVE' }), 409); });
    await test('Customer recipient is rejected by account separation', async () => { const count = await db.ownershipTransfer.count({ where: { businessId: business.id } }); ok(await createTransfer(business.id, 'customer'), 409); assert.equal(await db.ownershipTransfer.count({ where: { businessId: business.id } }), count, 'Rejected customer must create no transfer'); });
    await test('Self transfer, past date and empty reason are rejected', async () => { ok(await createTransfer(business.id, 'owner'), 400); ok(await createTransfer(business.id, 'newOwner', { effectiveAt: '2000-01-01T00:00:00Z' }), 400); ok(await createTransfer(business.id, 'newOwner', { reason: '' }), 400); });
    await test('Create, cancel and reject repeat cancellation', async () => {
      const cancelled = ok(await createTransfer(business.id)); assert.equal(cancelled.status, 'PENDING_NEW_OWNER_ACCEPTANCE', 'Transfer must await recipient');
      ok(await transferCall('PATCH', cancelled.id, '/cancel', 'stranger', { reason: 'Not requester' }), 409);
      assert.equal(ok(await transferCall('PATCH', cancelled.id, '/cancel', 'owner', { reason: 'Synthetic cancellation' })).status, 'CANCELLED', 'Cancellation must transition');
      ok(await transferCall('PATCH', cancelled.id, '/cancel', 'owner', { reason: 'Repeat' }), 409); ok(await transferCall('PATCH', cancelled.id, '/accept', 'newOwner'), 409);
      assert.equal((await db.business.findUniqueOrThrow({ where: { id: business.id } })).ownerId, actors.owner.ownerId, 'Cancellation must preserve owner'); return { transferId: cancelled.id };
    });
    await test('Platform rejection is terminal and does not transfer ownership', async () => {
      const rejected = ok(await createTransfer(business.id)); ok(await transferCall('PATCH', rejected.id, '/accept', 'newOwner'));
      assert.equal(ok(await transferCall('PATCH', rejected.id, '/review', 'admin', { approve: false, reason: 'Synthetic review rejection' })).status, 'REJECTED', 'Negative review must reject');
      ok(await transferCall('POST', rejected.id, '/execute', 'admin'), 409);
      ok(await transferCall('PATCH', rejected.id, '/review', 'admin', { approve: true, reason: 'Repeat terminal review' }), 409);
      assert.equal((await db.business.findUniqueOrThrow({ where: { id: business.id } })).ownerId, actors.owner.ownerId, 'Rejection must preserve owner');
      return { transferId: rejected.id, terminalStatus: 'REJECTED' };
    });
    await test('Create transfer and prevent a second live transfer', async () => { transfer = ok(await createTransfer(business.id)); ok(await createTransfer(business.id), 409); return { transferId: transfer.id, status: transfer.status }; });
    assert.ok(transfer, 'Transfer setup required');
    await test('Only intended recipient can accept; acceptance cannot repeat', async () => {
      ok(await transferCall('PATCH', transfer.id, '/accept', 'stranger'), 409); ok(await transferCall('PATCH', transfer.id, '/accept', 'customer'), 409);
      const accepted = ok(await transferCall('PATCH', transfer.id, '/accept', 'newOwner')); assert.equal(accepted.status, 'UNDER_REVIEW', 'Acceptance must transition'); assert.ok(accepted.acceptedByNewOwnerAt, 'Acceptance timestamp required');
      ok(await transferCall('PATCH', transfer.id, '/accept', 'newOwner'), 409);
    });
    await test('Incoming and platform queue contain only authorized review view', async () => {
      assert.ok(ok(await call('GET', '/ownership-transfers/pending-for-me', 'newOwner')).some(t => t.id === transfer.id), 'Recipient queue must include transfer');
      assert.ok(!ok(await call('GET', '/ownership-transfers/pending-for-me', 'stranger')).some(t => t.id === transfer.id), 'Stranger queue must omit transfer');
      ok(await call('GET', '/ownership-transfers/platform/pending', 'owner'), 403);
      assert.ok(ok(await call('GET', '/ownership-transfers/platform/pending', 'admin')).some(t => t.id === transfer.id), 'Admin queue must include transfer');
    });
    await test('Non-admin cannot review or execute; anonymous cannot accept', async () => { ok(await transferCall('PATCH', transfer.id, '/review', 'owner', { approve: true, reason: 'Unauthorized review' }), 403); ok(await transferCall('POST', transfer.id, '/execute', 'newOwner'), 403); ok(await transferCall('PATCH', transfer.id, '/accept', null), 401); });
    await test('Approval without verified versions is rejected', async () => { ok(await transferCall('PATCH', transfer.id, '/review', 'admin', { approve: true, reason: 'Missing versions' }), 409); });
    await test('Request information prevents approval until requester resubmits', async () => {
      assert.equal(ok(await transferCall('PATCH', transfer.id, '/review', 'admin', { approve: false, needMoreInfo: true, reason: 'Synthetic settlement detail needed' })).status, 'NEED_MORE_INFO', 'Request information must transition');
      ok(await transferCall('PATCH', transfer.id, '/review', 'admin', { approve: true, reason: 'Premature approval' }), 409);
      ok(await transferCall('PATCH', transfer.id, '/submit-more-info', 'stranger', { note: 'Wrong requester' }), 409);
      ok(await transferCall('PATCH', transfer.id, '/submit-more-info', 'owner', { note: '' }), 400);
      const resubmitted = ok(await transferCall('PATCH', transfer.id, '/submit-more-info', 'owner', { note: 'Synthetic settlement supplied', settlementAgreement: { synthetic: true, note: 'No real liabilities' } }));
      assert.equal(resubmitted.status, 'UNDER_REVIEW', 'More information must restore review');
    });
    await test('Legal and payout validation rejects missing fields', async () => { ok(await call('POST', `/ownership-transfers/business/${business.id}/legal-entity`, 'owner', {}), 400); ok(await call('POST', `/ownership-transfers/business/${business.id}/payout-account`, 'owner', {}), 400); });
    await test('Create pending legal and payout versions, verify DB encryption', async () => {
      legal = await version(business.id, 'legal-entity', { legalName: 'Synthetic new legal entity', taxCode: 'SYNTHETIC-QA' });
      payout = await version(business.id, 'payout-account', { bankName: 'Synthetic bank (no external integration)', accountHolder: 'Synthetic QA holder', accountNumber: '000000001234' });
      assert.equal(legal.verificationStatus, 'PENDING', 'Legal version must start PENDING'); assert.equal(payout.verificationStatus, 'PENDING', 'Payout version must start PENDING');
      const stored = await db.payoutAccountVersion.findUniqueOrThrow({ where: { id: payout.id } }); assert.ok(stored.accountNumberCiphertext && stored.accountNumberCiphertext !== '000000001234', 'Account number must be encrypted'); assert.equal(stored.maskedAccountNumber, '****1234', 'Account number must be masked');
      return { legalVersionId: legal.id, payoutVersionId: payout.id, encryptedAtRest: true };
    });
    assert.ok(legal && payout, 'Version setup required');
    await test('Payout creation response excludes encrypted account material', async () => {
      const exposed = bugFields.filter(k => Object.hasOwn(payout, k));
      if (exposed.length) bug('GOV-PAYOUT-CREATE-CRYPTO-EXPOSURE', `Payout creation response exposes ${exposed.join(', ')}; values suppressed.`);
      assert.equal(exposed.length, 0, 'Payout create response must omit cryptographic fields');
    });
    await test('Unverified versions cannot approve transfer; tenant verification is forbidden', async () => { ok(await transferCall('PATCH', transfer.id, '/review', 'admin', { approve: true, reason: 'Unverified versions' }), 409); ok(await verify('legal-entity', legal.id, 'owner'), 403); });
    await test('Verify both versions; repeat verification rejected and safe list response', async () => {
      assert.equal(ok(await verify('legal-entity', legal.id)).verificationStatus, 'VERIFIED', 'Legal version must verify');
      const verified = ok(await verify('payout-account', payout.id)); assert.equal(verified.verificationStatus, 'VERIFIED', 'Payout version must verify'); assert.ok(bugFields.every(k => !Object.hasOwn(verified, k)), 'Verification response must omit cryptographic material');
      ok(await verify('legal-entity', legal.id), 409); ok(await verify('payout-account', payout.id), 409);
      const versions = ok(await call('GET', `/ownership-transfers/business/${business.id}/versions`, 'owner')); assert.ok(versions.payoutAccounts.every(v => bugFields.every(k => !Object.hasOwn(v, k))), 'Version list must omit cryptographic material');
      ok(await call('GET', `/ownership-transfers/business/${business.id}/versions`, 'stranger'), 403);
    });
    await test('Approval captures verified versions and schedules future execution', async () => {
      const approved = ok(await transferCall('PATCH', transfer.id, '/review', 'admin', { approve: true, reason: 'Synthetic governance approval' })); assert.equal(approved.status, 'SCHEDULED', 'Future transfer must be SCHEDULED');
      assert.equal(approved.legalEntityVersionId, legal.id, 'Approval must bind legal version'); assert.equal(approved.payoutAccountVersionId, payout.id, 'Approval must bind payout version');
      ok(await transferCall('PATCH', transfer.id, '/review', 'admin', { approve: true, reason: 'Repeat' }), 409);
      ok(await transferCall('POST', transfer.id, '/execute', 'admin'), 409);
    });
    await test('Execute due transfer; verify owner, history, versions, roles and session revocation', async () => {
      // Explicit clock fixture: only this run's newly created transfer is made due.
      assert.ok(ownedTransfers.has(transfer.id));
      const changed = await db.ownershipTransfer.updateMany({ where: { id: transfer.id, businessId: business.id, requestedBy: actors.owner.id, status: 'SCHEDULED' }, data: { effectiveAt: new Date(Date.now() - 1000) } }); assert.equal(changed.count, 1, 'Synthetic clock fixture must target one scheduled transfer');
      evidence.setup.push({ action: 'MAKE_NEW_SYNTHETIC_TRANSFER_DUE', transferId: transfer.id, purpose: 'Avoid wall-clock delay; preserve API review/acceptance gates' });
      const branch = await db.branch.create({ data: { businessId: business.id, name: 'Synthetic governance liability branch', status: 'PENDING', reviewStatus: 'DRAFT', operationalStatus: 'INACTIVE' } });
      const liability = await db.paymentTransaction.create({ data: { businessId: business.id, branchId: branch.id, amount: 1, method: 'CASH', provider: 'SYNTHETIC_QA_NO_EXTERNAL_PAYMENT', status: 'PENDING', idempotencyKey: randomUUID() } });
      evidence.setup.push({ action: 'CREATE_NEW_SYNTHETIC_PENDING_LIABILITY', businessId: business.id, branchId: branch.id, transactionId: liability.id, externalPayment: false });
      try {
        ok(await transferCall('POST', transfer.id, '/execute', 'admin'), 409);
        assert.equal((await db.business.findUniqueOrThrow({ where: { id: business.id } })).ownerId, actors.owner.ownerId, 'Liability-blocked execution must preserve owner');
        assert.equal(await db.ownershipHistory.count({ where: { businessId: business.id } }), 0, 'Liability-blocked execution must not create history');
        assert.equal((await db.ownershipTransfer.findUniqueOrThrow({ where: { id: transfer.id } })).status, 'SCHEDULED', 'Liability rejection must preserve scheduled state');
      } finally {
        // Retain the synthetic transaction as evidence; mark only this newly created fixture failed.
        await db.paymentTransaction.update({ where: { id: liability.id }, data: { status: 'FAILED', failureReason: 'Synthetic fixture cleared; no external payment attempted' } });
      }
      assert.equal(ok(await transferCall('POST', transfer.id, '/execute', 'admin')).status, 'COMPLETED', 'Execution must complete');
      const stored = await db.business.findUniqueOrThrow({ where: { id: business.id } }); assert.equal(stored.ownerId, actors.newOwner.ownerId, 'Business must bind new owner');
      assert.equal(await db.userRole.count({ where: { userId: actors.owner.id, businessId: business.id, role: { code: 'BUSINESS_OWNER' } } }), 0, 'Old tenant owner role must be removed');
      assert.equal(await db.userRole.count({ where: { userId: actors.newOwner.id, businessId: business.id, role: { code: 'BUSINESS_OWNER' } } }), 1, 'New tenant owner role must be unique');
      assert.equal(await db.userSession.count({ where: { userId: actors.owner.id, businessId: business.id, workspace: 'SALON', revokedAt: null } }), 0, 'Old scoped sessions must be revoked');
      assert.equal(await db.ownershipHistory.count({ where: { businessId: business.id, validTo: null, ownerId: actors.newOwner.ownerId } }), 1, 'New owner must have exactly one open history');
      for (const [model, id] of [[db.legalEntityVersion, legal.id], [db.payoutAccountVersion, payout.id]]) assert.equal((await model.findUniqueOrThrow({ where: { id } })).isActive, true, 'Selected version must become active');
      return { transferId: transfer.id, pendingLiabilityBlockedWithNoMutation: true, ownerChanged: true, oldRoleRemoved: true, scopedSessionsRevoked: true, versionsActivated: true };
    });
    await test('Repeated execution is idempotent with unchanged history and audit count', async () => {
      const history = await db.ownershipHistory.count({ where: { businessId: business.id } }); const audit = await db.auditLog.count({ where: { entityType: 'BusinessOwnership', entityId: business.id } });
      assert.equal(ok(await transferCall('POST', transfer.id, '/execute', 'admin')).status, 'COMPLETED', 'Repeated execution must return completed');
      assert.equal(await db.ownershipHistory.count({ where: { businessId: business.id } }), history, 'Repeat must not duplicate history'); assert.equal(await db.auditLog.count({ where: { entityType: 'BusinessOwnership', entityId: business.id } }), audit, 'Repeat must not duplicate ownership audit');
    });
    await test('Old access and refresh tokens lose business permissions immediately', async () => {
      ok(await call('GET', `/ownership-transfers/business/${business.id}/versions`, 'owner'), 401);
      assert.equal(typeof refreshTokens.owner, 'string', 'Old owner refresh token required');
      ok(await call('POST', '/auth/refresh', null, { refreshToken: refreshTokens.owner, refreshTokenTransport: 'BODY' }), 401);
      ok(await call('POST', '/ownership-transfers', 'owner', { businessId: business.id, newOwnerEmail: actors.stranger.email, effectiveAt: new Date(Date.now() + 120000).toISOString(), reason: 'Revoked token attempt' }), 401);
      ok(await call('POST', '/auth/login', null, { email: actors.owner.email, password, workspace: 'SALON', businessId: business.id }), 401);
      return { oldAccessRejected: true, oldRefreshRejected: true, oldScopedLoginRejected: true };
    });
    await test('New owner can relogin in acquired business and inspect versions', async () => { await login('newOwner', business.id); const versions = ok(await call('GET', `/ownership-transfers/business/${business.id}/versions`, 'newOwner')); assert.ok(versions.legalEntities.some(v => v.id === legal.id && v.isActive), 'New owner must see active legal version'); });
    await test('Ownership audit and participant notifications persist', async () => {
      const events = await db.auditLog.findMany({ where: { entityId: transfer.id, entityType: 'OwnershipTransfer' }, select: { action: true, newData: true } });
      assert.ok(events.some(e => e.action === 'CREATE'), 'Transfer create audit must exist');
      assert.ok(['UNDER_REVIEW', 'NEED_MORE_INFO', 'SCHEDULED'].every(s => events.some(e => e.newData?.status === s)), 'Workflow transitions must be audited');
      assert.ok(await db.auditLog.count({ where: { entityType: 'BusinessOwnership', entityId: business.id } }), 'Execution ownership audit must exist');
      for (const userId of [actors.owner.id, actors.newOwner.id]) assert.ok(await db.notification.count({ where: { userId, targetId: transfer.id } }), 'Each party must have transfer notification');
      return { transferAuditCount: events.length, participantNotifications: true };
    });
    if (round !== 'baseline') {
      for (const [type, field, valid, model] of [
        ['legal-entity', 'legalName', { legalName: 'Synthetic numeric legal name probe' }, db.legalEntityVersion],
        ['legal-entity', 'taxCode', { legalName: 'Synthetic numeric tax code probe' }, db.legalEntityVersion],
        ['payout-account', 'bankName', { bankName: 'Synthetic QA bank', accountHolder: 'Synthetic QA holder', accountNumber: '000000001234' }, db.payoutAccountVersion],
        ['payout-account', 'accountNumber', { bankName: 'Synthetic QA bank', accountHolder: 'Synthetic QA holder', accountNumber: '000000001234' }, db.payoutAccountVersion],
      ]) {
        await test(`Numeric ${type} ${field} rejects with 400 and creates no version`, async () => {
          assertBusiness(business.id);
          const beforeCount = await model.count({ where: { businessId: business.id } });
          const response = await call('POST', `/ownership-transfers/business/${business.id}/${type}`, 'newOwner', { ...valid, [field]: 42 });
          const afterCount = await model.count({ where: { businessId: business.id } });
          if (response.status === 500) bug(`GOV-${type.toUpperCase()}-${field.toUpperCase()}-TYPE-500`, `POST ${type} with numeric ${field}=42 returns HTTP 500; version count ${beforeCount} -> ${afterCount}.`);
          assert.equal(afterCount, beforeCount, 'Invalid numeric field must create no version');
          ok(response, 400);
          return { field, rejectedWith400: true, versionCountUnchanged: true };
        });
      }
      await test('Malformed verify approve string is rejected without status change', async () => {
        // New owner's version on the newly acquired synthetic business only.
        const candidate = ok(await call('POST', `/ownership-transfers/business/${business.id}/legal-entity`, 'newOwner', { legalName: 'Synthetic malformed verification probe' })); ownedVersions.add(candidate.id);
        const r = await verify('legal-entity', candidate.id, 'admin', { approve: 'false', reason: 'Synthetic malformed boolean probe' });
        const stored = await db.legalEntityVersion.findUniqueOrThrow({ where: { id: candidate.id } });
        if (r.status === 200 && stored.verificationStatus === 'VERIFIED') bug('GOV-VERIFY-BOOLEAN-COERCION', 'Platform verification with approve="false" returns 200 and persists VERIFIED instead of rejecting invalid boolean.');
        ok(r, 400); assert.equal(stored.verificationStatus, 'PENDING', 'Malformed verification must not change status');
      });
      await test('Malformed ownership payload is rejected with a client error', async () => {
        const r = await call('POST', '/ownership-transfers', 'newOwner', { businessId: business.id, newOwnerEmail: 42, effectiveAt: new Date(Date.now() + 120000).toISOString(), reason: 'Synthetic malformed email type' });
        if (r.status === 500) bug('GOV-CREATE-INVALID-TYPE-500', 'Ownership create with numeric newOwnerEmail returns HTTP 500 instead of a validation error.');
        ok(r, 400); assert.equal(await db.ownershipTransfer.count({ where: { businessId: business.id, status: 'PENDING_NEW_OWNER_ACCEPTANCE' } }), 0, 'Malformed payload must create no transfer');
      });
      await test('Malformed transfer review approve string cannot approve a transfer', async () => {
        const candidate = ok(await call('POST', '/ownership-transfers', 'newOwner', { businessId: business.id, newOwnerEmail: actors.stranger.email, effectiveAt: new Date(Date.now() + 120000).toISOString(), reason: 'Synthetic malformed review probe' })); ownedTransfers.add(candidate.id);
        ok(await transferCall('PATCH', candidate.id, '/accept', 'stranger'));
        const response = await transferCall('PATCH', candidate.id, '/review', 'admin', { approve: 'false', reason: 'Synthetic false string review probe' });
        const stored = await db.ownershipTransfer.findUniqueOrThrow({ where: { id: candidate.id } });
        if (response.status === 200 && ['APPROVED', 'SCHEDULED'].includes(stored.status)) bug('GOV-REVIEW-BOOLEAN-COERCION', 'Ownership review with approve="false" returns 200 and persists SCHEDULED instead of rejecting invalid boolean.');
        // Close this synthetic probe through the normal cancellation API; never execute it.
        if (['UNDER_REVIEW', 'SCHEDULED', 'NEED_MORE_INFO'].includes(stored.status)) ok(await transferCall('PATCH', candidate.id, '/cancel', 'newOwner', { reason: 'Close synthetic malformed review probe' }));
        ok(response, 400);
      });
    }
  } catch (error) {
    evidence.setupFailure = error instanceof assert.AssertionError ? error.message.split('\n')[0] : `Setup interrupted (${error?.name || 'Error'}); sensitive details suppressed`;
    console.log(`SETUP_FAILURE ${round}: ${evidence.setupFailure}`);
  } finally {
    await test('Base fixture actors, businesses, services and platform settings are unchanged', async () => { assert.deepEqual(await protectedSnapshot(), before, 'Protected base fixture snapshots must remain unchanged'); return { comparedGroups: 7, unchanged: true }; });
    evidence.finishedAt = new Date().toISOString(); evidence.summary = { pass: evidence.results.filter(r => r.status === 'PASS').length, fail: evidence.results.filter(r => r.status === 'FAIL').length, confirmedBugs: evidence.bugs.length, requests: evidence.requests.length };
    save(); console.log(`${round}: ${JSON.stringify(evidence.summary)}`);
    const archivePath = resolve(output, `governance-${label}-${suffix}.json`);
    if (archivePath !== evidencePath) writeFileSync(archivePath, JSON.stringify(evidence, null, 2));
  }
  return evidence;
}

try {
  const summaries = [];
  for (const round of rounds) summaries.push(await run(round));
  process.exitCode = summaries.some(s => s.setupFailure || s.summary.fail) ? 1 : 0;
} finally { await db.$disconnect(); await pool.end(); }
