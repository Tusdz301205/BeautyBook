// Real Chromium/Vite modules; every API response is controlled, no live writes.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../../..'),req=require('node:module').createRequire(path.join(root,'beauty-booking-web-main/beauty-booking-web-main/package.json')),{chromium,expect}=req('@playwright/test'),{BrowserCases}=require('./browser-case.cjs');
const runId=crypto.randomUUID(),out=path.join(root,'report-output/bugreport-remediation','auth-session-browser-'+runId);fs.mkdirSync(out);
const report={runId,kind:'CHROMIUM_ACTUAL_AUTH_MODULES_CONTROLLED_TRANSPORT',liveAPICalls:0,version:require('./source-version.cjs')(root),contexts:[]};let browser;
const session=id=>({accessToken:'controlled-'+id,user:{id,fullName:'Controlled QA '+id,sessionType:'customer',roles:['CUSTOMER'],scopes:[{code:'CUSTOMER'}],permissions:['notification:read:self','booking:read:self','user:read:self']}});
const fulfill=(route,status,body)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
(async()=>{try{browser=await chromium.launch({channel:'msedge',headless:true});
for(const width of [375,1440])for(const scenario of ['late401','lateRefreshFailure','refreshAfterClear','lateLogout']){
 const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage();page.setDefaultTimeout(10000);const h=new BrowserCases(page,{role:'CONTROLLED CUSTOMER '+width,runId});
 const held={read:[],refresh:[],logout:[]};let holdingRefresh=false,holdingLogout=false,refreshCalls=0;
 await page.route('**/api/v1/**',async route=>{const request=route.request(),url=new URL(request.url()),p=url.pathname;
  if(p==='/api/v1/auth/login')return fulfill(route,200,session(JSON.parse(request.postData()).email.startsWith('B')?'B':'A'));
  if(p==='/api/v1/auth/refresh'){refreshCalls++;if(holdingRefresh){held.refresh.push(route);return;}return fulfill(route,401,{message:'Controlled expired refresh'});}
  if(p==='/api/v1/auth/logout'){if(holdingLogout){held.logout.push(route);return;}return fulfill(route,200,{});}
  if(p==='/api/v1/notifications'&&url.searchParams.get('search')==='LEASE-CASE'){held.read.push(route);return;}
  if(p==='/api/v1/notifications/unread-count')return fulfill(route,200,{count:1});
  if(p==='/api/v1/notifications'){const who=request.headers().authorization?.endsWith('B')?'B':'A';return fulfill(route,200,{data:[{id:'notice-'+who,title:'Controlled notice '+who,body:'Own controlled account content',type:'SYSTEM',severity:'INFO',isRead:false,createdAt:new Date().toISOString()}],pagination:{page:1,limit:20,total:1,totalPages:1},unreadCount:1});}
  return fulfill(route,200,[]);
 });
 const c={width,scenario};report.contexts.push(c);
 const waiting=async name=>{const end=Date.now()+5000;while(!held[name].length&&Date.now()<end)await page.waitForTimeout(30);if(!held[name].length)throw Error('Controlled '+name+' request was not dispatched');};
 const login=who=>page.evaluate(async who=>{const{useAuthStore}=await import(window.qaModules.auth);await useAuthStore.getState().login(who+'@example.test','controlled-fixture-only');},who);
 const rules=[{kind:'http',phase:'content',method:'POST',path:'/api/v1/auth/refresh',status:401,max:1,reason:'Fresh controlled context initialization'}];
 if(scenario!=='lateLogout')rules.push({kind:'http',phase:'content',method:'GET',path:'/api/v1/notifications',status:401,required:true,max:1,reason:'Controlled late response for account A'});
 if(scenario==='lateRefreshFailure')rules[0].max=2;
 c.case=await h.run({id:scenario,expected:rules},async t=>{
  await page.goto('http://127.0.0.1:5176/forgot-password');await expect(page.locator('.bb-auth-back')).toBeVisible();await page.waitForLoadState('networkidle');await page.evaluate(()=>{const observed=p=>performance.getEntriesByType('resource').find(r=>new URL(r.name).pathname===p)?.name;if(!observed('/src/store/authStore.js')||!observed('/src/api/apiClient.js'))throw Error('Observed application modules required');window.qaModules={auth:observed('/src/store/authStore.js'),api:observed('/src/api/apiClient.js')};});await login('A');
  const initialRefresh=refreshCalls;
  if(scenario==='lateLogout'){
   holdingLogout=true;await page.evaluate(async()=>{const{useAuthStore}=await import(window.qaModules.auth);window.qaPending=useAuthStore.getState().logout().then(()=>({ok:true}),e=>({code:e.code}));});await waiting('logout');await login('B');await fulfill(held.logout.shift(),200,{});
  }else{
   holdingRefresh=scenario!=='late401';await page.evaluate(async()=>{const{notificationsApi}=await import(window.qaModules.api);window.qaPending=notificationsApi.getAll({search:'LEASE-CASE'}).then(()=>({ok:true}),e=>({code:e.code}));});await waiting('read');
   if(scenario==='late401'){await login('B');await fulfill(held.read.shift(),401,{message:'Controlled expired A'});}
   else{await fulfill(held.read.shift(),401,{message:'Controlled expired A'});await waiting('refresh');if(scenario==='refreshAfterClear'){await page.evaluate(async()=>{const{useAuthStore}=await import(window.qaModules.auth);useAuthStore.getState().clearSession();});await fulfill(held.refresh.shift(),200,session('A'));}else{await login('B');await fulfill(held.refresh.shift(),401,{message:'Controlled rejected A refresh'});}}
  }
  const final=await page.evaluate(async()=>{const pending=await window.qaPending;const{useAuthStore}=await import(window.qaModules.auth);return{pending,userId:useAuthStore.getState().user?.id??null};});
  t.assert(final.userId===(scenario==='refreshAfterClear'?null:'B'),'Late A work cannot clear B or resurrect A');t.assert(final.pending.code==='STALE_SESSION','Obsolete work rejected by generation fence');
  if(scenario==='late401')t.assert(refreshCalls===initialRefresh,'Late old 401 starts no refresh');
  if(scenario!=='refreshAfterClear'){
   await page.evaluate(()=>{history.pushState(null,'','/customer/notifications');dispatchEvent(new PopStateEvent('popstate'));});await expect(page.getByRole('button').filter({hasText:'Controlled notice B'})).toBeVisible();t.assert(!(await page.locator('body').innerText()).includes('Controlled notice A'),'New account UI has no old notice content');
  }
  t.assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow');await page.screenshot({path:path.join(out,scenario+'-'+width+'.png')});
 });c.telemetry=h.result();fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));await context.close();if(c.telemetry.exitCode)throw Error('Case '+scenario);
}
}catch(e){report.failure=e.message.startsWith('Case ')?e.message:'Controlled browser runner stopped';}finally{if(browser)await browser.close();report.exitCode=report.failure?1:0;fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({out,exitCode:report.exitCode}));process.exitCode=report.exitCode;}})();
