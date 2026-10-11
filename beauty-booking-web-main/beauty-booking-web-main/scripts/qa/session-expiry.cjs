// Real QA expiry: only the session issued by this run may be staged expired.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../../..'),wr=require('node:module').createRequire(path.join(root,'beauty-booking-web-main/beauty-booking-web-main/package.json'));
const {chromium,expect}=wr('@playwright/test'),{BrowserCases}=require('./browser-case.cjs');
const br=require('node:module').createRequire(path.join(root,'beauty-booking-api-main/package.json')),{Pool}=br('pg');
const rt=JSON.parse(fs.readFileSync(path.join(root,'report-output/full-system-qa/runtime.json'))),f=JSON.parse(fs.readFileSync(path.join(root,'report-output/bugreport-remediation/provider-fixture-private.json')));
if(rt.NODE_ENV!=='test'||new URL(rt.DATABASE_URL).pathname.slice(1)!==rt.QA_DATABASE||!/^beautybook_test_restriction_\d+$/.test(rt.QA_DATABASE))throw Error('Dedicated QA required');
const runId=crypto.randomUUID(),out=path.join(root,'report-output/bugreport-remediation','session-expiry-'+runId);fs.mkdirSync(out);
fs.writeFileSync(path.join(out,'armed.json'),JSON.stringify({at:new Date().toISOString(),scope:'Own newly issued QA session only; no account, role, booking, finance or historical session mutations'}),{flag:'wx'});
const pool=new Pool({connectionString:rt.DATABASE_URL}),report={runId,version:require('./source-version.cjs')(root),contexts:[]};let browser;
const sha=rows=>crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex');
const protectedRows=async sid=>({accounts:sha((await pool.query('SELECT id,is_active,deleted_at FROM users ORDER BY id')).rows),grants:sha((await pool.query('SELECT * FROM user_roles ORDER BY id')).rows),otherSessions:sha((await pool.query('SELECT id,user_id,expires_at::text,revoked_at::text FROM user_sessions WHERE id<>$1 ORDER BY id',[sid])).rows)});
const save=()=>fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));
(async()=>{try{
 browser=await chromium.launch({channel:'msedge',headless:true});
 for(const width of [375,1440]){
  const started=Date.now(),context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage();page.setDefaultTimeout(10000);
  const h=new BrowserCases(page,{role:'QA STAFF SESSION '+width,runId,redact:s=>String(s).split(f.old.password).join('[PASSWORD]').replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g,'[JWT]')});report.contexts.push({width,browser:null});
  let sessionId;
  await page.route('**/api/v1/**',async route=>{const r=route.request(),p=new URL(r.url()).pathname;if(!['GET','HEAD','OPTIONS'].includes(r.method())&&!['/api/v1/auth/login','/api/v1/auth/refresh'].includes(p)){h.record({kind:'guard',path:p,message:'No product writes allowed'});return route.abort();}await route.continue({headers:{...r.headers(),'x-forwarded-for':width===375?'127.0.0.87':'127.0.0.88'}});});
  const run=async(spec,fn)=>{const c=await h.run(spec,fn);report.contexts.at(-1).browser=h.result();save();if(c.status!=='PASS'){await page.screenshot({path:path.join(out,'FAIL-'+width+'-'+spec.id+'.png')}).catch(()=>{});throw Error('Case '+spec.id);}};
  await run({id:'bootstrap',phase:'bootstrap',expected:[{kind:'http',phase:'bootstrap',method:'POST',path:'/api/v1/auth/refresh',status:401,max:1,reason:'Fresh cookie-less QA context'}]},async t=>{await page.goto('http://127.0.0.1:5176/login');await page.waitForLoadState('networkidle');t.assert(await page.locator('#login-email').isVisible(),'Login loaded');});
  await run({id:'real-login',responses:[{method:'POST',path:'/api/v1/auth/login',validate:x=>x.user.id===f.old.userId}]},async t=>{
   const reply=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/v1/auth/login'&&r.request().method()==='POST');
   await page.locator('#login-email').fill(f.old.email);await page.locator('#login-password').fill(f.old.password);await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();
   const body=await(await reply).json(),claims=JSON.parse(Buffer.from(body.accessToken.split('.')[1],'base64url').toString());
   if(claims.sub!==f.old.userId||!claims.sessionId)throw Error('Own issued session required');sessionId=claims.sessionId;
   await page.waitForURL(u=>u.pathname.startsWith('/salon'));await page.waitForLoadState('networkidle');t.assert(true,'Own QA user and session verified');
  });
  await run({id:'loaded-before-expiry',responses:[{path:'/api/v1/notifications',validate:x=>x.data.some(n=>n.targetId===f.bookingId)}]},async t=>{await page.goto('http://127.0.0.1:5176/salon/notifications');await expect(page.getByRole('button').filter({hasText:'Bạn được phân công dịch vụ'}).first()).toBeVisible();await page.waitForLoadState('networkidle');t.assert(true,'Own data loaded before expiry');});
  const before=await protectedRows(sessionId),staged=await pool.query("UPDATE user_sessions SET expires_at=(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')-interval '1 second' WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL AND created_at>=($3::timestamptz AT TIME ZONE 'UTC') RETURNING id",[sessionId,f.old.userId,new Date(started).toISOString()]);
  if(staged.rowCount!==1)throw Error('Exact own new session stage required');
  const after=await protectedRows(sessionId);report.contexts.at(-1).expiryStage={sessionId,before,after,protectedUnchanged:JSON.stringify(before)===JSON.stringify(after),syntheticExpiry:true};if(JSON.stringify(before)!==JSON.stringify(after))throw Error('Protected rows changed');save();
  await run({id:'expired-session-clears-ui',phase:'expiry',expected:[{kind:'http',phase:'expiry',method:'GET',path:'/api/v1/notifications',status:401,required:true,max:1,reason:'Only own session intentionally expired'},{kind:'http',phase:'expiry',method:'POST',path:'/api/v1/auth/refresh',status:401,required:true,max:1,reason:'Expired refresh session cannot renew'},{kind:'http',phase:'expiry',method:'GET',path:'/api/v1/notifications/unread-count',status:401,max:1,reason:'Visible shell badge refresh shares the exact expired session'}]},async t=>{
   await page.getByRole('textbox',{name:'Tìm thông báo',exact:true}).fill('PHAN CONG');await page.getByRole('textbox',{name:'Tìm thông báo',exact:true}).press('Enter');await page.waitForURL(u=>u.pathname==='/login');await page.waitForLoadState('networkidle');
   await expect(page.locator('#login-email')).toBeVisible();t.assert(true,'Returns to usable login after React route render');t.assert(!(await page.locator('body').innerText()).includes('Phân công dịch vụ đã thay đổi'),'Previous notification rows removed');
   t.assert(await page.evaluate(()=>JSON.parse(localStorage.getItem('beautybook-auth')).state.user===null),'Persisted account cleared');t.assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No overflow');await page.screenshot({path:path.join(out,'expired-login-'+width+'.png')});
  });
  await run({id:'fresh-login-after-expiry',responses:[{method:'POST',path:'/api/v1/auth/login',validate:x=>x.user.id===f.old.userId}]},async t=>{await page.locator('#login-email').fill(f.old.email);await page.locator('#login-password').fill(f.old.password);await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();await page.waitForURL(u=>u.pathname.startsWith('/salon'));await page.waitForLoadState('networkidle');t.assert(true,'New valid session restores access');await page.screenshot({path:path.join(out,'reauthenticated-'+width+'.png')});});
  await context.close();
 }
}catch(e){report.failure=e.message.startsWith('Case ')?e.message:'Guarded session verification stopped';}finally{await pool.end();if(browser)await browser.close();report.exitCode=report.failure?1:0;save();console.log(JSON.stringify({out,exitCode:report.exitCode}));process.exitCode=report.exitCode;}})();
