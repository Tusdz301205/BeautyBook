const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../../..');
const apiReq=require('node:module').createRequire(path.join(root,'beauty-booking-api-main/package.json'));
const webReq=require('node:module').createRequire(path.join(root,'beauty-booking-web-main/beauty-booking-web-main/package.json'));
const {PrismaClient}=apiReq('@prisma/client'),{PrismaPg}=apiReq('@prisma/adapter-pg');
const {chromium}=webReq('@playwright/test'),{BrowserCases}=require('./browser-case.cjs');
const runtime=JSON.parse(fs.readFileSync(path.join(root,'report-output/full-system-qa/runtime.json')));
if(runtime.NODE_ENV!=='test'||new URL(runtime.DATABASE_URL).pathname.slice(1)!==runtime.QA_DATABASE)throw Error('QA database guard');
const db=new PrismaClient({adapter:new PrismaPg({connectionString:runtime.DATABASE_URL})});
const actors=JSON.parse(fs.readFileSync(path.join(root,'report-output/full-system-qa/actors.json'))).actors;
const out=path.join(root,'report-output/bugreport-remediation','pdf-readable-'+crypto.randomUUID());fs.mkdirSync(out,{recursive:true});
const marker=path.join(root,'report-output/bugreport-remediation/pdf-readable-fixture.json');
const report={kind:'REAL_API_DB_AND_BROWSER_PDF',version:require('./source-version.cjs')(root),at:new Date().toISOString(),checks:[],results:[],out};
const tokens={};
const secrets=Object.values(actors).map(a=>a.password).filter(Boolean);
const redact=s=>secrets.reduce((text,value)=>text.split(value).join('[PASSWORD]'),String(s)).replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g,'[JWT]');
const base='http://127.0.0.1:3014/api/v1';
function check(name,ok,details={}){report.checks.push({name,status:ok?'PASS':'FAIL',...details});if(!ok)throw Error(name);}
async function api(who,url,options={}){const r=await fetch(base+url,{...options,headers:{...(tokens[who]?{authorization:'Bearer '+tokens[who]}:{}),'x-forwarded-for':who==='platform_admin'?'127.0.0.30':'127.0.0.41',...options.headers}});return r;}
async function login(who){const r=await api(who,'/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:actors[who].email,password:actors[who].password})});const b=await r.json();check(who+' actual API login',r.status===200&&!!b.accessToken,{http:r.status});tokens[who]=b.accessToken;}
async function fixture(){
 if(fs.existsSync(marker)){const v=JSON.parse(fs.readFileSync(marker));check('reuse only labelled synthetic fixture',v.label==='QA_READABLE_PDF_ONLY'&&await db.business.count({where:{id:v.businessId,name:{startsWith:'QA readable PDF '}}})===1);return v;}
 const suffix=crypto.randomUUID(),owner=await db.businessOwnerProfile.findFirstOrThrow({where:{user:{email:actors.owner0.email}},select:{id:true}});
 const admin=await db.user.findUniqueOrThrow({where:{email:actors.platform_admin.email},select:{id:true}});
 const unrelated=await db.businessOwnerProfile.findFirstOrThrow({where:{user:{email:actors.owner1.email}},select:{id:true}});
 check('foreign owner differs from fixture owner',owner.id!==unrelated.id);
 const business=await db.business.create({data:{ownerId:owner.id,name:'QA readable PDF '+suffix,slug:'qa-readable-pdf-'+suffix,status:'DRAFT'},select:{id:true}});
 const record={label:'QA_READABLE_PDF_ONLY',businessId:business.id,mediaIds:[],createdAt:new Date().toISOString()};
 fs.writeFileSync(marker,JSON.stringify(record,null,2),{flag:'wx'}); // Never blindly allocate again after partial writes.
 for(const version of [1,2]){
  const bytes=fs.readFileSync(path.join(root,'report-output/bugreport-remediation/pdf-readable-fixtures/qa-legal-version-'+version+'.pdf'));
  const form=new FormData();form.append('file',new Blob([bytes],{type:'application/pdf'}),'qa-legal-v'+version+'.pdf');form.append('entityType','LEGAL_DOCUMENT');form.append('entityId',business.id);form.append('businessId',business.id);
  const r=await api('platform_admin','/media/upload',{method:'POST',body:form}),b=await r.json();check('labelled private PDF upload v'+version,r.status===201&&b.visibility==='PRIVATE',{http:r.status});record.mediaIds.push(b.id);fs.writeFileSync(marker,JSON.stringify(record,null,2));
 }
 const doc=await db.businessDocument.create({data:{businessId:business.id,documentType:'BUSINESS_LICENSE',currentVersion:2,versions:{create:record.mediaIds.map((id,index)=>({version:index+1,mediaId:id,documentName:'QA readable version '+(index+1),createdBy:admin.id}))}},select:{id:true}});record.documentId=doc.id;fs.writeFileSync(marker,JSON.stringify(record,null,2));return record;
}
async function main(){let browser,harness;try{
 for(const who of ['platform_admin','owner1'])await login(who);
 const f=await fixture();report.fixture=f;
 const versions=await db.businessDocumentVersion.findMany({where:{documentId:f.documentId},orderBy:{version:'asc'}});check('two actual versions and exact current version',versions.length===2&&versions.every((v,i)=>v.mediaId===f.mediaIds[i]));
 for(const [index,id]of f.mediaIds.entries()){
  const r=await api('platform_admin','/media/'+id+'/content');check('authorized bytes v'+(index+1),r.status===200&&Buffer.from(await r.arrayBuffer()).equals(fs.readFileSync(path.join(root,'report-output/bugreport-remediation/pdf-readable-fixtures/qa-legal-version-'+(index+1)+'.pdf'))));
  const denied=await api('owner1','/media/'+id+'/content');check('cross tenant denied v'+(index+1),denied.status===403,{http:denied.status});
  const publicR=await fetch(base+'/media/public/'+id);check('public document unavailable v'+(index+1),publicR.status===404,{http:publicR.status});
 }
 browser=await chromium.launch({channel:'msedge',headless:true});const context=await browser.newContext(),page=await context.newPage();const h=new BrowserCases(page,{role:'platform_admin',redact});harness=h;const originalRun=h.run.bind(h);h.run=async (...args)=>{const result=await originalRun(...args);if(result.status!=='PASS')throw Error('Browser case failed: '+result.id);return result;};
 await page.route('**/api/v1/**',async route=>{const r=route.request(),p=new URL(r.url()).pathname;if(!['GET','HEAD','OPTIONS'].includes(r.method())&&!['/api/v1/auth/login','/api/v1/auth/refresh'].includes(p)){h.record({kind:'guard',phase:h.current?.phase,message:'Unplanned write',path:p,method:r.method()});await route.abort();return;}await route.continue({headers:{...r.headers(),'x-forwarded-for':'127.0.0.30'}});});
 await h.run({id:'bootstrap',route:'/login',action:'fresh anonymous context',phase:'bootstrap',expected:[{kind:'http',phase:'bootstrap',method:'POST',path:'/api/v1/auth/refresh',status:401,max:1,reason:'Fresh cookie-free bootstrap'}]},async t=>{await page.goto('http://127.0.0.1:5176/login');await page.waitForLoadState('networkidle');t.assert(await page.locator('#login-email').isVisible(),'Real login form');});
 await h.run({id:'admin-login',route:'/login',action:'login',responses:[{method:'POST',path:'/api/v1/auth/login',validate:b=>!!b.accessToken}]},async t=>{await page.locator('#login-email').fill(actors.platform_admin.email);await page.locator('#login-password').fill(actors.platform_admin.password);await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();await page.waitForURL(u=>u.pathname.startsWith('/admin'));await page.waitForLoadState('networkidle');t.assert(new URL(page.url()).pathname.startsWith('/admin'),'Admin workspace');});
 for(const width of [375,768,1024,1440]){
  await page.setViewportSize({width,height:1100});const route='/admin/businesses/'+f.businessId;
  await h.run({id:'load-legal-'+width,route,action:'load actual current and history',responses:[{path:'/api/v1/business/'+f.businessId+'/detail',validate:b=>b.documents?.some(d=>d.id===f.documentId&&d.currentVersion===2)}]},async t=>{await page.goto('http://127.0.0.1:5176'+route);await page.getByRole('button',{name:'Hồ sơ đăng ký',exact:true}).click();await page.waitForLoadState('networkidle');t.assert(await page.getByRole('button',{name:'Xem tài liệu hiện hành',exact:true}).isVisible(),'Actual document current action');});
  for(const version of [2,1])for(const pdfPage of [1,2]){
   await h.run({id:'v'+version+'-page'+pdfPage+'-'+width,route,action:'Read identifiable PDF pixels and text'},async t=>{
    if(pdfPage===1){if(version===2)await page.getByRole('button',{name:'Xem tài liệu hiện hành',exact:true}).click();else{await page.getByText('Các phiên bản đã tải (2)',{exact:true}).click();await page.getByRole('button',{name:'Xem bản 1',exact:true}).click();}}
    else await page.getByRole('button',{name:'Trang sau',exact:true}).click();
    const dialog=page.getByRole('dialog');await dialog.getByText('Trang '+pdfPage+' / 2',{exact:true}).waitFor();
    await dialog.locator('canvas').waitFor({state:'visible'});await dialog.getByText('Đọc nội dung dạng văn bản',{exact:true}).click();
    const label='QA-V'+version+'-P'+pdfPage;t.assert((await dialog.innerText()).includes(label),'Exact content label '+label);t.assert(!(await dialog.innerText()).includes('QA-V'+(version===1?2:1)+'-P'),'No stale other-version content');
    t.assert(await dialog.locator('canvas').evaluate(node=>{const pixels=node.getContext('2d').getImageData(0,0,node.width,node.height).data;let dark=0,coloured=0;for(let i=0;i<pixels.length;i+=4){if(pixels[i]+pixels[i+1]+pixels[i+2]<650)dark++;if(Math.abs(pixels[i]-pixels[i+1])>20)coloured++;}return dark>1000&&coloured>1000;}),'Canvas has visible text and version-coloured content, not blank');
    t.assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No page overflow');
    await page.screenshot({path:path.join(out,'pdf-v'+version+'-p'+pdfPage+'-'+width+'.png'),fullPage:true});
    if(pdfPage===2)await dialog.getByRole('button',{name:'Đóng',exact:true}).click();
   });
  }
 }
 await h.drain();report.results.push(h.result());
 check('private historical media still referenced after UI reads',await db.businessDocumentVersion.count({where:{documentId:f.documentId}})===2);
 }catch(error){report.error=redact(error.message);report.checks.push({name:'runner completion',status:'FAIL',message:report.error});}
 finally{if(harness&&!report.results.length)report.results.push(harness.result());if(browser)await browser.close();await db.$disconnect();report.exitCode=report.checks.some(c=>c.status==='FAIL')||report.results.some(r=>r.exitCode)?1:0;fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({out,checks:report.checks.map(c=>c.status),browserCases:report.results.flatMap(r=>r.cases).map(c=>[c.id,c.status]),exitCode:report.exitCode}));process.exitCode=report.exitCode;}}
main();
