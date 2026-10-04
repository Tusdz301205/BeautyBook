import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {PrismaClient} from '@prisma/client';
import {PrismaPg} from '@prisma/adapter-pg';
import pg from 'pg';
export const env=JSON.parse(readFileSync('../report-output/full-system-qa/runtime.json','utf8'));
export const fixture=JSON.parse(readFileSync('../report-output/full-system-qa/actors.json','utf8'));
assert.equal(fixture.database,new URL(env.DATABASE_URL).pathname.slice(1));assert.match(fixture.database,/^beautybook_test_restriction_\d+$/);
const pool=new pg.Pool({connectionString:env.DATABASE_URL});
export const db=new PrismaClient({adapter:new PrismaPg(pool)});
export const b=fixture.businesses[0],other=fixture.businesses[1],tokens={},results=[],requests=[];
let n=0;export const round=process.argv[2]||'exceptions';
export function save(){writeFileSync(`${env.QA_OUTPUT}/operations-${round}.json`,JSON.stringify({database:fixture.database,updatedAt:new Date().toISOString(),round,results,requests},null,2));}
export async function test(id,feature,fn){try{results.push({id,feature,status:'PASS',kind:'REAL_API_DATABASE',detail:await fn()});}catch(e){results.push({id,feature,status:'FAIL',kind:'REAL_API_DATABASE',error:String(e.message).slice(0,1300)});console.log(`FAIL ${id}: ${String(e.message).slice(0,400)}`);}save();}
export async function call(method,path,actor,data,headers={}){
const r=await fetch(`http://localhost:3012/api/v1${path}`,{method,headers:{'Content-Type':'application/json','X-Forwarded-For':`127.9.${Math.floor(++n/200)%200}.${n%200+1}`,...(actor?{Authorization:`Bearer ${tokens[actor]}`}:{ }),...headers},...(data!==undefined?{body:JSON.stringify(data)}:{})});
const text=await r.text();let body;try{body=JSON.parse(text);}catch{body=text;}requests.push({method,path:path.replace(/([?&]token=)[^&]+/g,'$1[REDACTED]'),actor:actor||'anonymous',status:r.status});return{status:r.status,body,headers:r.headers};}
export function ok(r,expected=[200,201]){assert.ok((Array.isArray(expected)?expected:[expected]).includes(r.status),`HTTP ${r.status}, expected ${expected}: ${JSON.stringify(r.body).slice(0,500)}`);return r.body;}
export async function login(key){const a=fixture.actors[key];const data=ok(await call('POST','/auth/login',null,{email:a.email,password:a.password,workspace:a.workspace,refreshTokenTransport:'BODY'}),200);tokens[key]=data.accessToken;return data;}
export async function slot(offset=7,staff=b.staffId){const date=new Date(Date.now()+offset*86400000).toISOString().slice(0,10);const data=ok(await call('GET',`/bookings/available-slots?branchId=${b.branchId}&serviceIds=${b.serviceId}&staffId=${staff}&date=${date}`));assert.ok(data.slots?.length,`No slots on ${date}`);return data.slots[0].start;}
export async function booking(actor,offset=7,extra={}){return ok(await call('POST','/bookings',actor,{branchId:b.branchId,serviceIds:[b.serviceId],staffId:b.staffId,appointmentDate:await slot(offset),...extra},{'Idempotency-Key':randomUUID()}));}
export async function close(){save();await db.$disconnect();await pool.end();}
