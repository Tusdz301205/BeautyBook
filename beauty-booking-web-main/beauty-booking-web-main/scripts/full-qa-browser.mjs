import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { chromium, expect } from '@playwright/test';

// Standalone real-browser QA. No mocks, main database, storage-state dumps or traces.
const web = path.resolve(import.meta.dirname, '..');
const root = path.resolve(web, '../..');
const runtime = JSON.parse(await fs.readFile(path.join(root, 'report-output/full-system-qa/runtime.json'), 'utf8'));
const fixture = JSON.parse(await fs.readFile(path.join(root, 'report-output/full-system-qa/actors.json'), 'utf8'));
if (fixture.database !== 'beautybook_test_restriction_1791039047659' || runtime.QA_DATABASE !== fixture.database || !runtime.DATABASE_URL.includes(fixture.database) || String(runtime.PORT) !== '3012') throw new Error('Isolated fixture guard failed');
const base = 'http://localhost:5176', api = 'http://localhost:3012/api/v1';
const phase = process.argv[2] || 'baseline';
const out = path.join(root, 'docs/full-system-qa/evidence/current/web', phase);
await fs.mkdir(out, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g,'-');
try {await fs.copyFile(path.join(out,'results.json'),path.join(out,`results-before-${stamp}.json`));} catch {}
const sanitize = value => String(value).replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[synthetic-email]').replace(/\b0\d{9}\b/g, '[synthetic-phone]').replace(/Bearer\s+\S+/gi, 'Bearer [redacted]');
const clean = value => typeof value === 'string' ? sanitize(value) : Array.isArray(value) ? value.map(clean) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key,item]) => [key,clean(item)])) : value;
const b = fixture.businesses[0], other = fixture.businesses[1];
const report = { phase, startedAt: new Date().toISOString(), base, api, database: fixture.database, realBrowser: true, mocks: false, results: [], source: {}, limitations: ['Route PASS covers loading/content/diagnostics only, not every button or write.', 'Administrative mutations, onboarding submissions, uploads, real email and payments are NOT_RUN by this runner.'] };
for (const file of ['src/App.jsx', 'src/main.jsx','src/pages/Public/PublicDetails.jsx', 'src/pages/Customer/BookingConfirm.jsx', 'src/pages/Salon/StaffDetail.jsx', 'src/pages/Salon/SalonStaffManagement.jsx','src/api/apiClient.js']) report.source[file] = crypto.createHash('sha256').update(await fs.readFile(path.join(web, file))).digest('hex');
const app = await fs.readFile(path.join(web, 'src/App.jsx'), 'utf8');
report.routeInventory = [...app.matchAll(/<Route\s+(?:[^>]*?\s)?path="([^"]+)"/g)].map(m => m[1]);
for (const url of [base, `${api}/health`]) { const r = await fetch(url); if (!r.ok) throw new Error(`Health HTTP ${r.status}`); }
const browser = await chromium.launch({ channel: 'msedge', headless: true });
report.browserVersion = browser.version();
let sequence = 0;
const sessions = {};
async function save() { await fs.writeFile(path.join(out, 'results.json'), JSON.stringify(report, null, 2)); }
async function session(role = 'public') {
  if (sessions[role]) return sessions[role];
  // Fixed per-device addresses, as authorized for localhost's trust-proxy test
  // environment. Never rotate per request or alter server throttling.
  const deviceIp = {public:'127.10.0.1',customer10:'127.10.0.10',customer12:'127.10.0.12',owner0:'127.10.0.20',receptionist0:'127.10.0.21',staff0:'127.10.0.22',platform_admin:'127.10.0.30'}[role];
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 },extraHTTPHeaders:{'X-Forwarded-For':deviceIp} });
  await context.route('**/*', async route => {
    const req = route.request(), u = new URL(req.url());
    if (/localhost|127\.0\.0\.1/.test(u.hostname) && !['5176', '3012'].includes(u.port)) { report.results.push({role, check:'unexpected-local-binding', status:'FAIL', url: u.origin + u.pathname}); return route.abort(); }
    if (req.method() !== 'GET' && req.method() !== 'HEAD' && u.port === '3012' && !/\/auth\/(login|refresh|logout)$/.test(u.pathname) && u.pathname!=='/api/v1/bookings/preview-price' && !(role === 'customer10' && phase === 'booking' && /\/bookings$/.test(u.pathname))) { report.results.push({role,check:'unplanned-write-blocked',status:'BLOCKED',path:u.pathname,method:req.method()}); return route.abort(); }
    return route.continue();
  });
  const page = await context.newPage(), diagnostics = { errors: [], serverErrors: [], httpErrors: [], apiPaths: [] };
  page.on('pageerror', e => diagnostics.errors.push(sanitize(e.message)));
  page.on('response', r => { const u = new URL(r.url()); const info = {path:u.origin+u.pathname,status:r.status(),type:r.request().resourceType()}; if(r.status()>=500) diagnostics.serverErrors.push(info); if(r.status()>=400) diagnostics.httpErrors.push(info); if(u.port==='3012') diagnostics.apiPaths.push(u.pathname); });
  sessions[role] = {context,page,diagnostics};
  if (role !== 'public') {
    const actor = fixture.actors[role];
    await page.goto(`${base}/login`);
    await page.getByRole('textbox', { name: 'Địa chỉ email (bắt buộc)' }).fill(actor.email);
    await page.getByRole('textbox', { name: 'Mật khẩu (bắt buộc)' }).fill(actor.password);
    const pending = page.waitForResponse(r => new URL(r.url()).pathname === '/api/v1/auth/login' && r.request().method() === 'POST');
    await page.getByRole('button', {name: 'Đăng nhập', exact:true}).click();
    const r = await pending; const body = await r.json();
    if (!r.ok() || !body.accessToken) throw new Error(`${role} real login HTTP ${r.status()}`);
    await expect(page).not.toHaveURL(/\/login(?:[?#]|$)/);
    await page.waitForLoadState('networkidle');
    report.results.push({check:'real-ui-login',role,status:'PASS',http:r.status(),destination:new URL(page.url()).pathname});
  }
  return sessions[role];
}
async function capture(page, key) {
  const file = `${stamp}-${String(++sequence).padStart(3,'0')}-${key.replace(/[^a-z0-9_-]/gi,'_')}.png`;
  await page.screenshot({ path:path.join(out,file),fullPage:true, mask:[page.locator('input[type=password],input[type=email],input[type=tel]')] });
  return file;
}
async function inspect(role, route, width=1440, options={}) {
  const {page,diagnostics:d} = await session(role); d.errors=[];d.serverErrors=[];d.httpErrors=[];d.apiPaths=[];
  await page.setViewportSize({width,height:1000});
  const row={check:options.check||'route-content',role,route,width,status:'NOT_RUN'};
  try {
    await page.goto(base+route,{waitUntil:'domcontentloaded'});
    await page.waitForLoadState('networkidle',{timeout:12000});
    await expect(page.locator('[role=status]').filter({hasText:'Đang tải trang'})).toHaveCount(0);
    const state = await page.evaluate(() => {
      const main = document.querySelector('main') || document.querySelector('#root');
      const text = main?.innerText || '';
      const visible = e => !!(e.offsetWidth || e.offsetHeight || e.getClientRects().length);
      return { title:document.title, headings:[...main.querySelectorAll('h1,h2')].filter(visible).map(x=>x.textContent.trim()),text:text.slice(0,7000),controls:[...main.querySelectorAll('button,a,input,select,textarea')].filter(visible).map(e=>({tag:e.tagName,label:e.getAttribute('aria-label')||e.innerText||e.getAttribute('placeholder')||e.name,href:e.getAttribute('href'),disabled:e.disabled||false})),brokenImages:[...document.images].filter(e=>visible(e)&&e.complete&&!e.naturalWidth).map(e=>({src:e.currentSrc,alt:e.alt})),overflow:document.documentElement.scrollWidth>innerWidth+1, removedEntries:[...document.querySelectorAll('a,button,[role=tab]')].filter(visible).map(e=>({text:e.textContent.trim(),href:e.getAttribute('href')})).filter(e=>/điểm thưởng|danh sách chờ|nhận chỗ trống|hóa đơn|phiếu thu/i.test(e.text)||/loyalty|waitlist|invoices|receipts/i.test(e.href||''))};
    });
    row.destination=new URL(page.url()).pathname+new URL(page.url()).search;
    row.state=clean(state);
    row.diagnostics={pageErrors:d.errors,serverErrors:d.serverErrors,httpErrors:d.httpErrors.filter(x=>!x.path.endsWith('/auth/refresh')),apiPaths:[...new Set(d.apiPaths)]};
    if(role!=='public' && row.destination.startsWith('/login'))throw new Error('Authenticated route unexpectedly redirected to login');
    if(d.httpErrors.some(x=>x.status===429)){row.status='BLOCKED';throw new Error('Fixed-device test rate limit reached');}
    if(state.headings.length===0 || state.text.trim().length<45) throw new Error('No meaningful heading/content');
    if(/Không thể tải|Đã có lỗi|Something went wrong|Không tìm thấy (dịch vụ|chuyên viên|chi nhánh)/i.test(state.text) && !options.allowError) throw new Error('Error state on viable route');
    if(options.text && !state.text.includes(options.text)) throw new Error('Expected fixture content missing: '+options.text);
    if(d.errors.length||d.serverErrors.length||state.brokenImages.length||state.removedEntries.length) throw new Error('Browser/server/asset/retired entry diagnostics failed');
    if(state.overflow) throw new Error('Document horizontal overflow');
    row.status='PASS'; row.coverage = row.destination.split('?')[0]!==route.split('?')[0] ? 'redirect/permission guard rendered; requested feature not exercised' : 'route heading/content loaded; visible controls inventoried only';
  } catch(e) {if(row.status!=='BLOCKED')row.status='FAIL';row.reason=sanitize(e.message).slice(0,1600);}
  row.screenshot=await capture(page,`${role}-${route}-${width}`);
  report.results.push(row);await save(); console.log(`${row.status} ${role} ${route} ${width}`);
  return row;
}
async function baseline() {
  const publicRoutes=['/','/explore','/for-business','/business','/login','/register','/register/business','/forgot-password','/reset-password','/verify-email','/accept-invitation',`/explore/branches/${b.branchId}`,`/explore/services/${b.serviceId}`,`/explore/staff/${b.staffId}`,'/qa-no-such-page'];
  for (const route of publicRoutes) await inspect('public',route,1440,{allowError:route.includes('qa-no-such')});
  for(const width of [375,768,1024]) for(const route of ['/','/login',`/explore/services/${b.serviceId}`,`/explore/staff/${b.staffId}`]) await inspect('public',route,width);
  for(const route of ['/customer','/customer/appointments','/customer/notifications','/customer/vouchers','/customer/reviews','/customer/benefits','/customer/benefits?tab=saved','/customer/security','/customer/profile','/customer/privacy',`/book?branchId=${b.branchId}&serviceId=${b.serviceId}`]) await inspect('customer12',route);
  const salon=['/salon','/salon/notifications','/salon/onboarding','/salon/security','/salon/account','/salon/incoming-ownership','/salon/services','/salon/combos','/salon/appointments','/salon/staff','/salon/staff/schedule',`/salon/staff/${b.staffId}`,'/salon/branches/new',`/salon/branches/${b.branchId}/setup`,'/salon/promotions','/salon/reviews','/salon/stats','/salon/profile','/salon/payments','/salon/operations','/salon/audit',`/salon/branches/${b.branchId}/preview`];
  for (const role of ['owner0','receptionist0','staff0']) for (const route of salon) await inspect(role,route);
  for (const tab of ['profile','account','assignments','services','documents','audit']) await inspect('owner0',`/salon/staff/${b.staffId}?tab=${tab}`,1440,{text:b.staffName});
  const admin=['/admin','/admin/salons','/admin/salons?view=review',`/admin/branches/${b.branchId}`,`/admin/businesses/${b.id}`,'/admin/users',`/admin/users/${fixture.actors.customer12.id}`,'/admin/appointments','/admin/payments','/admin/reports','/admin/reviews','/admin/ownership','/admin/violations','/admin/audit','/admin/notifications','/admin/settings','/admin/compliance','/admin/security','/admin/profile'];
  for(const route of admin) await inspect('platform_admin',route);
  for(const width of [375,768,1024]) for(const [role,route] of [['customer12','/customer/appointments'],['owner0','/salon/services'],['owner0',`/salon/staff/${b.staffId}`],['receptionist0','/salon/appointments'],['staff0','/salon/appointments'],['platform_admin','/admin/users']]) await inspect(role,route,width);
}
async function booking() {
  const {page,diagnostics}=await session('customer10');
  const row={check:'browser-booking-double-click-reload-owner-sync',role:'customer10',status:'NOT_RUN',steps:[]};
  try {
    await page.goto(`${base}/book?branchId=${b.branchId}&serviceId=${b.serviceId}`);
    await expect(page.getByRole('heading',{name:'Chọn chi nhánh và dịch vụ'})).toBeVisible();
    await expect(page.getByRole('button',{pressed:true})).toHaveCount(2);
    row.steps.push({step:'branch-service-preselection',status:'PASS',screenshot:await capture(page,'booking-service')});
    await page.getByRole('button',{name:'Chọn chuyên viên',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Chọn chuyên viên'})).toBeVisible();
    const staff=page.getByRole('button',{name:new RegExp(b.staffName)}); await expect(staff).toBeVisible(); await staff.click();
    row.steps.push({step:'full-long-staff-name',status:'PASS',screenshot:await capture(page,'booking-staff')});
    await page.getByRole('button',{name:'Chọn thời gian',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Chọn ngày và khung giờ'})).toBeVisible();
    const dates=page.getByRole('button',{name:/tháng \d+/i}),times=page.getByRole('button',{name:/^\d{2}:\d{2}$/});
    let selected=false;
    row.availability=[];
    for(let i=0;i<await dates.count();i++) {
      const responsePromise=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/v1/bookings/available-slots');
      await dates.nth(i).click();const response=await responsePromise;const result=await response.json();row.availability.push({http:response.status(),date:result.date,slots:result.slots?.length||0});
      if(!response.ok())throw new Error('Availability HTTP '+response.status());
      await expect(page.locator('.animate-pulse')).toHaveCount(0,{timeout:15000});
      await expect(page.getByRole('heading',{name:/Khung giờ khả dụng/})).toBeVisible();
      if(result.slots?.length){await expect(times.first()).toBeVisible();await times.first().click();selected=true;break;}
    }
    if(!selected) {row.status='BLOCKED';throw new Error('No selectable live slot in available date range');}
    row.steps.push({step:'live-availability-slot',status:'PASS',screenshot:await capture(page,'booking-slot')});
    await page.getByRole('button',{name:'Nhập thông tin',exact:true}).click();
    await page.getByLabel('Số điện thoại',{exact:false}).fill('0909990010');
    await page.getByLabel(/Tôi đồng ý để BeautyBook/).check();
    await page.getByRole('button',{name:/Xem lại/}).click();
    await expect(page.getByRole('heading',{name:/Kiểm tra và xác nhận/})).toBeVisible();
    row.steps.push({step:'contact-consent-quote',status:'PASS',screenshot:await capture(page,'booking-confirm')});
    const responses=[]; page.on('response',r=>{if(r.request().method()==='POST'&&new URL(r.url()).pathname==='/api/v1/bookings') responses.push(r);});
    const confirm=page.getByRole('button',{name:'Xác nhận đặt lịch',exact:true}); await expect(confirm).toBeEnabled();
    await Promise.all([confirm.dispatchEvent('click'),confirm.dispatchEvent('click')]);
    await page.waitForURL(/\/book\/success$/, {timeout:20000});
    await expect(page.getByRole('heading',{name:/Đặt lịch thành công|Đã gửi yêu cầu đặt lịch/})).toBeVisible();
    const bodies=await Promise.all(responses.filter(r=>r.ok()).map(r=>r.json())); if(!bodies.length||new Set(bodies.map(x=>x.id)).size!==1) throw new Error('Double submit did not return one booking ID');
    const booking=bodies[0]; row.booking={id:booking.id,code:booking.bookingCode,status:booking.status,total:booking.totalAmount,branchId:booking.branch?.id||booking.branchId,services:booking.bookingServices?.map(x=>({serviceId:x.serviceId||x.service?.id,staffId:x.staffId||x.staff?.id}))};row.responseStatuses=responses.map(r=>r.status());
    if(booking.status!=='PENDING') throw new Error('Manual fixture booking not PENDING');
    if(row.booking.branchId!==b.branchId) throw new Error('Wrong branch persisted');
    await expect(page.locator('body')).toContainText(booking.bookingCode); await expect(page.getByRole('heading',{name:'Đã gửi yêu cầu đặt lịch'})).toBeVisible();
    row.steps.push({step:'one-pending-booking-created',status:'PASS',screenshot:await capture(page,'booking-success')});
    await page.goto(`${base}/customer/appointments/${booking.id}`);await expect(page.locator('body')).toContainText(booking.bookingCode);await page.reload();await expect(page.locator('body')).toContainText(booking.bookingCode);
    row.steps.push({step:'customer-detail-refresh',status:'PASS',screenshot:await capture(page,'booking-reloaded')});
    const owner=await session('owner0');await owner.page.goto(`${base}/salon/appointments`);await owner.page.getByRole('button',{name:'Danh sách',exact:true}).click();await expect(owner.page.locator('body')).toContainText(booking.bookingCode,{timeout:15000});
    row.steps.push({step:'owner-cross-session-sync',status:'PASS',screenshot:await capture(owner.page,'booking-owner-sync')}); row.status='PASS';
  }catch(e){if(row.status!=='BLOCKED')row.status='FAIL';row.reason=sanitize(e.message).slice(0,1500);row.destination=new URL(page.url()).pathname;row.diagnostics=clean(diagnostics);row.screenshot=await capture(page,'booking-failure');}
  report.results.push(row);await save();console.log(`${row.status} booking ${row.reason||''}`);
}
async function check(name,role,run) {
  const {page,diagnostics}=await session(role);const row={check:name,role,status:'NOT_RUN'};diagnostics.errors=[];diagnostics.httpErrors=[];diagnostics.serverErrors=[];diagnostics.apiPaths=[];
  try{await run(page,row);row.status='PASS';}catch(e){row.status='FAIL';row.reason=sanitize(e.message).slice(0,2000);}
  row.destination=new URL(page.url()).pathname;row.diagnostics=clean(diagnostics);if(diagnostics.httpErrors.some(x=>x.status===429))row.status='BLOCKED';row.screenshot=await capture(page,`${name}-${role}`);report.results.push(clean(row));await save();console.log(`${row.status} ${role} ${name}`);
}
async function exceptions() {
  // Re-run only earlier harness failures with corrected recursive sanitization.
  for (const [role,route] of [['customer12','/customer/privacy'],['owner0','/salon/onboarding'],['owner0','/salon/profile'],['owner0','/salon/audit'],['owner0',`/salon/staff/${b.staffId}?tab=account`],['platform_admin','/admin/salons'],['platform_admin','/admin/salons?view=review'],['platform_admin','/admin/salons?view=taxonomy']]) await inspect(role,route);
  for(const width of [375,768,1024,1440]) await check(`staff-list-full-name-${width}`,'owner0',async(page,row)=>{
    await page.setViewportSize({width,height:1000});await page.goto(`${base}/salon/staff`);await page.waitForLoadState('networkidle');
    const title=page.getByRole('heading',{name:b.staffName,exact:true});await expect(title).toBeVisible();
    row.measurements=await title.evaluate(e=>({text:e.textContent,width:e.clientWidth,scrollWidth:e.scrollWidth,height:e.clientHeight,scrollHeight:e.scrollHeight,overflow:getComputedStyle(e).overflow,textOverflow:getComputedStyle(e).textOverflow,whiteSpace:getComputedStyle(e).whiteSpace}));
    if(row.measurements.scrollWidth>row.measurements.width+1 || row.measurements.scrollHeight>row.measurements.height+1)throw new Error('Staff full name is visually clipped');
  });
  await check('staff-detail-click-all-six-tabs','owner0',async(page,row)=>{
    await page.goto(`${base}/salon/staff/${b.staffId}`);await page.waitForLoadState('networkidle');row.tabs=[];
    for(const [key,label] of [['profile','Tổng quan'],['account','Tài khoản'],['assignments','Vai trò & chi nhánh'],['services','Dịch vụ'],['documents','Tài liệu'],['audit','Nhật ký']]) {await page.getByRole('tab',{name:label,exact:true}).click();await expect(page).toHaveURL(new RegExp(`tab=${key}`));await expect(page.locator('main')).toContainText(b.staffName);row.tabs.push({key,status:'PASS',screenshot:await capture(page,`staff-tab-${key}`)});}
  });
  await check('admin-business-all-five-tabs','platform_admin',async(page,row)=>{
    await page.goto(`${base}/admin/businesses/${b.id}`);await page.waitForLoadState('networkidle');row.tabs=[];
    for(const [label,expected] of [['Tổng quan','Chủ sở hữu'],['Chi nhánh','Chi nhánh trực thuộc'],['Dịch vụ','Dịch vụ toàn doanh nghiệp'],['Hồ sơ đăng ký','Hồ sơ đăng ký'],['Lịch sử','Lịch sử']]) {await page.getByRole('button',{name:label,exact:true}).click();await expect(page.locator('main')).toContainText(expected);row.tabs.push({label,status:'PASS',screenshot:await capture(page,`admin-business-tab-${label}`)});}
  });
  for(const [role,route,expected] of [['public','/customer/privacy','/login'],['customer12','/admin/users','/customer/appointments'],['customer12','/salon/services','/customer/appointments'],['staff0','/salon/services','/salon/appointments'],['receptionist0','/salon/services','/salon/appointments']]) await check(`direct-role-guard-${route}`,role,async(page,row)=>{await page.goto(base+route);await page.waitForLoadState('networkidle');row.destination=new URL(page.url()).pathname;if(row.destination!==expected)throw new Error('Expected destination '+expected);});
  await check('owner-customer-booking-boundary','owner0',async(page,row)=>{await page.goto(`${base}/book?branchId=${b.branchId}&serviceId=${b.serviceId}`);await expect(page.getByRole('heading',{name:'Cần tài khoản khách hàng riêng'})).toBeVisible();row.customerRequired=true;});
  for (const route of ['/salon/waitlist','/salon/loyalty','/salon/invoices','/customer/waitlist','/customer/loyalty','/admin/invoices']) await check(`retired-route-${route}`,route.startsWith('/admin')?'platform_admin':route.startsWith('/customer')?'customer12':'owner0',async(page,row)=>{await page.goto(base+route);await page.waitForLoadState('networkidle');row.destination=new URL(page.url()).pathname;if(row.destination===route)throw new Error('Retired route accessible');const entries=await page.locator('a,button').allTextContents();if(entries.some(x=>/điểm thưởng|danh sách chờ|nhận chỗ trống|hóa đơn|phiếu thu/i.test(x)))throw new Error('Retired entry still advertised');});
  await check('empty-register-client-validation','public',async(page,row)=>{await page.goto(base+'/register');await page.getByRole('button',{name:/Tạo tài khoản|Đăng ký/,exact:false}).last().click();await expect(page.getByRole('alert').first()).toBeVisible();row.alerts=await page.getByRole('alert').allTextContents();if(row.alerts.length<2)throw new Error('Missing field validation');});
  await check('register-switch-account-type','public',async(page,row)=>{await page.goto(base+'/register');const customer=page.getByRole('radio',{name:/Khách hàng/}),owner=page.getByRole('radio',{name:/Chủ doanh nghiệp/});await expect(customer).toHaveCount(1);await expect(owner).toHaveCount(1);await owner.check();await expect(page.getByRole('heading',{name:'Tạo tài khoản chủ doanh nghiệp'})).toBeVisible();await customer.check();await expect(page.getByRole('heading',{name:'Tạo tài khoản khách hàng'})).toBeVisible();row.note='UI switching and duplicate choice only; account creation payload NOT_RUN here';});
  await check('session-refresh-no-credentials-persisted','customer12',async(page,row)=>{await page.goto(base+'/customer/profile');await page.waitForLoadState('networkidle');await page.reload();await page.waitForLoadState('networkidle');await expect(page).toHaveURL(/\/customer\/profile$/);row.storage=await page.evaluate(()=>{const raw=localStorage.getItem('beautybook-auth');const value=raw?JSON.parse(raw):null;return {authKeys:Object.keys(value?.state||{}),containsToken:/accessToken|refreshToken|password/i.test(raw||'')};});if(row.storage.containsToken)throw new Error('Sensitive auth material persisted');});
  await check('offline-profile-error-and-recovery','customer12',async(page,row)=>{const s=sessions.customer12;await page.goto(base+'/customer/profile');await page.waitForLoadState('networkidle');await s.context.setOffline(true);try{await page.getByRole('link',{name:/Lịch hẹn/,exact:false}).first().click();await expect(page.locator('main')).toContainText(/Không thể|kết nối|Thử lại|Lỗi/, {timeout:15000});row.offlineScreenshot=await capture(page,'offline-error');}finally{await s.context.setOffline(false);}await page.reload();await page.waitForLoadState('networkidle');await expect(page).not.toHaveURL(/login/);await expect(page.locator('main')).toContainText(/Lịch hẹn|lịch hẹn/);});
  // Separate customer session must not read another tenant's protected staff detail.
  await check('cross-tenant-staff-denied','owner0',async(page,row)=>{await page.goto(`${base}/salon/staff/${other.staffId}`);await page.waitForLoadState('networkidle');await expect(page.locator('body')).toContainText('Bạn không có quyền truy cập dữ liệu của cơ sở này');if(!sessions.owner0.diagnostics.httpErrors.some(x=>x.status===403))throw new Error('Expected backend403');row.expected403=true;});
  for(const route of ['/book/staff','/book/time','/book/info','/book/confirm','/book/success']) await inspect('customer12',route);
}
async function bookingRead() {
  const previous=JSON.parse(await fs.readFile(path.join(root,'docs/full-system-qa/evidence/current/web/booking/results.json'),'utf8'));
  const record=previous.results.find(r=>r.booking)?.booking;if(!record)throw new Error('No real browser booking recorded');
  await check('fresh-customer-login-existing-booking','customer10',async(page,row)=>{await page.goto(`${base}/customer/appointments/${record.id}`);await page.waitForLoadState('networkidle');await expect(page.locator('body')).toContainText(record.code);await expect(page.locator('body')).toContainText(/Chờ xác nhận|Chờ duyệt|Đang chờ/);await page.reload();await page.waitForLoadState('networkidle');await expect(page.locator('body')).toContainText(record.code);row.booking=record;});
  await check('fresh-owner-list-sync-existing-booking','owner0',async(page,row)=>{await page.goto(base+'/salon/appointments');await page.waitForLoadState('networkidle');await page.getByRole('button',{name:'Danh sách',exact:true}).click();await expect(page.locator('body')).toContainText(record.code,{timeout:15000});row.booking=record;});
  await check('different-customer-cannot-read-booking','customer12',async(page,row)=>{await page.goto(`${base}/customer/appointments/${record.id}`);await page.waitForLoadState('networkidle');row.http=sessions.customer12.diagnostics.httpErrors.map(x=>x.status);if(!row.http.some(x=>x===403||x===404))throw new Error('Expected403/404 crosscustomer');const content=await page.locator('body').innerText();if(content.includes(record.code))throw new Error('Booking data leaked');});
}
async function regression() {
  for(const width of [375,768,1024,1440])await check(`staff-full-name-regression-${width}`,'owner0',async(page,row)=>{await page.setViewportSize({width,height:1000});await page.goto(base+'/salon/staff');await page.waitForLoadState('networkidle');const title=page.getByRole('heading',{name:b.staffName,exact:true});await expect(title).toBeVisible();row.measurements=await title.evaluate(e=>({width:e.clientWidth,scrollWidth:e.scrollWidth,height:e.clientHeight,scrollHeight:e.scrollHeight,textOverflow:getComputedStyle(e).textOverflow,whiteSpace:getComputedStyle(e).whiteSpace}));if(row.measurements.scrollWidth>row.measurements.width+1||row.measurements.scrollHeight>row.measurements.height+1)throw new Error('Staff full name still clipped');});
  const previous=JSON.parse(await fs.readFile(path.join(root,'docs/full-system-qa/evidence/current/web/baseline/results.json'),'utf8'));
  for(const row of previous.results.filter(r=>r.status==='BLOCKED'))await inspect(row.role,row.route,row.width);
  await check('staff-detail-six-tabs-regression','owner0',async(page,row)=>{await page.goto(`${base}/salon/staff/${b.staffId}`);await page.waitForLoadState('networkidle');row.tabs=[];for(const [key,label]of [['profile','Tổng quan'],['account','Tài khoản'],['assignments','Vai trò & chi nhánh'],['services','Dịch vụ'],['documents','Tài liệu'],['audit','Nhật ký']]){await page.getByRole('tab',{name:label,exact:true}).click();await expect(page).toHaveURL(new RegExp(`tab=${key}`));row.tabs.push({key,status:'PASS'});}});
  await check('registration-radio-switch-regression','public',async(page,row)=>{await page.goto(base+'/register');const customer=page.getByRole('radio',{name:/Khách hàng/}),owner=page.getByRole('radio',{name:/Chủ doanh nghiệp/});await expect(customer).toHaveCount(1);await expect(owner).toHaveCount(1);await page.locator('#register-fullName').fill('QA Switch Account');await owner.check();await expect(page.getByRole('heading',{name:'Tạo tài khoản chủ doanh nghiệp'})).toBeVisible();await customer.check();await expect(page.getByRole('heading',{name:'Tạo tài khoản khách hàng'})).toBeVisible();await expect(page.locator('#register-fullName')).toHaveValue('QA Switch Account');row.note='UI only; no account created';});
  await check('cross-tenant-staff403-regression','owner0',async(page,row)=>{await page.goto(`${base}/salon/staff/${other.staffId}`);await page.waitForLoadState('networkidle');await expect(page.locator('body')).toContainText('Bạn không có quyền truy cập dữ liệu của cơ sở này');if(!sessions.owner0.diagnostics.httpErrors.some(x=>x.status===403))throw new Error('Expected403');});
}
async function acceptance() {
  await check('offline-cold-lazy-route-reconnect-reload','customer12',async(page,row)=>{
    await page.goto(base+'/customer/profile');await page.waitForLoadState('networkidle');
    const capturedConsole=[];page.on('console',m=>{if(m.type()==='error')capturedConsole.push(sanitize(m.text()).slice(0,1300));});
    await page.getByRole('button',{name:/Mở menu tài khoản/i}).click();
    await expect(page.getByRole('link',{name:'Quyền riêng tư',exact:true})).toBeVisible();
    const s=sessions.customer12;await s.context.setOffline(true);
    try{await page.getByRole('link',{name:'Quyền riêng tư',exact:true}).click();await expect(page.getByRole('heading',{name:'Bạn đang mất kết nối'})).toBeVisible({timeout:15000});const reload=page.getByRole('button',{name:'Tải lại trang',exact:true});await expect(reload).toBeDisabled();row.offlineScreenshot=await capture(page,'offline-boundary-visible');}
    finally{await s.context.setOffline(false);}
    await expect(page.getByRole('heading',{name:'Chưa tải được trang'})).toBeVisible();const reload=page.getByRole('button',{name:'Tải lại trang',exact:true});await expect(reload).toBeEnabled();await reload.click();await page.waitForLoadState('networkidle');await expect(page.getByRole('heading',{name:'Trung tâm quyền riêng tư',exact:true})).toBeVisible();await expect(page).toHaveURL(/\/customer\/privacy$/);
    row.consoleErrors=capturedConsole;row.intentionalFailure='Cold lazy module network failure induced by browser offline; React development emits browser error events despite successful ErrorBoundary recovery';row.expectedOfflineImportErrorEvents=s.diagnostics.errors.filter(x=>/Failed to fetch dynamically imported module:.*PrivacySettings/.test(x));row.unexpectedPageErrors=s.diagnostics.errors.filter(x=>!/Failed to fetch dynamically imported module:.*PrivacySettings/.test(x));if(row.unexpectedPageErrors.length)throw new Error('Unexpected pageerror during recovery');row.recovered=true;
  });
  if(phase==='offline-regression')return;
  await check('explore-search-empty-clear-card-navigation','public',async(page,row)=>{
    await page.goto(base+'/explore');await expect(page.locator(`a[href="/explore/services/${b.serviceId}"]`).first()).toBeVisible();
    const search=page.getByPlaceholder('Ví dụ: chăm sóc da, sơn gel, cắt tóc');await search.fill('QA-nonexistent-zzzz');await page.getByRole('button',{name:'Tìm kiếm',exact:true}).click();await page.waitForLoadState('networkidle');await expect(page.locator(`a[href="/explore/services/${b.serviceId}"]`)).toHaveCount(0);await expect(page.locator('main')).toContainText(/Không tìm thấy|Chưa có|không có/i);row.emptyScreenshot=await capture(page,'explore-no-results');await page.getByRole('button',{name:'Xóa tên dịch vụ',exact:true}).click();await page.getByRole('button',{name:'Tìm kiếm',exact:true}).click();await expect(page.locator(`a[href="/explore/services/${b.serviceId}"]`).first()).toBeVisible();await page.locator(`a[href="/explore/services/${b.serviceId}"]`).first().click();await expect(page).toHaveURL(new RegExp(b.serviceId));await expect(page.locator('main')).toContainText('Cắt tóc thử nghiệm QA');row.linkedFixture=b.serviceId;
  });
  await check('scheduler-read-tabs-and-counter-modal','owner0',async(page,row)=>{
    await page.goto(base+'/salon/appointments');await page.waitForLoadState('networkidle');row.tabs=[];
    for(const label of ['Lịch hẹn','Việc cần xử lý','Danh sách','Thống kê']){await page.getByRole('button',{name:label,exact:true}).click();await page.waitForLoadState('networkidle');await expect(page.locator('main')).toContainText(/Lịch hẹn|lịch hẹn|Thống kê|thống kê/);row.tabs.push({label,screenshot:await capture(page,`scheduler-${label}`)});}
    await page.getByRole('button',{name:'Tạo lịch tại quầy',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();row.modalScreenshot=await capture(page,'counter-booking-dialog');await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);row.note='Modal open/keyboard close only; counter-booking submit NOT_RUN';
  });
  await check('mobile-owner-menu-escape-focus','owner0',async(page,row)=>{await page.setViewportSize({width:375,height:844});await page.goto(base+'/salon/services');await page.waitForLoadState('networkidle');const trigger=page.getByRole('button',{name:'Mở menu',exact:true});await trigger.click();const close=page.getByRole('complementary',{name:'Điều hướng chính'}).getByRole('button',{name:'Đóng menu',exact:true});await expect(close).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('button.fixed[aria-label="Đóng menu"]')).toHaveCount(0);await expect(page.getByRole('complementary',{name:'Điều hướng chính'})).toHaveClass(/-translate-x-full/);row.horizontalOverflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);if(row.horizontalOverflow)throw new Error('Mobile menu caused overflow');});
}
try { if(phase==='booking') await booking(); else if(phase==='exceptions') await exceptions(); else if(phase==='booking-read')await bookingRead();else if(phase==='regression')await regression();else if(phase==='acceptance'||phase==='offline-regression')await acceptance();else await baseline(); }
finally {report.completedAt=new Date().toISOString();report.summary=report.results.reduce((a,r)=>(a[r.status]=(a[r.status]||0)+1,a),{});await save();for(const s of Object.values(sessions))await s.context.close();await browser.close();console.log(JSON.stringify(report.summary));process.exitCode=report.summary.FAIL?1:report.summary.BLOCKED?2:0;}
