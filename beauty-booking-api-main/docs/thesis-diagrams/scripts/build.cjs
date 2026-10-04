const fs=require('fs'),path=require('path'),crypto=require('crypto');
const out=path.resolve(__dirname,'..'),api=path.resolve(out,'../..'),repo=path.resolve(api,'..');
const inv=JSON.parse(fs.readFileSync(path.join(out,'00-scope-and-traceability/source-inventory.json'),'utf8'));
const {actors,roles,business,usecases}=require('./catalog.cjs');
const web=path.join(repo,'beauty-booking-web-main/beauty-booking-web-main/src');
const read=p=>fs.readFileSync(p,'utf8');
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const write=(p,s)=>{fs.mkdirSync(path.dirname(path.join(out,p)),{recursive:true});fs.writeFileSync(path.join(out,p),s+'\n')};
const url=(p,from=out)=>path.relative(from,p).replaceAll('\\','/');
const files=[];function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p);else files.push(p)}}walk(web);
const cls=n=>{const c=inv.classes.find(c=>c.name===n);if(!c)throw Error('Class missing: '+n);return c};
function method(ref){const [c,m]=ref.split('.');const c0=cls(c),m0=c0.members.find(x=>x.name===m);if(!m0)throw Error('Method missing: '+ref);return {c:c0,m:m0};}
const evidence=ref=>{const {c,m}=method(ref);return `[${ref}](${url(path.join(api,c.file))}) (dòng ${m.line})`;};
const uiFor=u=>u.ui.split(' ').map(p=>files.find(f=>f.replaceAll('\\','/').endsWith('/pages/'+p))||files.find(f=>path.basename(f)===path.basename(p))).filter(Boolean);
for(const u of usecases){u.methods.forEach(method);u.models.forEach(m=>{if(!inv.models.some(x=>x.name===m))throw Error('Model missing '+m)});u.frontend=uiFor(u).map(p=>url(p));}
const manifest=[];
const theme=`skinparam backgroundColor white
skinparam defaultFontName Times New Roman
skinparam defaultFontSize 17
skinparam shadowing false
skinparam roundcorner 2
skinparam linetype ortho
skinparam nodesep 44
skinparam ranksep 58
skinparam ArrowColor #444444
skinparam ArrowFontColor #333333
skinparam ArrowFontSize 14
skinparam classAttributeIconSize 0
skinparam stereotypeCBackgroundColor white
skinparam stereotypeIBackgroundColor white
skinparam classBackgroundColor white
skinparam classBorderColor #333333
skinparam classFontColor #111111
skinparam classFontStyle bold
skinparam classAttributeFontStyle plain
skinparam entityFontStyle bold
skinparam usecaseBackgroundColor #fffde7
skinparam usecaseBorderColor #773b4a
skinparam usecaseFontColor black
skinparam actorBorderColor #773b4a
skinparam actorBackgroundColor white
skinparam actorFontColor black
skinparam actorStyle stickman
hide circle
hide empty members`;
write('presentation.json',JSON.stringify({profile:'BeautyBook traditional UML',paper:'#ffffff',ink:'#111111',muted:'#444444',font:'Times New Roman',fallback:'serif',usecaseFill:'#fffde7',usecaseStroke:'#773b4a',layout:'A4 portrait or landscape by measured bounds',minPrintPointSize:8.5,pngScale:3,semanticPriority:'UML arrows, visibility and cardinality override decorative rules',skill:'skills/diagram-design/skills/diagram-design/SKILL.md',exceptions:['User reference style: white paper, Times New Roman, pale cream use cases, muted wine outlines, monochrome class and ERD boxes.','PlantUML is the semantic source. Use Case SVG layout parses the same aliases and associations; other SVGs use PlantUML directly. All SVGs are embedded unchanged in HTML, extracted and rasterized.','Graphviz orthogonal routing is checked visually; no relationship semantics are changed for decoration.']},null,2));
function diagram(id,group,title,scope,body,meta={}) {
  // PlantUML requires class members to start on a new line.
  body=body.replace(/(class \w+) \{ ([^\n]+)/g,'$1 {\n$2').replace(/\(\) \}/g,'()\n}');
  if(group==='03-analysis-classes')body=require('./analysis-labels.cjs').apply(body);
  // Explicit Creole weight is respected by the bundled PlantUML version;
  // classFontStyle alone does not make its class headers bold.
  body=body.replace(/^(class|interface) "([^"]+)" as (\w+)/gm,'$1 "**$2**" as $3')
    .replace(/^(class|interface) (\w+) \{/gm,'$1 "**$2**" as $2 {')
    .replace(/^entity "(\w+)\\n/gm,'entity "**$1**\\n');
  const source=`${group}/${id}.puml`;
  write(source,`@startuml ${id}\n' ${scope}\n${theme}\n${/^(BUC|SUC)-/.test(id)?'skinparam ArrowColor #773b4a\n':''}${body}\n@enduml`);
  manifest.push({id,group,title,scope,source,...meta});
}
const bgroup='01-business-use-cases',sgroup='02-system-use-cases',agroup='03-analysis-classes',dgroup='04-design-classes',egroup='05-data-model';
function businessDiagram(id,nums,title){const b=business.filter(x=>nums.includes(Number(x.id.slice(4))));
  const outside=b.some(x=>[7,10,11].includes(Number(x.id.slice(4))))?'Đại diện cơ sở':'Khách sử dụng dịch vụ';
  const worker=b.some(x=>[7,10,11,12].includes(Number(x.id.slice(4))))?'Điều phối nền tảng':'Nhân sự cơ sở';
  const body=`left to right direction\nactor "${outside}" as BA <<business actor>>\nrectangle "Hoạt động phối hợp BeautyBook và cơ sở" {\nactor "${worker}" as BW <<business worker>>\n${b.map(x=>`usecase "${x.id}\\n${x.name}" as ${x.id.replace('-','_')}`).join('\n')}\n}\n${b.map(x=>`BA -right- ${x.id.replace('-','_')}\n${x.id.replace('-','_')} -right- BW`).join('\n')}`;
  diagram(id,bgroup,title,'Mục tiêu kinh doanh; nhân sự bên trong ranh giới là worker, không phải role kế thừa.',body,{bucs:b.map(x=>x.id)});
}
businessDiagram('BUC-overview',[1,2,4],'Tổng quan hành trình giá trị khách hàng');
businessDiagram('BUC-service',[2,3,4],'Cam kết và thực hiện dịch vụ');
businessDiagram('BUC-financial',[5,6,12],'Quyết toán, quan hệ khách hàng và dữ liệu');
businessDiagram('BUC-operations',[7,8,9],'Gia nhập và duy trì năng lực cơ sở');
businessDiagram('BUC-governance',[10,11],'Chuyển giao và giám sát nền tảng');
const ucGroups=[
 ['SUC-overview',[1,5,13,17,23],['V','C','O','R','S','A'],'Các tương tác cốt lõi'],
 ['SUC-discovery',[1,6,12],['V','C'],'Khám phá và lưu dịch vụ'],
 ['SUC-auth',[2,3],['V'],'Thiết lập và khôi phục truy cập'],
 ['SUC-customer-account',[3,4,31,32],['C'],'Tài khoản và quyền dữ liệu khách'],
 ['SUC-staff-account',[3,4,31],['O','R','S'],'Tài khoản nhân sự'],
 ['SUC-admin-account',[3,4,31],['A'],'Tài khoản quản trị'],
 ['SUC-booking',[5,6,7,8],['C'],'Tự đặt và theo dõi lịch'],
 ['SUC-change',[9,10,11],['C'],'Hủy, đổi và lịch định kỳ'],
 ['SUC-counter',[13,14,15,16],['O','R'],'Điều phối tại quầy'],
 ['SUC-delivery',[17,14],['O','S'],'Phân công và thực hiện dịch vụ'],
 ['SUC-payments',[18,19,20],['O','R','A'],'Thu và hoàn tiền'],
 ['SUC-packages',[21,36],['C','O','R','A'],'Gói buổi và đối soát'],
 ['SUC-onboarding',[22,23,24],['O','A'],'Thẩm định và công bố'],
 ['SUC-resources',[25,26,27,40],['O'],'Chuẩn bị dịch vụ và nhân sự'],
 ['SUC-invitation',[26],['V'],'Người nhận lời mời nhân sự'],
 ['SUC-relations',[28,29,30],['C','O','A'],'Ưu đãi và đánh giá'],
 ['SUC-continuity',[33,34,35],['O','R','S','A'],'Tác động vận hành và chuyển chủ'],
 ['SUC-governance',[36,37,38,39],['O','A'],'Quản trị và báo cáo'],
 ['SUC-media',[40],['C','R','S','A'],'Tài liệu và media theo scope'],
];
for(const [id,ns,as,title] of ucGroups){const us=usecases.filter(u=>ns.includes(Number(u.id.slice(4))));
  const body=`left to right direction\n${as.map(a=>`actor "${actors[a]}" as ${a}`).join('\n')}\nrectangle "Hệ thống BeautyBook" {\n${us.map(u=>`usecase "${u.id}\\n${u.name}" as ${u.id.replace('-','_')}`).join('\n')}\n}\n${us.flatMap(u=>u.actors.filter(a=>as.includes(a)).map(a=>`${a} -- ${u.id.replace('-','_')}`)).join('\n')}`;
  diagram(id,sgroup,title,'Association thể hiện tham gia; quyền chi tiết nằm trong đặc tả. Không dùng include/extend để mô tả thứ tự.',body,{sucs:us.map(u=>u.id)});
}

// Analysis concepts are deliberately different from implementation classes.
const analysis=[
 ['AC-booking','Đặt lịch',[5,6,7,13],['KenhTiepNhan','DieuPhoiDatLich','LichHen','PhanDichVu','NangLucPhucVu'],['BookingsController','BookingsService','PricingEngineService'],['Booking','BookingService','StaffService']],
 ['AC-change','Thay đổi cam kết',[8,9,10,15,16],['KenhYeuCau','XuLyThayDoi','YeuCauThayDoi','LichHen','LichSuViPham'],['ChangeRequestsService','BookingsService'],['AppointmentChangeRequest','BookingViolationEvent','CustomerBookingPolicy']],
 ['AC-delivery','Thực hiện tại cơ sở',[14,16,17,33],['BangDieuPhoi','DieuPhoiThucHien','PhanDichVu','ChuyenVien','HoSoTacDong'],['BookingItemsService','BookingsService','ImpactService'],['BookingService','StaffProfile','OperationalImpactCase']],
 ['AC-finance','Khoản thu và hoàn trả',[18,19,20,21,36],['KenhQuyetToan','KiemSoatSoDu','KhoanThu','YeuCauHoan','QuyenDungBuoi'],['PaymentsService','FinancialMetricsService'],['Payment','RefundRequest','PackageSessionEntitlement']],
 ['AC-onboarding','Thẩm định cơ sở',[22,23,24,40],['KenhHoSo','ThamDinhCoSo','HoSoDoanhNghiep','ChiNhanh','BangChungPhapLy'],['BusinessOnboardingService','BranchesService','MediaService'],['Business','Branch','BusinessDocument']],
 ['AC-capacity','Danh mục và năng lực',[25,26,27,38],['KenhQuanLyCoSo','QuanLyNangLuc','DichVuCungCap','ChuyenVien','GoiDichVu'],['ServicesService','StaffService','StaffInvitationsService','CombosService'],['BusinessService','BranchServiceOffering','StaffProfile','Combo']],
 ['AC-relations','Quan hệ khách hàng',[1,12,28,29,30,31],['KenhTuongTac','ChamSocKhach','DanhGia','UuDai','DichVuQuanTam'],['ReviewsService','PromotionsService','VouchersAdminService','SavedServicesService','NotificationsService'],['Review','Voucher','CustomerSavedService','Notification']],
 ['AC-governance','Quản trị và chuyển giao',[34,35,37,39],['KenhQuanTri','KiemSoatTrachNhiem','HoSoChuyenChu','QuyetDinhQuanTri','DauVet'],['OwnershipService','UsersService','TrustSnapshotService'],['OwnershipTransfer','TrustAction','AuditLog']],
 ['AC-identity','Tài khoản và dữ liệu',[2,3,4,32],['KenhTaiKhoan','BaoVeDanhTinh','TaiKhoan','PhienTruyCap','YeuCauDuLieu'],['AuthService','UsersService','PrivacyCenterService'],['User','UserSession','DataSubjectRequest']],
 ['AC-recurring','Lịch định kỳ',[11],['KenhLichDinhKy','SapXepChuoi','ChuoiLich','KyHen','NangLucPhucVu'],['RecurringService','BookingsService'],['RecurringBookingPlan','Booking','StaffService']],
];
const conceptMembers={
 LichHen:['maLich; thoiDiem; trangThai','ghiNhanCamKet()'],PhanDichVu:['giaTaiLucDat; trangThai','ghiNhanTienDo()'],ChuyenVien:['ten; khaNangNhanLich','xacDinhNangLuc()'],NangLucPhucVu:['cuaSoMoCua; kyNang','kiemTraKhaDung()'],KhoanThu:['soTien; trangThai','ghiNhanDaTra()'],YeuCauHoan:['soTien; lyDo; trangThai','kiemTraSoDu()'],YeuCauThayDoi:['loai; hanXuLy; trangThai','ghiNhanQuyetDinh()'],LichSuViPham:['loai; thoiDiem; hieuLuc','tinhDiemTrongCuaSo()'],HoSoDoanhNghiep:['ten; trangThai','kiemTraDieuKienNop()'],ChiNhanh:['diaDiem; trangThaiCongBo','kiemTraSanSang()'],TaiKhoan:['dinhDanh; trangThai','kiemTraTruyCap()'],DanhGia:['diem; noiDung; trangThai','ghiNhanPhanHoi()'],ChuoiLich:['tanSuat; soKy; trangThai','lapKeHoachKy()'],KyHen:['thoiDiem; trangThai','kiemTraXungDot()']};
for(const [id,title,sucs,names,design,models] of analysis){let body='left to right direction\n';names.forEach((n,i)=>{const type=i===0?'boundary':i===1?'control':'entity';const m=conceptMembers[n]||[i<2?'phamViTuongTac':'ma; trangThai',i===0?'tiepNhanYeuCau()':i===1?'kiemTraDieuKien()':'ghiNhanKetQua()'];body+=`class "${n}" as ${n} <<${type}>> {\n  ${m[0]}\n  --\n  ${m[1]}\n}\n`});body+=`${names[0]} ..> ${names[1]}\n`+names.slice(2).map(n=>`${names[1]} ..> ${n}`).join('\n');diagram(id,agroup,title,'Lớp khái niệm BCE; operation là trách nhiệm phân tích, không tuyên bố tồn tại class cùng tên trong code.',body,{sucs:sucs.map(n=>'SUC-'+String(n).padStart(2,'0')),concepts:names,design,models});}
diagram('AC-overview',agroup,'Khái niệm nghiệp vụ lõi','Các liên kết khái niệm; một lịch phải có phần dịch vụ theo luật tạo lịch, schema không tự ép tối thiểu đó.',`left to right direction
class KhachHang { maKhach\n--\ny euCauPhucVu() }
class LichHen { thoiDiem; trangThai\n--\nghiNhanCamKet() }
class PhanDichVu { giaTaiLucDat; trangThai\n--\nghiNhanTienDo() }
class DichVuCungCap { ten; thoiLuong\n--\nxacDinhGia() }
class ChuyenVien { ten; kyNang\n--\nthucHien() }
class KhoanThu { soTien; trangThai\n--\nghiNhanDaTra() }
KhachHang "1" -- "0..*" LichHen
LichHen "1" -- "1..*" PhanDichVu
DichVuCungCap "1" -- "0..*" PhanDichVu
ChuyenVien "0..1" -- "0..*" PhanDichVu
LichHen "1" -- "0..*" KhoanThu`.replace('y eu','yeu'),{sucs:['SUC-05','SUC-17','SUC-18'],concepts:['KhachHang','LichHen','PhanDichVu','DichVuCungCap','ChuyenVien','KhoanThu'],design:['BookingsService','PaymentsService'],models:['CustomerProfile','Booking','BookingService','BranchServiceOffering','StaffProfile','Payment']});

const designGroups=[
 ['DC-overview','Phối hợp nghiệp vụ',['BookingsService','PricingEngineService','PaymentsService','SchedulerGateway','PrismaService'],[5,7,18]],
 ['DC-auth','Xác thực và phiên',['AuthController','AuthService','TokenBlacklistService','PrismaService'],[2,3]],
 ['DC-access','Kiểm tra quyền lịch',['BookingsController','BookingsAccessService','PrismaService'],[8,13,14]],
 ['DC-booking','Tạo và điều phối lịch',['BookingsController','BookingsService','PrismaService'],[5,6,13,14,16]],
 ['DC-change','Yêu cầu thay đổi',['ChangeRequestsService','BookingsService','PlatformSettingsService','PrismaService'],[9,10,15]],
 ['DC-items','Tiến độ dịch vụ',['BookingItemsService','BookingsService','PrismaService'],[17]],
 ['DC-recurring','Chuỗi lịch',['RecurringController','RecurringService','BookingsService','PrismaService'],[11]],
 ['DC-payment','Thu và hoàn tiền',['PaymentsController','PaymentsService','PaymentProviderRegistry','PrismaService'],[18,19,20,21,36]],
 ['DC-providers','Hợp đồng adapter thanh toán',['PaymentProvider','CashPaymentAdapter','ManualBankTransferAdapter','PaymentProviderRegistry'],[18]],
 ['DC-business','Hồ sơ doanh nghiệp',['BusinessController','BusinessOnboardingService','PrismaService'],[22,23]],
 ['DC-branch','Chi nhánh và trạng thái',['BranchesController','BranchesService','BranchStateService','PrismaService'],[24,33]],
 ['DC-catalog','Catalog và combo',['ServicesController','ServicesService','CombosService','PrismaService'],[1,25,27,38]],
 ['DC-staff','Nhân sự và lời mời',['StaffController','StaffService','StaffInvitationsService','PrismaService'],[26]],
 ['DC-marketing','Ưu đãi và định giá',['PromotionsService','VouchersAdminService','PricingEngineService','PrismaService'],[7,28]],
 ['DC-review','Đánh giá và kiểm duyệt',['ReviewsController','ReviewsService','PrismaService'],[29,30]],
 ['DC-privacy','Quyền dữ liệu',['PrivacyController','PrivacyCenterService','SensitiveDataCipherService','PrismaService'],[32]],
 ['DC-ownership','Chuyển giao trách nhiệm',['OwnershipController','OwnershipService','SensitiveDataCipherService','PrismaService'],[34,35]],
 ['DC-impact','Tác động vận hành',['ImpactController','ImpactService','BookingsService','PrismaService'],[33]],
 ['DC-governance','Quản trị và báo cáo',['AdminController','TrustSnapshotService','ReportsService','PrismaService'],[36,39]],
 ['DC-self','Hồ sơ và dịch vụ đã lưu',['UsersService','SavedServicesService','PrismaService'],[4,12,37]],
 ['DC-communication','Thông báo và media',['NotificationsService','MediaService','PrismaService'],[31,40]],
];
const preferred={BookingsService:['create','getAvailableSlots','updateStatus'],BookingsController:['create','getAvailableSlots','updateBookingItem'],PaymentsService:['collect','requestRefund','processRefund'],PrismaService:['onModuleInit','onModuleDestroy'],ChangeRequestsService:['create','approve','reject'],BookingsAccessService:['loadAndAssert','assertWrite','assertCustomerCreate'],BranchStateService:['canonicalState','transition'],OwnershipService:['create','accept','execute'],AuthService:['login','refresh','revokeSession'],StaffService:['create','assignServices','deactivate'],ReviewsService:['create','replyToReview','moderate'],PricingEngineService:['quote','reserve']};
const shortType=t=>t.length>32||t.includes('\n')?(t.startsWith('Promise<')?'Promise<...>':'...'):t;
for(const [id,title,names,sucs] of designGroups){let body='top to bottom direction\n';const edges=[];const shown=[];
  for(const n of names){const c=cls(n);body+=`${c.kind==='interface'?'interface':'class'} ${n} {\n`;
    const ctor=c.members.find(m=>m.kind==='constructor');
    for(const p of (ctor?.parameters||[]).filter(p=>names.includes(p.type)).slice(0,4)){body+=`  ${p.modifiers.includes('private')?'-':p.modifiers.includes('protected')?'#':'+'}${p.name}: ${p.type}\n`;edges.push(`${n} ..> ${p.type} : inject`)}
    const methods=c.members.filter(m=>m.kind==='method'&&(!preferred[n]||preferred[n].includes(m.name))).filter(m=>!m.modifiers.includes('private')).slice(0,3);
    if(c.kind==='interface')for(const p of c.members.filter(m=>m.kind==='property').slice(0,3))body+=`  +${p.name}: ${shortType(p.type)}\n`;
    body+='  --\n';for(const m of methods){const params=m.parameters.map(p=>p.name+(p.optional?'?':'')+(p.type==='inferred'?'':': '+shortType(p.type))).join(', ');const display=params.length>40?'...':params;body+=`  ${m.modifiers.includes('private')?'-':m.modifiers.includes('protected')?'#':'+'}${m.name}${m.typeParameters?.length?'<'+m.typeParameters.map(t=>t.name).join(',')+'>':''}(${display})${m.type==='inferred'?'':': '+shortType(m.type)}\n`;shown.push(`${n}.${m.name}`)}body+='}\n';
    for(const h of c.heritage)for(const target of names)if(new RegExp('\\b'+target+'\\b').test(h))edges.push(`${n} ${h.startsWith('implements')?'..|>':'--|>'} ${target}`);
  }
  if(id==='DC-providers')edges.push('PaymentProviderRegistry ..> PaymentProvider : resolve');
  body+=[...new Set(edges)].join('\n');diagram(id,dgroup,title,'Tên/method/visibility lấy từ TypeScript AST. Dấu ... lược chữ ký dài; chữ ký đầy đủ trong source inventory. DI được vẽ dependency, không suy composition.',body,{sucs:sucs.map(n=>'SUC-'+String(n).padStart(2,'0')),classes:names,methods:shown});
}

const domains=[
 ['identity','Định danh và phiên','User AccountToken UserSession CustomerProfile BusinessOwnerProfile'],
 ['rbac','Vai trò và cấp quyền','Role Permission RolePermission UserRole UserPermission'],
 ['business','Doanh nghiệp và thành viên','Business SalonMember CancellationPolicy'],
 ['branch','Chi nhánh','Branch BranchOnboardingProgress BranchBookingPolicy BranchStateTransition'],
 ['opening','Địa bàn và giờ mở cửa','Province District BranchWorkingHour BranchHoliday SpecialWorkingDay'],
 ['staff','Nhân sự và kỹ năng','StaffProfile StaffInvitation StaffBranchAssignment StaffService'],
 ['catalog','Phân tầng catalog','ServiceCategory CanonicalService BusinessService BranchServiceOffering'],
 ['variants','Biến thể và phụ thuộc','ServiceVariant ServicePriceRule ServiceDependency'],
 ['combo','Combo','Combo ComboService ComboImage'],
 ['booking','Lịch và phần dịch vụ','Booking BookingService BookingContact BookingStatusHistory BookingServiceAdjustment'],
 ['policy','Yêu cầu và chính sách khách','AppointmentChangeRequest BookingViolationEvent CustomerBookingPolicy RecurringBookingPlan OverbookingOverride'],
 ['payment','Thanh toán','Payment PaymentIntent PaymentTransaction PricingSnapshot PaymentPolicySnapshot'],
 ['refund','Hoàn tiền và sổ cái','RefundRequest RefundAllocation FinancialLedgerEntry PaymentPolicy'],
 ['statement','Phí và đối soát nền tảng','PlatformFeeEntry PlatformFeeAdjustment PlatformStatement PlatformStatementLine'],
 ['package','Gói buổi dịch vụ','TreatmentPackage PackagePurchase PackageInstallment PackageSessionEntitlement'],
 ['promotion','Khuyến mãi và phạm vi','Promotion PromotionBusiness PromotionBranch PromotionService PromotionCombo'],
 ['voucher','Voucher và phạm vi','Voucher CustomerVoucher VoucherBranchScope VoucherServiceScope VoucherComboScope'],
 ['redemption','Áp dụng ưu đãi','PriceAdjustment PromotionRedemption VoucherRedemption CustomerBusinessSegment'],
 ['review','Đánh giá','Review ReviewServiceRating BusinessComment ReviewReport'],
 ['moderation','Kiểm duyệt và khiếu nại','ReviewModerationEvent ReviewAppeal'],
 ['business-docs','Hồ sơ doanh nghiệp','BusinessDocument BusinessDocumentVersion BusinessReviewEvent DocumentReviewEvent'],
 ['branch-docs','Hồ sơ chi nhánh','BranchDocument BranchDocumentVersion BranchReviewRequest BranchReviewEvent'],
 ['governance','Giám sát và tác động','SalonTrustSnapshot TrustAction OperationalImpactCase OperationalImpactItem AuditLog'],
 ['ownership','Chuyển chủ và phiên bản','OwnershipTransfer OwnershipHistory LegalEntityVersion PayoutAccountVersion'],
 ['personal','Quyền dữ liệu và dịch vụ lưu','DataSubjectRequest PrivacyExportPackage MarketingPreference CustomerSavedService'],
 ['notifications','Thông báo và cấu hình','Notification NotificationOutbox DeviceToken PlatformSetting'],
 ['media','Ảnh và media','MediaFile BusinessImage BranchImage ServiceImage StaffImage'],
 ['legacy-loyalty','DI SẢN: điểm thưởng và danh sách chờ','LoyaltyRule LoyaltyAccount LoyaltyTransaction WaitlistEntry'],
 ['legacy-invoice','DI SẢN: hóa đơn và phiếu thu','Invoice InvoiceInformationRequest InvoiceLine InvoiceEvent'],
];
const membership={};for(const [id,title,list] of domains)for(const n of list.split(' ')){if(membership[n])throw Error('Duplicate domain '+n);if(!inv.models.some(m=>m.name===n))throw Error('Unknown model '+n);membership[n]={id,title,legacy:id.startsWith('legacy-')}}
for(const m of inv.models)if(!membership[m.name])throw Error('Uncovered model '+m.name);
const relations=inv.models.flatMap(m=>m.fields.filter(f=>f.kind==='object'&&f.relationFromFields.length).map(f=>{
 const unique=f.relationFromFields.length===1&&m.fields.find(x=>x.name===f.relationFromFields[0]).isUnique||[m.primaryKey,...m.uniqueFields].some(xs=>xs.length===f.relationFromFields.length&&xs.every(x=>f.relationFromFields.includes(x)));
 const required=f.relationFromFields.every(n=>m.fields.find(x=>x.name===n).isRequired);
 return {from:m.name,to:f.type,fields:f.relationFromFields,references:f.relationToFields,required,unique,delete:f.relationOnDelete||'mặc định Prisma (không ghi trong schema)',name:f.name};
}));
function erd(id,title,names,scope){const ms=names.map(n=>inv.models.find(m=>m.name===n));let body='left to right direction\n';
 for(const m of ms){const foreign=new Set(relations.filter(r=>r.from===m.name).flatMap(r=>r.fields));const scalar=m.fields.filter(f=>f.kind!=='object');const sorted=[...scalar.filter(f=>m.primaryKey.includes(f.name)),...scalar.filter(f=>!m.primaryKey.includes(f.name)&&foreign.has(f.name)),...scalar.filter(f=>!m.primaryKey.includes(f.name)&&!foreign.has(f.name))];const shown=sorted.slice(0,7);
 body+=`entity "${m.name}\\n(${m.dbName})" as ${m.name} {\n${shown.map(f=>`  ${f.isRequired?'* ':''}${f.name}: ${f.type}${!f.isRequired?'?':''} ${[m.primaryKey.includes(f.name)?'PK':'',foreign.has(f.name)?'FK':'',f.isUnique?'UQ':''].filter(Boolean).map(t=>'<<'+t+'>>').join(' ')}`).join('\n')}\n${scalar.length>shown.length?`  ... ${scalar.length-shown.length} cot: xem tu dien\n`:''}}\n`;
 }
 const inside=relations.filter(r=>names.includes(r.from)&&names.includes(r.to));const shown=inside.slice(0,6);
 for(const r of shown)body+=`${r.to} ${r.required?'||':'|o'}--${r.unique?'o|':'o{'} ${r.from}\n`;
 diagram(id,egroup,title,scope+' PK/FK/UQ; dấu * = NOT NULL. Hình chọn tối đa 7 cột và 6 FK; từ điển/relationship-catalog chứa đầy đủ. Tên FK nằm trong bảng quan hệ dưới hình HTML.',body,{models:names,relations:shown,relationCount:shown.length,omittedInternalFK:inside.slice(6),externalFK:relations.filter(r=>names.includes(r.from)&&!names.includes(r.to)).length});
}
erd('ERD-overview','Lõi đặt lịch và tài chính',['CustomerProfile','Booking','BookingService','BranchServiceOffering','Payment'],'ERD tổng quan; cardinality là ràng buộc schema, không phải minimum của quy trình.');
for(const [id,title,list] of domains)erd('ERD-'+id,title,list.split(' '),id.startsWith('legacy-')?'Phụ lục vật lý di sản, không là chức năng đang cung cấp.':'Miền dữ liệu hiện hành hoặc hỗ trợ. Quan hệ xuyên miền xem catalogue đầy đủ.');

let specs='# Đặc tả Use Case hệ thống\n\nMức kiểm chứng: đọc code của working tree; không chạy nghiệp vụ hoặc truy vấn DB. Association trên hình chỉ là tham gia; các hành động trong cùng UC có thể có quyền khác nhau.\n';
for(const u of usecases){const publicFlow=u.actors.includes('V');const rows=u.methods.filter(r=>method(r).c.name.endsWith('Controller')).map(r=>{const {c,m}=method(r);return `- ${r}: ${[...c.decorators.filter(x=>/@(Roles|RequirePermission)/.test(x)),...m.decorators.filter(x=>/@(Get|Post|Put|Patch|Delete|Roles|RequirePermission|Public|RequireScope)/.test(x))].map(x=>'`'+x.replace(/\s+/g,' ')+'`').join('; ')}`}).join('\n');
 specs+=`\n## ${u.id} — ${u.name}\n\n- Mục tiêu: ${u.name}, đạt kết quả mô tả ở bước cuối.\n- BUC: ${u.buc.join(', ')}.\n- Actor tham gia: ${u.actors.map(a=>actors[a]+' ('+roles[a]+')').join('; ')}. Actor chính là người khởi tạo hành động tương ứng; các vai trò còn lại hỗ trợ theo từng nhánh, không được hoán đổi quyền.\n- Trigger: actor phát sinh nhu cầu ${u.name.toLowerCase()}.\n- Tiền điều kiện: ${publicFlow?'Hành động Public không cần phiên; hành động protected trong UC vẫn cần phiên tương ứng.':'Có phiên hợp lệ đúng workspace, role/permission và scope cho hành động.'} Tài nguyên tham chiếu tồn tại và thỏa trạng thái/điều kiện trong luồng và ngoại lệ.\n- Hậu điều kiện thành công: ${u.flow.at(-1)}\n- Bảo đảm khi thất bại: không diễn giải lỗi thành thành công; trạng thái cụ thể tuân theo ngoại lệ. Không khẳng định mọi tác động ngoại vi/email đã rollback; luồng chuỗi lịch có bù riêng.\n\n### Luồng chính\n\n${u.flow.map((s,i)=>`${i+1}. ${s}`).join('\n')}\n\n### Thay thế và ngoại lệ\n\n${u.alt.map(s=>'- '+s).join('\n')}\n\n### Dữ liệu, quyền và trạng thái\n\n- Dữ liệu vào/validation: ${u.input}\n- Đầu ra: tài nguyên/trạng thái hoặc danh sách được nêu trong luồng chính; không cam kết thông báo/email ngoài bằng chứng.\n- Scope: ${u.actors.map(a=>a==='V'?'PUBLIC chỉ nội dung công khai':a==='C'?'CUSTOMER theo chính chủ, tài khoản tách vận hành':a==='O'?'OWNER theo doanh nghiệp và thao tác được cấp':a==='R'?'RECEPTIONIST theo chi nhánh và hành động tại quầy':a==='S'?'STAFF theo assignment/tài khoản của mình':'PLATFORM_ADMIN chỉ hành động platform được cấp').join('; ')}.\n- Trạng thái trước/sau: xem từng bước/nhánh và bảng state trong SYSTEM-AUDIT; không có một chuyển trạng thái chung cho toàn bộ nhóm hành động.\n- Quy tắc: ${u.rules}\n\n${rows}\n\n### Bằng chứng và mức triển khai\n\n${u.methods.map(r=>'- '+evidence(r)).join('\n')}\n${u.frontend.map(p=>`- Web: [${p}](${p})`).join('\n')}\n- Schema: ${u.models.map(m=>'`'+m+'`').join(', ')}; xem từ điển dữ liệu.\n- Mức triển khai: ${u.status}.\n- Mobile: ${u.mobile}.\n- Chưa xác minh: dữ liệu triển khai thực, luồng runtime và kết quả gửi qua hệ thống ngoài; xem VALIDATION.\n`;
}
write(sgroup+'/specifications.md',specs.replaceAll('](../../../','](../../../../')); // corrected below by path-aware rebasing
// Evidence links above are root-relative; documents in a group need one extra ../.
function rebase(md){return md.replace(/\]\((\.\.\/[^)]+)\)/g,'](../$1)')}
write(sgroup+'/specifications.md',rebase(specs));
write(sgroup+'/system-use-case-specifications.md','# Đặc tả hệ thống\n\nBản hiện hành: [specifications.md](specifications.md).');
let bs='# Đặc tả Use Case nghiệp vụ\n\nRanh giới: hoạt động phối hợp của BeautyBook và cơ sở tham gia. Khách/đại diện đăng ký là business actor bên ngoài; chủ cơ sở, lễ tân, chuyên viên và điều phối nền tảng là business worker trong hoạt động. Một người có thể mang vai trò nghiệp vụ khác nhau theo ngữ cảnh, không tạo kế thừa role phần mềm. Tổng quan chọn hành trình giá trị; các hình chi tiết bao phủ toàn bộ BUC.\n';
for(const b of business){const us=usecases.filter(u=>u.buc.includes(b.id));bs+=`\n## ${b.id} — ${b.name}\n\n- Mục tiêu: ${b.goal}\n- Actor chính/đối tượng thụ hưởng: ${b.primary}.\n- Worker/bên hỗ trợ: ${b.support}.\n- Trigger: ${b.trigger}\n- Tiền điều kiện: nhu cầu hợp lệ trong phạm vi hoạt động mô tả; thông tin, cam kết hoặc hồ sơ ở bước đầu tồn tại. Điều kiện tài khoản cụ thể thuộc đặc tả SUC, không biến thành bước kinh doanh.\n- Hậu điều kiện thành công: ${b.goal}\n- Bảo đảm thất bại: không coi đề nghị đang chờ/từ chối là cam kết đã hoàn tất; giữ lịch sử theo phần triển khai có căn cứ.\n\n### Luồng chính\n\n${b.flow.map((x,i)=>`${i+1}. ${x}`).join('\n')}\n\n### Thay thế/ngoại lệ\n\n${b.alt.map(x=>'- '+x).join('\n')}\n\n### Quy tắc và trách nhiệm\n\n${b.rules}\n\n${b.support} thực hiện đúng phần việc ở từng bước; ${b.primary} cung cấp nhu cầu/căn cứ, không tự có thẩm quyền của worker. Quyết định thẩm quyền cụ thể được ràng buộc tại ${us.map(u=>u.id).join(', ')}.\n\n### Bằng chứng và giới hạn\n\n${[...new Set(us.flatMap(u=>u.methods).slice(0,7))].map(r=>'- '+evidence(r)).join('\n')}\n\nÁnh xạ SUC: ${us.map(u=>u.id).join(', ')}. Đây là mô hình phân tích từ code, chưa được phỏng vấn xác nhận với đơn vị vận hành. Các giới hạn triển khai trong SUC liên quan vẫn áp dụng, đặc biệt chuyển chủ/quyền dữ liệu/gói buổi.\n`}
write(bgroup+'/specifications.md',rebase(bs));write(bgroup+'/business-use-case-specifications.md','# Đặc tả nghiệp vụ\n\nBản hiện hành: [specifications.md](specifications.md).');
let matrix='# Actor × chức năng × quyền\n\nO=BUSINESS_OWNER; R=RECEPTIONIST; S=STAFF; A=PLATFORM_ADMIN; C=CUSTOMER; V=chưa đăng nhập. Dấu tham gia không là quyền CRUD toàn phần.\n\n| UC | V | C | O | R | S | A | Trạng thái |\n|---|---|---|---|---|---|---|---|\n';for(const u of usecases)matrix+=`| ${u.id} ${u.name} | ${['V','C','O','R','S','A'].map(a=>u.actors.includes(a)?'Có nhánh':'—').join(' | ')} | ${u.status} |\n`;matrix+='\nQuyền từng endpoint và scope nghiệp vụ được ghi trong specifications.md. Không suy STAFF đọc mọi lịch từ permission :branch; BookingsAccessService còn kiểm tra assignment.\n';write(sgroup+'/actor-permission-matrix.md',matrix);
write('00-scope-and-traceability/actor-use-case-matrix.md','# Ma trận actor\n\nBản hiện hành: [actor-permission-matrix.md](../02-system-use-cases/actor-permission-matrix.md).');

let dictionary='# Từ điển dữ liệu toàn bộ schema\n\nNguồn: `prisma/schema.prisma`, SHA-256 `'+inv.schemaSha256+'`. Đọc '+inv.models.length+' model, '+inv.enums.length+' enum; không truy vấn PostgreSQL. Dòng schema chứa kiểu, nullable, default, native SQL annotation và ràng buộc. Prisma `String` không mặc nhiên là UUID SQL dù default uuid(). Liên hệ object không là cột.\n';
let coverage='# Coverage model\n\nTất cả model hiện tại đều có miền, hình và từ điển; hình rút gọn cột/FK có công bố. Hạ tầng và di sản không bắt buộc có UC trực tiếp.\n\n| Model | Bảng | Miền/hình | Phân loại | UC liên quan trực tiếp |\n|---|---|---|---|---|\n';
for(const m of inv.models){const d=membership[m.name],foreign=new Set(relations.filter(r=>r.from===m.name).flatMap(r=>r.fields));const us=usecases.filter(u=>u.models.includes(m.name)).map(u=>u.id);coverage+=`| ${m.name} | ${m.dbName} | [ERD-${d.id}](ERD-${d.id}.puml) | ${d.legacy?'Di sản':us.length?'Nghiệp vụ':'Hỗ trợ miền / hạ tầng'} | ${us.join(', ')||'Không ánh xạ trực tiếp; hỗ trợ miền '+d.title} |\n`;
 dictionary+=`\n## ${m.name}\n\nBảng: \`${m.dbName}\`; schema dòng ${m.line}; miền ${d.title}. ${d.legacy?'Chỉ mô tả dữ liệu lịch sử; không có Use Case đang hoạt động.':''}\n\n| Trường | Loại | Null | Ràng buộc/annotation nguồn |\n|---|---|---|---|\n${m.fields.map(f=>`| ${f.name} | ${f.type}${f.isList?'[]':''} (${f.kind}) | ${f.isRequired?'Không':'Có'} | \`${f.raw.replaceAll('|','\\|')}\` ${foreign.has(f.name)?'**FK vật lý**':f.kind!=='object'&&/Id$/.test(f.name)?'(Không suy FK từ hậu tố Id)':''} |`).join('\n')}\n\nKhóa chính: ${m.primaryKey.join(' + ')}. Unique đơn: ${m.fields.filter(f=>f.isUnique).map(f=>f.name).join(', ')||'không'}.\n\n${m.constraints.map(c=>'- `'+c+'`').join('\n')}\n`;
}
dictionary+='\n# Enum trong schema\n'+inv.enums.map(e=>`\n## ${e.name}\n\n${e.values.join(', ')}\n`).join('');
write(egroup+'/data-dictionary.md',dictionary);write(egroup+'/model-coverage.md',coverage);write(egroup+'/model-inventory.md','# Kiểm kê model\n\nXem [model-coverage.md](model-coverage.md) và [data-dictionary.md](data-dictionary.md).');
write(egroup+'/relationship-catalog.md','# Catalogue FK đầy đủ\n\nMỗi dòng là relation có fields/references trong Prisma. Ký pháp: mỗi bản ghi nguồn trỏ tới bao nhiêu bản ghi đích; mỗi bản ghi đích có bao nhiêu bản ghi nguồn. Collection không ép tối thiểu 1. Unique có điều kiện trong SQL xem sql-constraints.md.\n\n| Nguồn.FK | Đích | Nguồn → đích | Đích → nguồn | onDelete khai báo |\n|---|---|---|---|---|\n'+relations.map(r=>`| ${r.from}.${r.fields.join('+')} | ${r.to}.${r.references.join('+')} | ${r.required?'1':'0..1'} | ${r.unique?'0..1':'0..*'} | ${r.delete} |`).join('\n'));
let sql='# Ràng buộc SQL ngoài mô hình Prisma\n\nĐây là lịch sử DDL trong repository, không phải catalog DB đang chạy. Một migration sau có thể thay thế đối tượng ở migration trước. Các trích đoạn giữ thứ tự thư mục; cần đối chiếu trạng thái triển khai trước khi khẳng định hiệu lực.\n\nĐáng chú ý: partial unique một vi phạm hợp lệ/booking; unique customer–business policy; kiểm tra nguồn/scope vi phạm; trigger tách tài khoản; slot advisory lock không chặn + kiểm tra overlap. Không gọi các ràng buộc sau là đã áp dụng trên DB.\n';
for(const dir of fs.readdirSync(path.join(api,'prisma/migrations')).sort()){const p=path.join(api,'prisma/migrations',dir,'migration.sql');if(!fs.existsSync(p))continue;const lines=read(p).split(/\r?\n/);const hits=lines.map((l,i)=>({l,i})).filter(x=>/CREATE UNIQUE INDEX|EXCLUDE|CHECK\s*\(|CREATE (?:OR REPLACE )?FUNCTION|CREATE TRIGGER|DROP TRIGGER|DROP INDEX/.test(x.l));if(hits.length)sql+=`\n## ${dir}\n\n[Migration](${url(p,path.join(out,egroup))})\n\n`+hits.map(x=>`- Dòng ${x.i+1}: \`${x.l.trim().replaceAll('`','')}\``).join('\n')+'\n';}
write(egroup+'/sql-constraints.md',sql);

let trace='# Ma trận truy vết xuyên suốt\n\nNhiều–nhiều. Không bắt buộc bảng hỗ trợ/di sản có UC trực tiếp; model-coverage giải thích toàn bộ.\n\n| BUC | SUC | Lớp phân tích / hình | Lớp thiết kế / hình | Model/bảng | Source evidence |\n|---|---|---|---|---|---|\n';
for(const u of usecases){const aa=manifest.filter(d=>d.group===agroup&&d.sucs?.includes(u.id));const dd=manifest.filter(d=>d.group===dgroup&&d.sucs?.includes(u.id));trace+=`| ${u.buc.join(', ')} | ${u.id} ${u.name} | ${aa.map(d=>`[${d.id}](${d.source}): ${d.concepts.join(', ')}`).join('; ')} | ${dd.map(d=>`[${d.id}](${d.source}): ${d.classes.join(', ')}`).join('; ')} | ${u.models.map(n=>n+' / '+inv.models.find(m=>m.name===n).dbName).join('; ')} | ${u.methods.slice(0,3).map(evidence).join('; ')} |\n`;}
write('TRACEABILITY.md',trace);write('00-scope-and-traceability/traceability-matrix.md','# Truy vết\n\nBản hiện hành: [TRACEABILITY.md](../TRACEABILITY.md).');
write(agroup+'/analysis-class-notes.md','# Lớp phân tích và ánh xạ thiết kế\n\nCác lớp BCE là khái niệm/trách nhiệm phân tích. Dependency nét đứt biểu diễn sử dụng; không suy composition từ dữ liệu. Lớp entity có trạng thái và hành vi khái niệm, không phải bản sao bảng.\n\n'+analysis.map(([id,title,sucs,names,design,models])=>`## ${id} — ${title}\n\n- SUC: ${sucs.map(n=>'SUC-'+String(n).padStart(2,'0')).join(', ')}.\n- Boundary: ${names[0]} tiếp nhận/trả thông tin qua web/mobile đã có.\n- Control: ${names[1]} điều phối điều kiện và quyết định.\n- Entity: ${names.slice(2).join(', ')} giữ ý nghĩa nghiệp vụ.\n- Thiết kế: ${design.map(n=>`[${n}](${url(path.join(api,cls(n).file),path.join(out,agroup))})`).join(', ')}.\n- Mô hình dữ liệu: ${models.join(', ')}.\n`).join('\n'));
write(dgroup+'/design-class-notes.md','# Quy ước lớp thiết kế\n\nTrích TypeScript AST từ working tree. Tên lớp, constructor dependencies, visibility, tham số và kiểu explicit được lưu đầy đủ tại source-inventory.json. Hình chỉ chọn tối đa ba operation public mỗi lớp. Dấu ... là lược chữ ký dài, không phải kiểu được định nghĩa trong code. Kiểu tham số/return bị lược nếu code để TypeScript suy luận; generic giữ tên type parameter, ràng buộc đầy đủ trong inventory; không tự bịa kiểu trả về. Dependency DI không hàm ý quản lý vòng đời. PrismaService kế thừa PrismaClient của thư viện; hình chỉ giữ lớp dự án và liên kết thư viện được nêu tại đây. BookingService là model Prisma; BookingsService là lớp ứng dụng. React pages là function/component, chỉ được truy vết ở đặc tả, không giả làm class.\n\n'+designGroups.map(([id,title,names])=>`## ${id} — ${title}\n\n${names.map(n=>`- [${n}](${url(path.join(api,cls(n).file),path.join(out,dgroup))}), dòng ${cls(n).line}; ${cls(n).heritage.join('; ')||'không khai báo kế thừa/realization'}.`).join('\n')}\n`).join('\n'));
write('manifest.json',JSON.stringify({schemaSha256:inv.schemaSha256,models:inv.models.length,enums:inv.enums.length,actors,roles,bucs:business.map(x=>({id:x.id,name:x.name})),sucs:usecases.map(x=>({id:x.id,name:x.name,status:x.status})),diagrams:manifest},null,2));
write('00-scope-and-traceability/source-evidence.md','# Phương pháp nguồn\n\nNguồn hiện hành: SYSTEM-AUDIT, TRACEABILITY và source-inventory.json. Inventory được tạo chỉ bằng đọc schema/AST, không chạy ứng dụng hoặc truy vấn DB.\n\n'+inv.files.map(f=>`- [${f.path}](${url(path.join(api,f.path),path.join(out,'00-scope-and-traceability'))}) — SHA-256 ${f.sha256}`).join('\n'));
console.log(JSON.stringify({diagrams:manifest.length,bucs:business.length,sucs:usecases.length,models:inv.models.length,relations:relations.length,missingUi:usecases.filter(u=>!u.frontend.length).map(u=>u.id)}));
