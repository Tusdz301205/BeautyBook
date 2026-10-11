const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../../..'),req=require('node:module').createRequire(path.join(root,'beauty-booking-web-main/beauty-booking-web-main/package.json')),{chromium,expect}=req('@playwright/test'),{BrowserCases}=require('./browser-case.cjs');
const baseline=process.argv.includes('--baseline'),id=crypto.randomUUID(),out=path.join(root,'report-output/bugreport-remediation','auth-layout-'+id);fs.mkdirSync(out);
const report={id,baseline,kind:'REAL_READONLY_AUTH_LAYOUT',version:require('./source-version.cjs')(root),cases:[]};let browser;
(async()=>{try{browser=await chromium.launch({channel:'msedge',headless:true});
for(const width of [375,768,1024,1440])for(const route of ['/login','/register','/register/business','/forgot-password']){
 const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage();page.setDefaultTimeout(10000);const h=new BrowserCases(page,{role:'PUBLIC '+width,runId:id});
 await page.route('**/api/v1/**',async r=>{const q=r.request(),u=new URL(q.url());if(!['GET','HEAD','OPTIONS'].includes(q.method())&&u.pathname!=='/api/v1/auth/refresh'){h.record({kind:'guard',path:u.pathname,message:'No form submissions allowed'});return r.abort();}await r.continue({headers:{...q.headers(),'x-forwarded-for':'127.0.0.89'}});});
 const row={width,route};report.cases.push(row);
 row.case=await h.run({id:'auth-header',route,expected:[{kind:'http',phase:'content',method:'POST',path:'/api/v1/auth/refresh',status:401,max:1,reason:'Fresh public context'}]},async t=>{
  await page.goto('http://127.0.0.1:5176'+route);await expect(page.locator('.bb-auth-back')).toBeVisible();await page.waitForLoadState('networkidle');
  row.geometry=await page.evaluate(()=>{const a=document.querySelector('.bb-auth-back'),b=document.querySelector('.bb-auth-mobile-brand'),r=a.getBoundingClientRect(),s=b.getBoundingClientRect();const shown=s.width>0&&s.height>0;return{back:{x:r.x,y:r.y,width:r.width,height:r.height},brand:{x:s.x,y:s.y,width:s.width,height:s.height},brandVisible:shown,separation:Math.max(s.left-r.right,r.left-s.right,s.top-r.bottom,r.top-s.bottom),overlap:shown&&r.left<s.right&&r.right>s.left&&r.top<s.bottom&&r.bottom>s.top,backHit:a.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2))};});
  t.assert(await page.locator('input:visible').count()>0,'Usable actual form controls loaded');t.assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow');
  if(!baseline){t.assert(!row.geometry.overlap,'Home link and logo do not overlap');t.assert(!row.geometry.brandVisible||row.geometry.separation>=12,'Visible brand separated from home link by at least12px');t.assert(row.geometry.backHit,'Home link remains directly clickable');}
  await page.screenshot({path:path.join(out,route.slice(1).replaceAll('/','-')+'-'+width+'.png')});
 });row.telemetry=h.result();await context.close();fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));
}
}catch{report.failure='Guarded auth layout run stopped';}finally{if(browser)await browser.close();report.reproducedCollision=report.cases.some(c=>c.geometry?.overlap);report.exitCode=report.failure||report.cases.some(c=>c.telemetry.exitCode)?1:0;fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({out,exitCode:report.exitCode,reproducedCollision:report.reproducedCollision}));process.exitCode=report.exitCode;}})();
