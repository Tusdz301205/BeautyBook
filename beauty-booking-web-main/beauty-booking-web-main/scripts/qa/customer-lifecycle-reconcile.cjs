const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../../..'),req=require('node:module').createRequire(path.join(root,'beauty-booking-api-main/package.json')),rt=JSON.parse(fs.readFileSync(path.join(root,'report-output/full-system-qa/runtime.json'))),fx=JSON.parse(fs.readFileSync(path.join(root,'report-output/full-system-qa/actors.json')));
if(rt.NODE_ENV!=='test'||fx.database!==rt.QA_DATABASE||new URL(rt.DATABASE_URL).pathname.slice(1)!==rt.QA_DATABASE)throw Error('QA guard');
const {PrismaClient}=req('@prisma/client'),{PrismaPg}=req('@prisma/adapter-pg'),db=new PrismaClient({adapter:new PrismaPg({connectionString:rt.DATABASE_URL})}),dir=path.join(root,'report-output/bugreport-remediation');
const selected=['6007ce54-3efc-4782-826e-ebc68b489ef4','cf76977d-f106-4fd8-9dec-e8aba96f6743','2fa7d0a9-d4a4-4a30-8163-046243eadfa1'];
const resume=process.argv.includes('--resume-known'), resultFile=path.join(dir,resume?'lifecycle-reconcile-continuation.json':'lifecycle-reconcile.json');
const out={at:new Date().toISOString(),kind:'RECONCILE_ONLY_ALREADY_COMMITTED_QA_ROWS',checks:[]};
async function call(token,p,method='GET',body){const r=await fetch('http://127.0.0.1:3014/api/v1'+p,{method,headers:{'content-type':'application/json','x-forwarded-for':'127.0.0.20',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});return{status:r.status,body:await r.json()};}
(async()=>{try{if(!resume)fs.writeFileSync(path.join(dir,'lifecycle-reconcile-armed.json'),JSON.stringify({at:out.at}),{flag:'wx'});else if(!fs.existsSync(path.join(dir,'lifecycle-reconcile-armed.json')))throw Error('no baseline reconcile marker');const actor=fx.actors.owner0,login=await call(null,'/auth/login','POST',{email:actor.email,password:actor.password});if(login.status!==200)throw Error('login');
for(const run of selected){const r=JSON.parse(fs.readFileSync(path.join(dir,'customer-lifecycle-'+run,'results.json')));for(const booking of[r.booking,r.rebooking].filter(Boolean)){
const row=await db.booking.findUniqueOrThrow({where:{id:booking.id},include:{customer:{select:{userId:true}},payments:{select:{id:true}}}});
if(row.customer.userId!==r.booking.customerUserId||row.branchId!==fx.businesses[0].branchId||row.payments.length||(!row.note?.includes(run)&&!(r.rebooking?.id===row.id&&r.mutations.some(m=>m.source==='BROWSER'&&m.path==='/api/v1/bookings'&&m.receipt?.id===row.id&&m.receipt.status===201))))throw Error('scope guard');
if(row.status==='CANCELLED'){out.checks.push({id:row.id,status:'PASS',action:'already cancelled; no write'});continue;}
if(!['PENDING','CONFIRMED'].includes(row.status))throw Error('state guard');
const item={id:row.id,before:row.status,armedAt:new Date().toISOString()};out.checks.push(item);fs.writeFileSync(resultFile,JSON.stringify(out,null,2));
const x=await call(login.body.accessToken,'/bookings/'+row.id+'/status','PATCH',{status:'CANCELLED',note:'QA reconcile only known committed failure-run record; history retained'});item.http=x.status;item.after=(await db.booking.findUniqueOrThrow({where:{id:row.id},select:{status:true}})).status;item.status=x.status===200&&item.after==='CANCELLED'?'PASS':'FAIL';if(item.status==='FAIL')throw Error('cancel rejected');
}}
out.exitCode=0;
}catch{out.exitCode=1;out.error='Reconcile failed; inspect scoped rows, do not rerun blind';}finally{await db.$disconnect();fs.writeFileSync(resultFile,JSON.stringify(out,null,2));console.log(JSON.stringify({exitCode:out.exitCode,rows:out.checks.length}));process.exitCode=out.exitCode;}})();
