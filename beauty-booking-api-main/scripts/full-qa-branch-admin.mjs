import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, mkdirSync, existsSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes, createHash} from 'node:crypto';
import {PrismaClient} from '@prisma/client';
import {PrismaPg} from '@prisma/adapter-pg';
import pg from 'pg';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const env=JSON.parse(readFileSync(resolve(root,'report-output/full-system-qa/runtime.json'),'utf8'));
const fixture=JSON.parse(readFileSync(resolve(root,'report-output/full-system-qa/actors.json'),'utf8'));
const database='beautybook_test_restriction_1791039047659', api='http://localhost:3012/api/v1';
assert.equal(new URL(env.DATABASE_URL).pathname,`/${database}`);
assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(env.DATABASE_URL).hostname));
assert.equal(fixture.database,database); assert.equal(env.NODE_ENV,'test'); assert.equal(String(env.PORT),'3012');
assert.ok(!env.EMAIL_USER && !env.EMAIL_PASS,'SMTP must be disabled');
const output=resolve(root,'docs/full-system-qa/evidence/current'); mkdirSync(output,{recursive:true});
const pool=new pg.Pool({connectionString:env.DATABASE_URL}); const db=new PrismaClient({adapter:new PrismaPg(pool)});
const rounds=process.argv[2]?[process.argv[2]]:['baseline','exceptions','final'];
assert.ok(rounds.every(x=>['baseline','exceptions','final'].includes(x)));
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
async function protectedSnapshot(){
  const users=Object.values(fixture.actors).map(a=>a.id), businesses=fixture.businesses.map(b=>b.id);
  return (await Promise.all([
    db.userRole.findMany({where:{userId:{in:users}},orderBy:{id:'asc'}}),
    db.business.findMany({where:{id:{in:businesses}},orderBy:{id:'asc'}}),
    db.staffProfile.findMany({where:{branch:{businessId:{in:businesses}}},orderBy:{id:'asc'}}),
    db.staffService.findMany({where:{staff:{branch:{businessId:{in:businesses}}}},orderBy:[{staffId:'asc'},{serviceId:'asc'}]}),
    pool.query('SELECT * FROM platform_settings ORDER BY id').then(r=>r.rows),
  ])).map(hash);
}
let requestNumber=0;
async function run(round){
  const suffix=`${Date.now()}-${randomBytes(3).toString('hex')}`, password=randomBytes(20).toString('base64url')+'aA1!';
  const tokens={},actors={},owned=new Set(),canonicals=new Set();
  const evidence={database,api,round,syntheticOnly:true,smtpDisabled:true,startedAt:new Date().toISOString(),results:[],requests:[],setup:[],bugs:[],limitations:[]};
  const preferred=resolve(output,`branch-admin-${round}.json`), path=existsSync(preferred)?resolve(output,`branch-admin-${round}-${suffix}.json`):preferred;
  const save=()=>{evidence.updatedAt=new Date().toISOString();writeFileSync(path,JSON.stringify(evidence,null,2));};
  function bug(code,detail){if(!evidence.bugs.some(x=>x.code===code)){evidence.bugs.push({code,confirmed:true,detail});console.log(`CONFIRMED_BUG ${code}: ${detail}`);save();}}
  async function test(name,fn){const id=`BA-${round.toUpperCase()}-${String(evidence.results.length+1).padStart(3,'0')}`,start=evidence.requests.length;
    try{evidence.results.push({id,name,status:'PASS',kind:'REAL_API_DATABASE',detail:await fn(),requests:[start,evidence.requests.length]});}
    catch(e){const error=e instanceof assert.AssertionError?e.message.split('\n')[0]:`Runner error ${e.name}; response suppressed`;evidence.results.push({id,name,status:'FAIL',error,requests:[start,evidence.requests.length]});console.log(`FAIL ${id}: ${name}: ${error}`);}save();}
  async function call(method,path,actor,body){
    // Local pause marker allows the root to drain this runner before restarting.
    if(existsSync(resolve(output,'branch-admin-pause.json')))throw new Error('RootPauseRequested');
    if(method!=='GET'){
      for(const id of path.match(/[0-9a-f]{8}-[0-9a-f-]{27}/g)||[])assert.ok(owned.has(id),'Mutation URL must target a new entity owned by this runner');
      for(const key of ['businessId','branchId','parentId','replacementCanonicalId','categoryId','mediaId'])if(body?.[key])assert.ok(owned.has(body[key]),`Mutation ${key} must target runner-owned entity`);
    }
    const form=body instanceof FormData;
    const r=await fetch(api+path,{method,signal:AbortSignal.timeout(20000),headers:{...(form?{}:{'Content-Type':'application/json'}),'X-Forwarded-For':`127.23.${Math.floor(++requestNumber/200)%200}.${requestNumber%200+1}`,...(actor?{Authorization:`Bearer ${tokens[actor]}`}:{})},...(body===undefined?{}:{body:form?body:JSON.stringify(body)})});
    const text=await r.text();let parsed;try{parsed=JSON.parse(text);}catch{parsed=null;}
    evidence.requests.push({method,path,actor:actor||'anonymous',status:r.status});return {status:r.status,body:parsed};
  }
  const ok=(r,status=[200,201])=>{assert.ok([].concat(status).includes(r.status),`HTTP ${r.status}; expected ${[].concat(status).join('/')}`);return r.body;};
  async function register(key,type='BUSINESS_OWNER'){
    const email=`qa-branch-admin-${key}-${suffix}@example.test`;
    const r=ok(await call('POST','/auth/register',null,{email,password,fullName:`Synthetic branch admin ${key}`,accountType:type,refreshTokenTransport:'BODY'}));
    actors[key]={id:r.user.id,email,businessId:r.user.businessId};owned.add(r.user.id);if(r.user.businessId)owned.add(r.user.businessId);tokens[key]=r.accessToken;
    evidence.setup.push({action:'API_REGISTER_NEW_ACTOR',key,id:r.user.id,businessId:r.user.businessId});
    assert.ok(await db.userSession.findFirst({where:{userId:r.user.id,revokedAt:null}}),'API session must persist in guarded DB');
  }
  async function loginAdmin(){const a=fixture.actors.platform_admin;tokens.admin=ok(await call('POST','/auth/login',null,{email:a.email,password:a.password,workspace:'PLATFORM',refreshTokenTransport:'BODY'}),200).accessToken;}
  async function upload(entityType,id,businessId){assert.ok(owned.has(id)&&owned.has(businessId));const f=new FormData();f.append('entityType',entityType);f.append('entityId',id);f.append('businessId',businessId);f.append('file',new Blob(['%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n'],{type:'application/pdf'}),'synthetic-branch-admin.pdf');const media=ok(await call('POST','/media/upload','owner',f));owned.add(media.id);assert.equal(media.visibility,'PRIVATE','Document upload must remain private');return media;}
  async function newBranch(name,extra={}){const data=ok(await call('POST','/branches','owner',{businessId:business.id,name:`BA ${round} ${name}`,...extra}));assert.ok(data.branch?.id,'Create branch response requires branch ID');owned.add(data.branch.id);evidence.setup.push({action:'API_CREATE_BRANCH',id:data.branch.id,name});return data.branch;}
  const branchRead=()=>db.branch.findUniqueOrThrow({where:{id:branch.id}});
  async function visibility(visible){
    const detail=await call('GET',`/branches/${branch.id}`);ok(detail,visible?200:404);
    for(const endpoint of ['services','reviews'])ok(await call('GET',`/branches/${branch.id}/${endpoint}`),visible?200:404);
    const list=ok(await call('GET',`/branches?search=${encodeURIComponent(branch.name)}&limit=100`));
    assert.ok(Array.isArray(list),'Public list contract is an array');
    assert.equal(list.some(x=>x.id===branch.id),visible,'Public list visibility must match');
    const privateRead=ok(await call('GET',`/branches/accessible/${branch.id}`,'owner'));assert.equal(privateRead.id,branch.id,'Owner must retain private access');
  }
  const before=await protectedSnapshot();let business,branch,document,service,category,canonicalA,canonicalB;
  try{
    assert.equal((await pool.query('SELECT current_database() name')).rows[0].name,database);
    await test('Register owner through API and verify runtime DB provenance',async()=>{await register('owner');return {userId:actors.owner.id,businessId:actors.owner.businessId,sessionInGuardedDb:true};});
    assert.ok(actors.owner,'Owner registration required');
    await register('stranger');await register('customer','CUSTOMER');await loginAdmin();
    business=await db.business.findUniqueOrThrow({where:{id:actors.owner.businessId}});
    await test('Complete synthetic business draft with real uploaded private documents',async()=>{
      const config=ok(await call('GET','/business/onboarding/config','owner'));
      if(config.requirePhoneVerification){await db.user.update({where:{id:actors.owner.id},data:{isPhoneVerified:true}});evidence.setup.push({action:'NEW_ACTOR_PHONE_VERIFICATION_FIXTURE',id:actors.owner.id,reason:'SMTP/OTP disabled; no role edits'});}
      const docs=[];for(const type of ['BUSINESS_LICENSE','OWNER_ID_CARD']){const m=await upload('LEGAL_DOCUMENT',business.id,business.id);docs.push({documentType:type,documentName:`Synthetic ${type}`,documentUrl:`/api/v1/media/${m.id}/content`,mediaId:m.id});}
      ok(await call('PATCH',`/business/${business.id}/onboarding`,'owner',{name:`Branch Admin QA ${round} ${suffix}`,slug:`branch-admin-${suffix}`,companyName:'Synthetic Branch Admin Company',taxCode:suffix.replace(/\D/g,'').slice(-10),contactEmail:actors.owner.email,contactPhone:'0909987766',addressLine:'Synthetic branch admin address',legalRepresentative:'Synthetic QA Owner',onboardingData:{businessType:'HAIR_SALON'},legalDocuments:docs}));
    });
    await test('Submit business and approve through platform review API',async()=>{
      const r=ok(await call('POST',`/business/${business.id}/submit`,'owner'));if(r.status==='PENDING_REVIEW')assert.equal(ok(await call('PATCH',`/business/${business.id}/review`,'admin',{decision:'APPROVE',note:'Synthetic branch QA business approval'})).status,'APPROVED');else assert.equal(r.status,'APPROVED');
      assert.equal((await db.business.findUniqueOrThrow({where:{id:business.id}})).status,'APPROVED');
    });
    assert.equal((await db.business.findUniqueOrThrow({where:{id:business.id}})).status,'APPROVED','Approved business required');
    await test('Create branch draft and read back canonical state',async()=>{branch=await newBranch('primary');assert.equal(branch.reviewStatus,'DRAFT');assert.equal(branch.operationalStatus,'INACTIVE');return {branchId:branch.id};});
    await test('Draft hidden publicly and available in owner preview',async()=>{await visibility(false);assert.equal(ok(await call('GET',`/branches/${branch.id}/preview`,'owner')).id,branch.id);});
    await test('Incomplete submit rejected without state change',async()=>{ok(await call('POST',`/branches/${branch.id}/submit`,'owner'),400);assert.equal((await branchRead()).reviewStatus,'DRAFT');});
    await test('Unapproved publish and premature platform approval rejected',async()=>{ok(await call('POST',`/branches/${branch.id}/publish`,'owner'),409);ok(await call('POST',`/branches/${branch.id}/review`,'admin',{decision:'APPROVE'}),409);});
    await test('Customer and unrelated owner denied branch mutations and private reads',async()=>{for(const actor of ['customer','stranger']){ok(await call('POST',`/branches/${branch.id}/submit`,actor),403);ok(await call('POST',`/branches/${branch.id}/publish`,actor),403);ok(await call('GET',`/branches/accessible/${branch.id}`,actor),403);ok(await call('GET',`/branches/${branch.id}/preview`,actor),403);}});
    await test('Save actual branch DTO and upload operating document',async()=>{
      const district=await db.district.findFirstOrThrow(); // Read-only shared geography reference.
      ok(await call('PATCH',`/branches/${branch.id}/onboarding`,'owner',{currentStep:13,completedSteps:[1,2,3],branch:{name:branch.name,addressLine:`Synthetic location ${suffix}`,districtId:district.id,phone:'0909987766',email:actors.owner.email},workingHours:Array.from({length:7},(_,dayOfWeek)=>({dayOfWeek,openTime:'09:00',closeTime:'18:00',isClosed:false})),bookingPolicy:{leadTimeMinutes:0,bookingHorizonDays:30,cancellationHours:24,rescheduleHours:24,allowWalkIn:false,allowCounterBooking:false}}));
      const media=await upload('BRANCH_DOCUMENT',branch.id,business.id);document=ok(await call('POST',`/branches/${branch.id}/documents`,'owner',{mediaId:media.id,documentType:'OPERATING_LICENSE',documentName:'Synthetic operating license'}));owned.add(document.id);
      ok(await call('GET',`/media/${media.id}/content`),401);ok(await call('GET',`/media/${media.id}/content`,'stranger'),403);ok(await call('GET',`/media/${media.id}/content`,'owner'),200);
      return {documentId:document.id,privateMediaId:media.id};
    });
    await test('Submit actual review request and freeze duplicate submission',async()=>{assert.equal(ok(await call('POST',`/branches/${branch.id}/submit`,'owner')).reviewStatus,'PENDING_REVIEW');ok(await call('POST',`/branches/${branch.id}/submit`,'owner'),409);assert.equal(await db.branchReviewRequest.count({where:{branchId:branch.id,status:'PENDING_REVIEW'}}),1);});
    await test('Owner cannot use platform review route',async()=>{ok(await call('POST',`/branches/${branch.id}/review`,'owner',{decision:'APPROVE'}),403);});
    await test('Request info requires reason then resolves request and marks document',async()=>{
      ok(await call('POST',`/branches/${branch.id}/review`,'admin',{decision:'REQUEST_INFO'}),400);
      assert.equal(ok(await call('POST',`/branches/${branch.id}/review`,'admin',{decision:'REQUEST_INFO',reason:'Synthetic supplemental license detail',targetStep:3})).reviewStatus,'NEED_MORE_INFO');
      assert.equal((await db.branchDocument.findUniqueOrThrow({where:{id:document.id}})).status,'NEED_MORE_INFO');assert.equal(await db.branchReviewRequest.count({where:{branchId:branch.id,status:'PENDING_REVIEW'}}),0);
    });
    await test('Supply new document version, resubmit and approve',async()=>{
      const media=await upload('BRANCH_DOCUMENT',branch.id,business.id);const replacement=ok(await call('POST',`/branches/${branch.id}/documents`,'owner',{mediaId:media.id,documentType:'OPERATING_LICENSE',documentName:'Synthetic supplemented license',replaceDocumentId:document.id}));assert.equal(replacement.id,document.id);assert.equal(replacement.currentVersion,2);
      assert.equal(ok(await call('POST',`/branches/${branch.id}/submit`,'owner')).reviewStatus,'PENDING_REVIEW');assert.equal(ok(await call('POST',`/branches/${branch.id}/review`,'admin',{decision:'APPROVE'})).operationalStatus,'READY_TO_PUBLISH');
      assert.equal((await db.branchDocument.findUniqueOrThrow({where:{id:document.id}})).status,'APPROVED');
    });
    await test('Approval alone remains private; publish fails readiness without staff/services',async()=>{await visibility(false);ok(await call('POST',`/branches/${branch.id}/publish`,'owner'),409);assert.equal((await branchRead()).operationalStatus,'READY_TO_PUBLISH');});
    await test('Create two new platform canonicals and verify readback',async()=>{
      for(const key of ['A','B']){const c=ok(await call('POST','/services/canonical','admin',{code:`BA_${suffix.replace(/-/g,'_')}_${key}`.toUpperCase(),slug:`ba-${suffix}-${key.toLowerCase()}`,name:`Synthetic BA ${round} ${key}`,synonyms:[' synthetic alias ','synthetic alias']}));owned.add(c.id);canonicals.add(c.id);if(key==='A')canonicalA=c;else canonicalB=c;}
      const list=ok(await call('GET','/services/canonical/manage','admin'));assert.ok([canonicalA,canonicalB].every(c=>list.some(x=>x.id===c.id)));
    });
    await test('Tenant cannot manage platform canonical taxonomy',async()=>{ok(await call('POST','/services/canonical','owner',{code:`DENIED_${suffix.replace(/-/g,'_')}`,slug:`denied-${suffix}`,name:'Synthetic denied'}),403);ok(await call('PATCH',`/services/canonical/${canonicalA.id}`,'owner',{name:'Synthetic unauthorized'}),403);});
    await test('Canonical update and self merge rejection persist correct state',async()=>{assert.equal(ok(await call('PATCH',`/services/canonical/${canonicalA.id}`,'admin',{name:'Synthetic renamed BA canonical'})).name,'Synthetic renamed BA canonical');ok(await call('PATCH',`/services/canonical/${canonicalA.id}`,'admin',{status:'MERGED',replacementCanonicalId:canonicalA.id}),400);assert.equal((await db.canonicalService.findUniqueOrThrow({where:{id:canonicalA.id}})).status,'ACTIVE');});
    await test('Create new tenant category, service catalog and bookable staff through APIs',async()=>{
      category=ok(await call('POST','/services/categories','owner',{businessId:business.id,name:'Synthetic QA category',slug:`ba-${suffix}`}));owned.add(category.id);
      const catalog=ok(await call('POST','/services','owner',{branchId:branch.id,categoryId:category.id,name:'Synthetic BA service',price:100000,durationMinutes:30,canonicalServiceId:canonicalA.id}));owned.add(catalog.id);
      service=await db.branchServiceOffering.findUniqueOrThrow({where:{branchId_businessServiceId:{branchId:branch.id,businessServiceId:catalog.id}}});owned.add(service.id);
      const staff=ok(await call('POST','/staff','owner',{branchId:branch.id,fullName:'Synthetic BA professional',position:'Beauty professional',isBookable:true,publicVisible:true}));owned.add(staff.id);
      if(staff.status!=='ACTIVE')ok(await call('PATCH',`/staff/${staff.id}`,'owner',{status:'ACTIVE',isBookable:true,publicVisible:true}));
      evidence.setup.push({action:'NEW_OPERATIONAL_ENTITIES_ONLY',categoryId:category.id,serviceId:service.id,staffId:staff.id});
      return {categoryId:category.id,serviceId:service.id,staffId:staff.id};
    });
    await test('Tenant category visible to owning business only',async()=>{assert.ok(ok(await call('GET','/services/categories/manage','owner')).some(x=>x.id===category.id));assert.ok(!ok(await call('GET','/services/categories/manage','stranger')).some(x=>x.id===category.id));ok(await call('POST','/services/categories','stranger',{businessId:business.id,name:'Synthetic denied category',slug:`denied-${suffix}`}),403);});
    await test('Publish ready branch; verify public detail/list/services/reviews and private DTO',async()=>{const r=ok(await call('POST',`/branches/${branch.id}/publish`,'owner'));assert.equal(r.status,'ACTIVE');assert.equal(r.operationalStatus,'ACTIVE');await visibility(true);return {publishedAt:r.publishedAt};});
    await test('Repeat publish rejected; history not duplicated',async()=>{const count=await db.branchStateTransition.count({where:{branchId:branch.id}});ok(await call('POST',`/branches/${branch.id}/publish`,'owner'),409);assert.equal(await db.branchStateTransition.count({where:{branchId:branch.id}}),count);});
    await test('Merge synthetic canonical alias; public hides alias and management retains replacement',async()=>{const r=ok(await call('PATCH',`/services/canonical/${canonicalA.id}`,'admin',{status:'MERGED',replacementCanonicalId:canonicalB.id}));assert.equal(r.replacementCanonicalId,canonicalB.id);assert.ok(!ok(await call('GET','/services/canonical')).some(x=>x.id===canonicalA.id));assert.ok(ok(await call('GET','/services/canonical/manage','admin')).some(x=>x.id===canonicalA.id&&x.status==='MERGED'));assert.equal((await db.branchServiceOffering.findUniqueOrThrow({where:{id:service.id},include:{businessService:true}})).businessService.canonicalServiceId,canonicalA.id,'Merge preserves original catalog identity');});
    await test('Deprecate new canonical and preserve history',async()=>{const r=ok(await call('PATCH',`/services/canonical/${canonicalB.id}`,'admin',{status:'DEPRECATED'}));assert.equal(r.status,'DEPRECATED');assert.ok(!ok(await call('GET','/services/categories')).some(x=>x.id===canonicalB.id));assert.ok(await db.canonicalService.findUnique({where:{id:canonicalB.id}}));});
    evidence.limitations.push('Canonical deletion is represented by DEPRECATED; no DELETE route. Tenant categories expose create/list only; category update/delete/merge routes do not exist. No application source changed.');
    await test('Unpublish via PAUSE and verify all public routes hidden',async()=>{const r=ok(await call('POST',`/branches/${branch.id}/transition`,'owner',{action:'PAUSE',reason:'Synthetic unpublish acceptance'}));assert.equal(r.branch.operationalStatus,'PAUSED');await visibility(false);});
    await test('Repeat pause rejected; restore republished visibility',async()=>{ok(await call('POST',`/branches/${branch.id}/transition`,'owner',{action:'PAUSE',reason:'Synthetic repeat'}),409);const r=ok(await call('POST',`/branches/${branch.id}/transition`,'owner',{action:'RESTORE',reason:'Synthetic restore acceptance'}));assert.equal(r.branch.operationalStatus,'ACTIVE');await visibility(true);});
    await test('Retain final branch unpublished and verify review/state history',async()=>{ok(await call('POST',`/branches/${branch.id}/transition`,'owner',{action:'PAUSE',reason:'Synthetic final private state'}));await visibility(false);const events=await db.branchReviewEvent.findMany({where:{branchId:branch.id},orderBy:{createdAt:'asc'}});assert.ok(['SUBMIT','REQUEST_INFO','RESUBMIT','APPROVE'].every(action=>events.some(x=>x.action===action)));assert.equal(await db.branchReviewRequest.count({where:{branchId:branch.id}}),2);return {events:events.map(x=>x.action),documentVersions:await db.branchDocumentVersion.count({where:{documentId:document.id}})};});
    if(round!=='baseline'){
      await test('Malformed branch onboarding boolean rejected with no policy mutation',async()=>{const policy=await db.branchBookingPolicy.findUniqueOrThrow({where:{branchId:branch.id}});ok(await call('PATCH',`/branches/${branch.id}/onboarding`,'owner',{currentStep:1,bookingPolicy:{allowWalkIn:'false'}}),400);assert.equal((await db.branchBookingPolicy.findUniqueOrThrow({where:{branchId:branch.id}})).allowWalkIn,policy.allowWalkIn);});
      await test('Duplicate category slug returns client conflict without insert',async()=>{const count=await db.serviceCategory.count({where:{businessId:business.id}});const r=await call('POST','/services/categories','owner',{businessId:business.id,name:'Synthetic duplicate',slug:category.slug});assert.equal(await db.serviceCategory.count({where:{businessId:business.id}}),count);if(r.status===500)bug('BA-CATEGORY-DUPLICATE-500','POST /services/categories duplicate new tenant slug returns 500, not a client conflict; category count unchanged.');ok(r,409);});
      await test('Duplicate canonical code returns client conflict without insert',async()=>{const r=await call('POST','/services/canonical','admin',{code:canonicalA.code,slug:`duplicate-${suffix}`,name:'Synthetic duplicate canonical'});if(r.status===500)bug('BA-CANONICAL-DUPLICATE-500','POST /services/canonical duplicate new synthetic code returns 500 instead of a client conflict.');ok(r,409);});
      await test('Owner transition cannot bypass platform approval',async()=>{const probe=await newBranch('approval-boundary',{serviceMode:'MOBILE',phone:'0909987766'});ok(await call('POST',`/branches/${probe.id}/submit`,'owner'));const r=await call('POST',`/branches/${probe.id}/transition`,'owner',{action:'APPROVE',reason:'Synthetic unauthorized approval boundary'});const stored=await db.branch.findUniqueOrThrow({where:{id:probe.id}});if(r.status===201&&stored.reviewStatus==='APPROVED')bug('BA-OWNER-APPROVAL-BYPASS',`Owner POST /branches/${probe.id}/transition action APPROVE persists APPROVED without platform review.`);ok(r,403);assert.equal(stored.reviewStatus,'PENDING_REVIEW');});
      await test('Owner generic publish cannot bypass readiness checklist',async()=>{const probe=await newBranch('readiness-boundary',{serviceMode:'MOBILE',phone:'0909987766'});ok(await call('POST',`/branches/${probe.id}/submit`,'owner'));ok(await call('POST',`/branches/${probe.id}/review`,'admin',{decision:'APPROVE'}));const r=await call('POST',`/branches/${probe.id}/transition`,'owner',{action:'PUBLISH',reason:'Synthetic readiness bypass probe'});const stored=await db.branch.findUniqueOrThrow({where:{id:probe.id}});if(r.status===201&&stored.operationalStatus==='ACTIVE')bug('BA-TRANSITION-READINESS-BYPASS',`Generic PUBLISH sets new branch ${probe.id} ACTIVE without services, staff, hours, confirmed policy or mobile service areas.`);if(stored.operationalStatus==='ACTIVE')ok(await call('POST',`/branches/${probe.id}/transition`,'owner',{action:'PAUSE',reason:'Retain synthetic probe private'}));ok(r,409);});
    }
    if(round==='final'){
      let generic;
      const transition=(id,action,actor='owner')=>call('POST',`/branches/${id}/transition`,actor,{action,reason:`Synthetic generic ${action} regression`});
      function wrapper(r,review,operational){const value=ok(r,201);assert.equal(value.transitioned,true,'Generic transition wrapper must remain compatible');assert.equal(value.branch.reviewStatus,review);assert.equal(value.branch.operationalStatus,operational);assert.equal(typeof value.canonical.publicVisible,'boolean');return value;}
      await test('Generic SUBMIT validates incomplete draft with no review request',async()=>{generic=await newBranch('generic-regression');ok(await transition(generic.id,'SUBMIT'),400);assert.equal((await db.branch.findUniqueOrThrow({where:{id:generic.id}})).reviewStatus,'DRAFT');assert.equal(await db.branchReviewRequest.count({where:{branchId:generic.id}}),0);});
      await test('Generic SUBMIT creates actual request and retains wrapper',async()=>{const district=await db.district.findFirstOrThrow();ok(await call('PATCH',`/branches/${generic.id}/onboarding`,'owner',{currentStep:13,branch:{addressLine:`Synthetic generic location ${suffix}`,districtId:district.id,phone:'0909987766'},workingHours:[{dayOfWeek:1,openTime:'09:00',closeTime:'18:00',isClosed:false}],bookingPolicy:{leadTimeMinutes:0,bookingHorizonDays:30,allowWalkIn:false}}));wrapper(await transition(generic.id,'SUBMIT'),'PENDING_REVIEW','INACTIVE');assert.equal(await db.branchReviewRequest.count({where:{branchId:generic.id,status:'PENDING_REVIEW'}}),1);});
      await test('Owner denied all platform-only generic actions with unchanged pending state',async()=>{const count=await db.branchStateTransition.count({where:{branchId:generic.id}});for(const action of ['APPROVE','REQUEST_INFO','REJECT','SUSPEND'])ok(await transition(generic.id,action),403);assert.equal((await db.branch.findUniqueOrThrow({where:{id:generic.id}})).reviewStatus,'PENDING_REVIEW');assert.equal(await db.branchStateTransition.count({where:{branchId:generic.id}}),count);});
      await test('Platform generic REQUEST_INFO resolves request; generic resubmit creates new request',async()=>{wrapper(await transition(generic.id,'REQUEST_INFO','admin'),'NEED_MORE_INFO','INACTIVE');assert.equal(await db.branchReviewRequest.count({where:{branchId:generic.id,status:'NEED_MORE_INFO'}}),1);wrapper(await transition(generic.id,'SUBMIT'),'PENDING_REVIEW','INACTIVE');assert.equal(await db.branchReviewRequest.count({where:{branchId:generic.id,status:'PENDING_REVIEW'}}),1);});
      await test('Valid platform generic APPROVE resolves actual review request and preserves wrapper',async()=>{wrapper(await transition(generic.id,'APPROVE','admin'),'APPROVED','READY_TO_PUBLISH');assert.equal(await db.branchReviewRequest.count({where:{branchId:generic.id,status:'APPROVED'}}),1);const events=await db.branchReviewEvent.findMany({where:{branchId:generic.id}});assert.ok(['SUBMIT','REQUEST_INFO','RESUBMIT','APPROVE'].every(action=>events.some(x=>x.action===action)));});
      await test('Valid generic PUBLISH preserves wrapper and public visibility',async()=>{const catalog=ok(await call('POST','/services','owner',{branchId:generic.id,categoryId:category.id,name:'Synthetic generic publish service',price:100000,durationMinutes:30}));owned.add(catalog.id);const offering=await db.branchServiceOffering.findUniqueOrThrow({where:{branchId_businessServiceId:{branchId:generic.id,businessServiceId:catalog.id}}});owned.add(offering.id);const staff=ok(await call('POST','/staff','owner',{branchId:generic.id,fullName:'Synthetic generic professional',isBookable:true,publicVisible:true}));owned.add(staff.id);if(staff.status!=='ACTIVE')ok(await call('PATCH',`/staff/${staff.id}`,'owner',{status:'ACTIVE',isBookable:true,publicVisible:true}));ok(await call('PATCH',`/staff/${staff.id}/services`,'owner',{serviceIds:[offering.id]}));const value=wrapper(await transition(generic.id,'PUBLISH'),'APPROVED','ACTIVE');assert.equal(value.canonical.publicVisible,true);ok(await call('GET',`/branches/${generic.id}`),200);wrapper(await transition(generic.id,'PAUSE'),'APPROVED','PAUSED');});
      await test('Incomplete PAUSED branch RESTORE rejected with 409 and no transition',async()=>{ok(await call('PATCH',`/services/offerings/${service.id}/status`,'owner',{status:'INACTIVE'}));const count=await db.branchStateTransition.count({where:{branchId:branch.id}});ok(await transition(branch.id,'RESTORE'),409);assert.equal((await branchRead()).operationalStatus,'PAUSED');assert.equal(await db.branchStateTransition.count({where:{branchId:branch.id}}),count);ok(await call('PATCH',`/services/offerings/${service.id}/status`,'owner',{status:'ACTIVE'}));await visibility(false);});
      await test('Suspended branch restore requires platform; valid platform restore retains readiness and wrapper',async()=>{wrapper(await transition(generic.id,'SUSPEND','admin'),'APPROVED','SUSPENDED');ok(await transition(generic.id,'RESTORE'),403);wrapper(await transition(generic.id,'RESTORE','admin'),'APPROVED','ACTIVE');ok(await call('GET',`/branches/${generic.id}`),200);wrapper(await transition(generic.id,'PAUSE'),'APPROVED','PAUSED');ok(await call('GET',`/branches/${generic.id}`),404);});
      await test('Admin restores suspended DRAFT privately without readiness, owner can then submit',async()=>{
        const probe=await newBranch('draft-restore-regression',{serviceMode:'MOBILE',phone:'0909987766'});
        wrapper(await transition(probe.id,'SUSPEND','admin'),'DRAFT','SUSPENDED');
        const count=await db.branchStateTransition.count({where:{branchId:probe.id}});
        ok(await transition(probe.id,'RESTORE'),403);
        assert.equal((await db.branch.findUniqueOrThrow({where:{id:probe.id}})).operationalStatus,'SUSPENDED');
        assert.equal(await db.branchStateTransition.count({where:{branchId:probe.id}}),count,'Owner denial must not create transition');
        const restored=wrapper(await transition(probe.id,'RESTORE','admin'),'DRAFT','INACTIVE');
        assert.equal(restored.canonical.publicVisible,false);assert.equal(restored.canonical.bookable,false);
        const stored=await db.branch.findUniqueOrThrow({where:{id:probe.id}});
        assert.equal(stored.status,'PENDING');assert.equal(stored.reviewStatus,'DRAFT');assert.equal(stored.operationalStatus,'INACTIVE');assert.equal(stored.publishedAt,null);
        for(const endpoint of ['', '/services','/reviews'])ok(await call('GET',`/branches/${probe.id}${endpoint}`),404);
        assert.equal(await db.branchReviewRequest.count({where:{branchId:probe.id}}),0);
        wrapper(await transition(probe.id,'SUBMIT'),'PENDING_REVIEW','INACTIVE');
        assert.equal(await db.branchReviewRequest.count({where:{branchId:probe.id,status:'PENDING_REVIEW'}}),1);
        return {branchId:probe.id,ownerRestoreStatus:403,adminRestoredReviewStatus:'DRAFT',adminRestoredOperationalStatus:'INACTIVE',publicStatus:404,ownerSubmitSucceeded:true};
      });
      await test('Admin generic REJECT from NEED_MORE_INFO resolves request, documents and review events',async()=>{
        const probe=await newBranch('need-more-info-reject-regression',{serviceMode:'MOBILE',phone:'0909987766'});
        const media=await upload('BRANCH_DOCUMENT',probe.id,business.id);
        const doc=ok(await call('POST',`/branches/${probe.id}/documents`,'owner',{mediaId:media.id,documentType:'OPERATING_LICENSE',documentName:'Synthetic rejection regression document'}));owned.add(doc.id);
        wrapper(await transition(probe.id,'SUBMIT'),'PENDING_REVIEW','INACTIVE');
        const request=await db.branchReviewRequest.findFirstOrThrow({where:{branchId:probe.id,status:'PENDING_REVIEW'}});
        wrapper(await transition(probe.id,'REQUEST_INFO','admin'),'NEED_MORE_INFO','INACTIVE');
        assert.equal((await db.branchDocument.findUniqueOrThrow({where:{id:doc.id}})).status,'NEED_MORE_INFO');
        assert.equal((await db.branchReviewRequest.findUniqueOrThrow({where:{id:request.id}})).status,'NEED_MORE_INFO');
        const count=await db.branchStateTransition.count({where:{branchId:probe.id}}), eventCount=await db.branchReviewEvent.count({where:{branchId:probe.id}});
        ok(await transition(probe.id,'REJECT'),403);
        assert.equal((await db.branch.findUniqueOrThrow({where:{id:probe.id}})).reviewStatus,'NEED_MORE_INFO');
        assert.equal(await db.branchStateTransition.count({where:{branchId:probe.id}}),count);assert.equal(await db.branchReviewEvent.count({where:{branchId:probe.id}}),eventCount);
        const rejected=wrapper(await transition(probe.id,'REJECT','admin'),'REJECTED','INACTIVE');assert.equal(rejected.canonical.publicVisible,false);
        const resolved=await db.branchReviewRequest.findUniqueOrThrow({where:{id:request.id}});
        assert.equal(resolved.status,'REJECTED');assert.ok(resolved.resolvedAt);assert.equal(resolved.assignedTo,fixture.actors.platform_admin.id);
        assert.equal(await db.branchReviewRequest.count({where:{branchId:probe.id}}),1,'Rejection must resolve original request');
        assert.equal((await db.branchDocument.findUniqueOrThrow({where:{id:doc.id}})).status,'REJECTED');
        assert.equal(await db.branchDocumentVersion.count({where:{documentId:doc.id}}),1,'Rejection retains uploaded version history');
        const events=await db.branchReviewEvent.findMany({where:{branchId:probe.id},orderBy:{createdAt:'asc'}});
        assert.deepEqual(events.map(x=>x.action),['SUBMIT','REQUEST_INFO','REJECT']);
        const last=events.at(-1);assert.equal(last.fromStatus,'NEED_MORE_INFO');assert.equal(last.toStatus,'REJECTED');assert.equal(last.actorId,fixture.actors.platform_admin.id);assert.ok(last.reason);
        for(const endpoint of ['', '/services','/reviews'])ok(await call('GET',`/branches/${probe.id}${endpoint}`),404);
        return {branchId:probe.id,requestId:request.id,documentId:doc.id,ownerRejectStatus:403,requestStatus:resolved.status,documentStatus:'REJECTED',events:events.map(x=>x.action),publicStatus:404};
      });
    }
  }catch(e){evidence.setupFailure=e instanceof assert.AssertionError?e.message.split('\n')[0]:`Setup interrupted (${e.name}); sensitive details suppressed`;console.log(`SETUP_FAILURE ${round}: ${evidence.setupFailure}`);}
  finally{await test('Protected base businesses, actor roles, staff mappings and settings unchanged',async()=>{assert.deepEqual(await protectedSnapshot(),before,'Protected snapshots must remain unchanged');return {comparedGroups:5,unchanged:true};});evidence.finishedAt=new Date().toISOString();evidence.summary={pass:evidence.results.filter(x=>x.status==='PASS').length,fail:evidence.results.filter(x=>x.status==='FAIL').length,confirmedBugs:evidence.bugs.length,requests:evidence.requests.length};save();console.log(`${round}: ${JSON.stringify(evidence.summary)}`);}
  return evidence;
}
try{const results=[];for(const round of rounds)results.push(await run(round));process.exitCode=results.some(x=>x.setupFailure||x.summary.fail)?1:0;}finally{await db.$disconnect();await pool.end();}
