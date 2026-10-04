import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {PrismaClient} from '@prisma/client';
import {PrismaPg} from '@prisma/adapter-pg';
import pg from 'pg';
import bcrypt from 'bcryptjs';
const env=JSON.parse(readFileSync('../report-output/full-system-qa/runtime.json','utf8'));
assert.match(new URL(env.DATABASE_URL).pathname,/^\/beautybook_test_restriction_\d+$/);
const pool=new pg.Pool({connectionString:env.DATABASE_URL}); const db=new PrismaClient({adapter:new PrismaPg(pool)});
assert.equal(await db.user.count(),0,'Fixture may only run once on a NEW empty QA database');
const hash=await bcrypt.hash(env.QA_PASSWORD,10), suffix=Date.now();
const actors={};
async function account(key,role,scope={},name=key){
 const r=await db.role.findUniqueOrThrow({where:{code:role}});
 const user=await db.user.create({data:{email:`qa-${key}-${suffix}@example.test`,fullName:`QA ${name}`,passwordHash:hash,isEmailVerified:true,isPhoneVerified:true,
  ...(role==='CUSTOMER'?{customerProfile:{create:{}}}:{}),...(role==='BUSINESS_OWNER'?{ownerProfile:{create:{companyName:'Pháp nhân thử nghiệm QA'}}}:{}),
  userRoles:{create:{roleId:r.id,...scope}}},include:{customerProfile:true,ownerProfile:true}});
 actors[key]={id:user.id,email:user.email,password:env.QA_PASSWORD,role,workspace:role==='CUSTOMER'?'CUSTOMER':role.startsWith('PLATFORM_')?'PLATFORM':'SALON',...scope,customerId:user.customerProfile?.id}; return user;
}
try{
 const canonical=await db.canonicalService.create({data:{code:'QA-HAIR',slug:`qa-hair-${suffix}`,name:'Chăm sóc tóc QA',status:'ACTIVE'}});
 const businesses=[];
 for(let tenant=0;tenant<2;tenant++){
  const owner=await account(`owner${tenant}`,'BUSINESS_OWNER');
  const business=await db.business.create({data:{ownerId:owner.ownerProfile.id,name:`BeautyBook QA ${tenant}`,slug:`beautybook-qa-${tenant}-${suffix}`,status:'APPROVED',contactEmail:owner.email,contactPhone:`090999000${tenant}`,addressLine:'Địa chỉ tổng hợp QA',legalRepresentative:'Người đại diện QA',onboardingData:{businessType:'HAIR_SALON'}}});
  actors[`owner${tenant}`].businessId=business.id;
  const ownerRole=await db.role.findUniqueOrThrow({where:{code:'BUSINESS_OWNER'}});
  await db.userRole.updateMany({where:{userId:owner.id,roleId:ownerRole.id},data:{businessId:business.id}});
  const cat=await db.serviceCategory.create({data:{businessId:business.id,name:'Chăm sóc tóc',slug:'cham-soc-toc'}});
  const def=await db.businessService.create({data:{businessId:business.id,categoryId:cat.id,canonicalServiceId:canonical.id,mappingStatus:'MAPPED',name:'Cắt tóc thử nghiệm QA',basePrice:200000,baseDurationMinutes:30}});
  const branch=await db.branch.create({data:{businessId:business.id,name:`Chi nhánh QA ${tenant}`,publicName:`BeautyBook QA ${tenant}`,addressLine:'123 Đường thử nghiệm',phone:`090999000${tenant}`,status:'ACTIVE',reviewStatus:'APPROVED',operationalStatus:'ACTIVE',publishedAt:new Date(),bookingConfirmationMode:'MANUAL_CONFIRMATION',
   workingHours:{create:Array.from({length:7},(_,dayOfWeek)=>({dayOfWeek,openTime:new Date('1970-01-01T08:00:00Z'),closeTime:new Date('1970-01-01T20:00:00Z')}))},bookingPolicy:{create:{earlyCheckInMinutes:60,leadTimeMinutes:0,confirmedAt:new Date()}}}});
  const offering=await db.branchServiceOffering.create({data:{branchId:branch.id,businessServiceId:def.id,categoryId:cat.id,name:def.name,description:'Dịch vụ tổng hợp dùng riêng cho kiểm thử',price:200000,durationMinutes:30}});
  const employee=await account(`staff${tenant}`,'STAFF',{businessId:business.id,branchId:branch.id});
  const staff=await db.staffProfile.create({data:{userId:employee.id,branchId:branch.id,fullName:'Nguyễn Thị Chuyên Viên Có Họ Tên Rất Dài QA',position:'Chuyên viên chăm sóc tóc',bio:'Mô tả tổng hợp dài dùng kiểm tra cách xuống dòng và bố cục trên thiết bị nhỏ.',isBookable:true,publicVisible:true,staffServices:{create:{serviceId:offering.id}},branchAssignments:{create:{branchId:branch.id,startDate:new Date('2020-01-01'),isPrimary:true,isBookable:true}}}});
  await account(`receptionist${tenant}`,'RECEPTIONIST',{businessId:business.id,branchId:branch.id});
  const combo=await db.combo.create({data:{businessId:business.id,branchId:branch.id,name:'Combo kiểm thử QA',comboPrice:180000,comboServices:{create:{serviceId:offering.id,priceSnapshot:200000,durationSnapshot:30}}}});
  await db.branch.create({data:{businessId:business.id,name:'Chi nhánh nháp không công khai QA',status:'PENDING',reviewStatus:'DRAFT',operationalStatus:'INACTIVE'}});
  businesses.push({id:business.id,branchId:branch.id,categoryId:cat.id,businessServiceId:def.id,serviceId:offering.id,staffId:staff.id,staffName:staff.fullName,comboId:combo.id});
 }
 // Only roles actually supported by this repository's RoleCode enum.
 await account('platform_admin','PLATFORM_ADMIN');
 for(let i=0;i<14;i++) await account(`customer${i}`,'CUSTOMER');
 await db.user.update({where:{id:actors.customer13.id},data:{isActive:false}});
 writeFileSync(`${env.QA_RUNTIME}/actors.json`,JSON.stringify({database:env.QA_DATABASE,actors,businesses,canonicalId:canonical.id},null,2));
 writeFileSync(`${env.QA_OUTPUT}/fixture.json`,JSON.stringify({database:env.QA_DATABASE,createdAt:new Date().toISOString(),synthetic:true,users:await db.user.count(),businesses,roles:Object.fromEntries(Object.entries(actors).map(([k,v])=>[k,v.role])),sensitiveValuesExcluded:true},null,2));
 console.log(`Synthetic fixture ready: ${await db.user.count()} users; 2 tenants; 2 active + 2 draft branches.`);
}finally{await db.$disconnect();await pool.end();}
