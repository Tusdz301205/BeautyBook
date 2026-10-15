from diagram_engine import Diagram, export_drawio, ROOT
from pathlib import Path
import re, json

diagrams=[]
def save(d):diagrams.append(d.save());return d
def at(d,id):return next(n for n in d.nodes if n['id']==id)
def rel(d,a,b,ca='1',cb='0..*',side='vertical',lane=None,a_offset=0,b_offset=0):
    a,b=at(d,a),at(d,b)
    if side=='horizontal':
        y=a['y']+min(a['h'],b['h'])/2
        pts=[(a['x']+a['w'],y),(b['x'],y)]
        d.edge(pts,start=ca,end=cb,start_pos=(pts[0][0]+23,pts[0][1]-27),end_pos=(pts[-1][0]-25,pts[-1][1]-27));return
    if lane is not None:
        pts=[(a['x'],a['y']+a['h']/2),(lane,a['y']+a['h']/2),(lane,b['y']+b['h']/2),(b['x'],b['y']+b['h']/2)]
        d.edge(pts,start=ca,end=cb,start_pos=(pts[0][0]-27,pts[0][1]-26),end_pos=(pts[-1][0]-27,pts[-1][1]-26));return
    pts=[(a['x']+a['w']/2+a_offset,a['y']+a['h']),(b['x']+b['w']/2+b_offset,b['y'])]
    if pts[0][0]!=pts[-1][0]:
        middle=(pts[0][1]+pts[-1][1])/2;pts=[pts[0],(pts[0][0],middle),(pts[-1][0],middle),pts[-1]]
    d.edge(pts,start=ca,end=cb,start_pos=(pts[0][0]+28,pts[0][1]+6),end_pos=(pts[-1][0]+28,pts[-1][1]-28))

# Business goals are kept above screen/API operations.
d=Diagram('01_usecase_nghiep_vu',960,1060);d.boundary=(180,25,600,1000,'NGHIỆP VỤ BEAUTYBOOK')
d.actor('customer','Khách\nhàng',25,310);d.actor('salon','Cơ sở\nlàm đẹp',805,310);d.actor('admin','Quản trị\nnền tảng',805,805)
business=[('NV01','Tìm nơi làm đẹp\nphù hợp'),('NV02','Đăng ký và điều phối\nlịch phục vụ'),('NV03','Tiếp nhận khách\ntại cơ sở'),('NV04','Chăm sóc và tiếp nhận\nphản hồi'),('NV05','Duy trì thông tin\nkinh doanh'),('NV06','Giám sát hoạt động\nnền tảng')]
for i,(id,label) in enumerate(business):d.uc(id,id+'\n'+label,300,95+i*150,360,112)
for i in range(4):d.edge([(110,362),(300,151+i*150)])
for i in [1,2,3,4,5]:d.edge([(836,362),(660,151+i*150)])
for i in [3,4,5]:d.edge([(836,857),(660,151+i*150)])
save(d)

def usecase_group(name,title,rows,actor='Khách hàng',secondary=None):
    h=130+len(rows)*116
    d=Diagram(name,960,h);d.boundary=(185,20,590,h-45,title)
    center=60+(len(rows)-1)*58
    d.actor('actor',actor,20,center)
    if secondary:d.actor('secondary',secondary[0],810,center)
    for i,(id,label) in enumerate(rows):
        y=80+i*116;d.uc(id,id+'\n'+label,300,y,370,91);d.edge([(106,center+52),(300,y+45)])
        if secondary and id in secondary[1]:d.edge([(841,center+52),(670,y+45)])
    return save(d)

usecase_group('02_usecase_khach_hang','BEAUTYBOOK ỨNG DỤNG KHÁCH HÀNG',[
 ('HT01','Đăng ký và đăng nhập'),('HT02','Tra cứu cơ sở và dịch vụ'),('HT03','Đặt lịch hẹn'),('HT04','Đặt lịch định kỳ'),
 ('HT05','Hủy và đề nghị đổi lịch'),('HT06','Xem lịch sử và thống kê'),('HT07','Gửi đánh giá'),('HT12','Trao đổi và nhận thông báo')],actor='Khách\nhàng')
d=usecase_group('03_usecase_co_so','BEAUTYBOOK QUẢN LÝ CƠ SỞ',[
 ('HT08','Quản lý hồ sơ cơ sở'),('HT09','Quản lý dịch vụ và ưu đãi'),('HT10','Quản lý nhân viên'),('HT11','Tiếp nhận và xử lý lịch hẹn'),('HT12','Trao đổi và nhận thông báo'),('HT13','Xem báo cáo cơ sở'),('HT18','Xem lịch được phân công')],actor='Chủ\ncơ sở',secondary=('Lễ tân',['HT11','HT12']))
d.edges.pop();d.actor('staff','Chuyên\nviên',810,754);d.edge([(841,806),(670,821)]);d.save()
usecase_group('04_usecase_admin','BEAUTYBOOK QUẢN TRỊ HỆ THỐNG',[
 ('HT14','Duyệt và quản lý cơ sở'),('HT15','Quản lý tài khoản và vai trò'),('HT16','Quản lý danh mục và nội dung'),('HT17','Thống kê và tra cứu toàn hệ thống')],actor='Quản trị\nhệ thống')

# One focused UML decomposition keeps <<include>> unambiguous.
d=Diagram('05_usecase_dat_lich',960,790);d.boundary=(175,20,745,740,'BEAUTYBOOK ĐẶT LỊCH HẸN')
d.actor('customer','Khách\nhàng',20,310)
d.uc('book','HT03\nĐặt lịch hẹn',235,340,260,105)
d.uc('slot','HT03a\nKiểm tra giờ trống',600,115,270,100)
d.uc('price','HT03b\nTính giá và ưu đãi',600,340,270,100)
d.uc('save','HT03c\nGhi nhận lịch hẹn',600,565,270,100)
d.edge([(106,362),(235,392)])
d.edge([(440,350),(535,165),(600,165)],dashed=True,arrow=True,label='«include»',label_pos=(515,230))
d.edge([(495,392),(600,392)],dashed=True,arrow=True,label='«include»',label_pos=(547,360))
d.edge([(440,435),(535,615),(600,615)],dashed=True,arrow=True,label='«include»',label_pos=(515,530));save(d)

# Analysis classes, Vietnamese domain concepts only.
d=Diagram('06_lop_phan_tich_danh_muc',960,1000)
d.box('owner','Chủ cơ sở',['Họ tên','Thông tin liên hệ'],80,25,340)
d.box('business','Doanh nghiệp',['Tên doanh nghiệp','Trạng thái hồ sơ'],540,25,340)
d.box('branch','Chi nhánh',['Địa chỉ','Giờ hoạt động'],540,335,340)
d.box('catalog','Dịch vụ doanh nghiệp',['Tên dịch vụ','Nhóm dịch vụ'],80,335,340)
d.box('offering','Dịch vụ tại chi nhánh',['Giá và thời lượng','Trạng thái nhận lịch'],80,665,340)
d.box('staff','Nhân viên',['Họ tên và chuyên môn','Khả năng nhận lịch'],540,665,340)
rel(d,'owner','business',side='horizontal');rel(d,'business','branch');rel(d,'business','catalog',a_offset=-100);rel(d,'catalog','offering');rel(d,'branch','staff')
rel(d,'offering','staff','0..*','0..*',side='horizontal')
d.edge([(540,390),(500,390),(500,615),(350,615),(350,665)],start='1',end='0..*',start_pos=(515,365),end_pos=(380,636))
d.note('Nhân viên được gán các dịch vụ đủ năng lực thực hiện.',480,900,21)
d.note('Một dịch vụ doanh nghiệp có thể cung cấp tại nhiều chi nhánh.',480,935,21);save(d)
d=Diagram('07_lop_phan_tich_lich_hen',960,1080)
d.box('customer','Khách hàng',['Họ tên','Thông tin liên hệ'],65,25,350)
d.box('plan','Kế hoạch định kỳ',['Tần suất và số kỳ','Trạng thái kế hoạch'],545,25,350)
d.box('booking','Lịch hẹn',['Ngày giờ và trạng thái','Giá trị lịch hẹn'],65,340,350)
d.box('item','Dịch vụ trong lịch',['Tên dịch vụ tại lúc đặt','Giá và thời lượng lúc đặt'],545,340,350)
d.box('review','Đánh giá',['Điểm chung và nhận xét','Trạng thái công bố'],65,680,350)
d.box('staff','Nhân viên',['Họ tên','Chuyên môn'],545,680,350)
rel(d,'customer','booking');rel(d,'plan','booking','0..1','0..*',b_offset=100);rel(d,'booking','item','1','1..*',side='horizontal')
rel(d,'booking','review','1','0..1');rel(d,'item','staff','0..*','0..1')
d.note('Mỗi dòng dịch vụ thuộc một dịch vụ đang cung cấp tại chi nhánh.',480,925,20)
d.note('Một lịch có thể dùng combo hoặc voucher khi đáp ứng điều kiện.',480,961,20)
d.note('Đánh giá chi tiết gắn với từng dòng dịch vụ và người thực hiện.',480,997,20);save(d)

def design_rows(name,rows):
    d=Diagram(name,960,1130)
    for i,(controller,cmethods,service,smethods) in enumerate(rows):
        y=20+i*245
        d.box('c'+str(i),controller,[],35,y,395,cmethods,'«Controller»',19)
        d.box('s'+str(i),service,[],535,y,390,smethods,'«Service»',19)
        d.edge([(430,y+100),(535,y+100)],dashed=True,arrow=True)
    d.note('Controller tiếp nhận yêu cầu và gọi lớp xử lý nghiệp vụ tương ứng.',480,1035,20)
    d.note('Các Service truy vấn dữ liệu qua PrismaService.',480,1070,20)
    return save(d)
design_rows('08_lop_thiet_ke_danh_muc',[
 ('BusinessController',['+ createDraft(body, user)','+ submit(id, user)'],'BusinessOnboarding\nService',['+ createDraft(user, input)','+ submit(id, user)']),
 ('BranchesController',['+ create(...)','+ publish(...)'],'BranchesService',['+ create(data)','+ publish(id, actorId)']),
 ('ServicesController',['+ createCatalog(body, user)','+ setBranchAvailability(...)'],'ServicesService',['+ createCatalog(data)','+ setBranchAvailability(...)']),
 ('StaffController',['+ assignBranch(...)','+ assignServices(...)'],'StaffService',['+ assignBranch(id, input)','+ assignServices(id, ids)'])])
d=Diagram('09_lop_thiet_ke_dat_lich',960,1120)
nodes=[('rc','RecurringController',35,20,['+ preview(body, user)','+ create(body, user)'],'«Controller»'),('rs','RecurringService',535,20,['+ preview(input, user)','+ create(input, user)'],'«Service»'),
 ('bc','BookingsController',35,290,['+ create(body, user)','+ checkin(id, user)'],'«Controller»'),('bs','BookingsService',535,290,['+ create(data)','+ checkin(id, actorId, roles)'],'«Service»'),
 ('vc','ReviewsController',35,560,['+ create(...)','+ findByService(serviceId)'],'«Controller»'),('vs','ReviewsService',535,560,['+ create(data, actor)','+ findByService(serviceId)'],'«Service»'),
 ('price','PricingEngineService',35,830,['+ quote(input)','+ reserve(...)'],'«Service»'),('db','PrismaService',535,830,['+ onModuleInit()','+ onModuleDestroy()'],'«Data access»')]
for id,title,x,y,methods,st in nodes:d.box(id,title,[],x,y,390,methods,st,19)
for a,b in [('rc','rs'),('bc','bs'),('vc','vs')]:
    aa,bb=at(d,a),at(d,b);d.edge([(aa['x']+390,aa['y']+100),(bb['x'],bb['y']+100)],dashed=True,arrow=True)
d.edge([(730,at(d,'rs')['h']+20),(730,290)],dashed=True,arrow=True)
d.edge([(925,390),(947,390),(947,925),(925,925)],dashed=True,arrow=True)
d.edge([(730,560+at(d,'vs')['h']),(730,830)],dashed=True,arrow=True)
d.edge([(535,420),(480,420),(480,930),(425,930)],dashed=True,arrow=True)
d.note('PrismaService kế thừa PrismaClient; chỉ thể hiện các lớp và lệnh chính.',480,1070,19);save(d)

# Physical model: PK/FK and selected business fields, six readable sheets.
schema=(ROOT.parents[2]/'beauty-booking-api-main'/'prisma'/'schema.prisma').read_text(encoding='utf-8')
models={m.group(1):m.group(2) for m in re.finditer(r'model (\w+) \{([\s\S]*?)\n\}',schema)}
physical={name:re.search(r'@@map\("([^"]+)"\)',body).group(1) for name,body in models.items() if re.search(r'@@map\("([^"]+)"\)',body)}
def dbdiagram(name,entries,relations,height=1120):
    d=Diagram(name,960,height)
    for id,title,attrs,col,row in entries:
        d.box(id,title,attrs,65+col*480,30+row*350,350,size=19)
    bottom_uses={};top_uses={}
    for a,b,ca,cb in relations:
        aa,bb=at(d,a),at(d,b)
        if aa['y']==bb['y']:
            rel(d,a,b,ca,cb,'horizontal')
        else:
            rel(d,a,b,ca,cb,a_offset=bottom_uses.get(a,0)*100,b_offset=top_uses.get(b,0)*100)
            bottom_uses[a]=bottom_uses.get(a,0)+1;top_uses[b]=top_uses.get(b,0)+1
    d.note('PK: khóa chính    FK: khóa ngoại    UQ: duy nhất    ?: có thể để trống',480,height-45,18)
    return save(d)

dbdiagram('10_du_lieu_tai_khoan',[
 ('user','users',['PK id','UQ email','UQ phone?'],0,0),('customer','customer_profiles',['PK id','FK UQ userId'],1,0),
 ('role','roles',['PK id','UQ code','name'],0,1),('ur','user_roles',['PK id','FK userId, roleId','FK businessId?, branchId?'],1,1),
 ('owner','business_owner_profiles',['PK id','FK UQ userId','UQ taxCode?'],0,2),('business','businesses',['PK id','FK ownerId','UQ slug'],1,2)
 ],[('user','customer','1','0..1'),('role','ur','1','0..*'),('owner','business','1','0..*'),('user','ur','1','0..*')])
dbdiagram('11_du_lieu_danh_muc',[
 ('branch','branches',['PK id','FK businessId','name, status'],0,0),('category','service_categories',['PK id','FK businessId','FK parentId?'],1,0),
 ('offering','services',['PK id','FK branchId','FK businessServiceId','FK categoryId','price, bookable'],0,1),('catalog','business_services',['PK id','FK businessId, categoryId','FK canonicalServiceId?','name, status'],1,1),
 ('variant','service_variants',['PK id','FK serviceId','priceType, price?','durationMinutes?'],0,2),('canonical','canonical_services',['PK id','UQ code, slug','FK parentId?','FK replacementCanonicalId?'],1,2)
 ],[('branch','offering','1','0..*'),('offering','catalog','0..*','1'),('category','catalog','1','0..*'),('offering','variant','1','0..*'),('catalog','canonical','0..*','0..1')])
dbdiagram('12_du_lieu_nhan_su',[
 ('branch','branches',['PK id','FK businessId'],0,0),('hour','branch_working_hours',['PK id','FK branchId','dayOfWeek, openTime','closeTime, isClosed'],1,0),
 ('staff','staff_profiles',['PK id','FK branchId','FK UQ userId?','isBookable, publicVisible'],0,1),('assignment','staff_branch_assignments',['PK id','FK staffId, branchId','startDate, endDate?'],1,1),
 ('ss','staff_services',['PK FK staffId','PK FK serviceId'],0,2),('service','services',['PK id','FK branchId','FK businessServiceId'],1,2)
 ],[('branch','hour','1','0..*'),('branch','staff','1','0..*'),('staff','assignment','1','0..*'),('staff','ss','1','0..*'),('ss','service','0..*','1')])
dbdiagram('13_du_lieu_lich_hen',[
 ('plan','recurring_booking_plans',['PK id','FK customerId, branchId','FK comboId?, staffId?','serviceIds JSON','frequency, occurrenceCount'],0,0),('contact','booking_contacts',['PK id','FK UQ bookingId','fullName, phone'],1,0),
 ('booking','bookings',['PK id, UQ bookingCode','FK customerId, branchId','FK recurringPlanId?','FK voucherId?','appointmentDate, status'],0,1),('item','booking_services',['PK id','FK bookingId, serviceId','FK businessServiceId','FK staffId?, comboId?','FK canonicalServiceId?','variantId? (logic)'],1,1),
 ('history','booking_status_histories',['PK id','FK bookingId','FK changedBy?','status, note?'],0,2),('payment','payments',['PK id','FK bookingId','amount, status'],1,2)
 ],[('plan','booking','0..1','0..*'),('booking','item','1','0..*'),('booking','history','1','0..*')])
dbdiagram('14_du_lieu_combo_khuyen_mai',[
 ('combo','combos',['PK id','FK businessId, branchId','name, comboPrice'],0,0),('cs','combo_services',['PK FK comboId','PK FK serviceId','quantity, sortOrder'],1,0),
 ('promotion','promotions',['PK id','FK businessId?','discountType, discountValue','startDate, endDate'],0,1),('ps','promotion_services',['PK FK promotionId','PK FK serviceId'],1,1),
 ('pb','promotion_branches',['PK FK promotionId','PK FK branchId'],0,2),('pc','promotion_combos',['PK FK promotionId','PK FK comboId'],1,2)
 ],[('combo','cs','1','0..*'),('promotion','ps','1','0..*'),('promotion','pb','1','0..*'),('promotion','pc','1','0..*')])
dbdiagram('15_du_lieu_voucher',[
 ('voucher','vouchers',['PK id, UQ code','FK businessId?','discountType, discountValue'],0,0),('cv','customer_vouchers',['PK id','FK customerId, voucherId','UQ usedBookingId? (logic)'],1,0),
 ('vr','voucher_redemptions',['PK id','FK voucherId, bookingId','FK customerId, branchId','FK customerVoucherId?'],0,1),('booking','bookings',['PK id','FK customerId, branchId','FK voucherId?'],1,1),
 ('pbu','promotion_businesses',['PK FK promotionId','PK FK businessId'],0,2),('snapshot','pricing_snapshots',['PK id','FK UQ bookingId','FK businessId, branchId','items JSON'],1,2)
 ],[('voucher','cv','1','0..*'),('voucher','vr','1','0..*'),('vr','booking','0..*','1'),('booking','snapshot','1','0..1')])
dbdiagram('16_du_lieu_danh_gia_thong_bao',[
 ('booking','bookings',['PK id','FK customerId, branchId'],0,0),('review','reviews',['PK id','FK UQ bookingId','FK customerId','overallRating, status'],1,0),
 ('item','booking_services',['PK id','FK bookingId, serviceId','FK staffId?'],0,1),('rating','review_service_ratings',['PK id','FK reviewId','FK UQ bookingServiceId','FK staffId?','rating, comment?'],1,1),
 ('user','users',['PK id','UQ email'],0,2),('notification','notifications',['PK id','FK userId','FK relatedBookingId?','title, isRead'],1,2)
 ],[('booking','review','1','0..1'),('booking','item','1','0..*'),('review','rating','1','0..*'),('item','rating','1','0..1'),('user','notification','1','0..*')])

# Add cross-row relationships with dedicated gutters instead of crossing boxes.
d=next(d for d in diagrams if d.name=='13_du_lieu_lich_hen')
d.edge([(415,430),(475,430),(475,110),(545,110)],start='1',end='0..1',start_pos=(438,402),end_pos=(510,82))
d.edge([(415,520),(495,520),(495,810),(545,810)],start='1',end='0..*',start_pos=(440,493),end_pos=(520,780));d.save()
d=next(d for d in diagrams if d.name=='10_du_lieu_tai_khoan')
rel(d,'user','owner','1','0..1',lane=25);d.save()
for d in diagrams:
    if int(d.name[:2])<10:continue
    for n in d.nodes:
        body=next((models[key] for key,val in physical.items() if val==n['title']),None)
        if body is None:raise ValueError('Unknown physical table '+n['title'])
        fields=set(re.findall(r'^\s+(\w+)\s+',body,re.M))
        for line in n['attrs']:
            for word in re.findall(r'\b[a-z][a-zA-Z0-9]*\b',line):
                if word not in fields and word!='logic':raise ValueError(n['title']+' unknown field '+word)
from build_erd import make_erd
diagrams.extend(make_erd())
export_drawio(diagrams)
(Path(__file__).parent/'diagram_manifest.json').write_text(json.dumps([{'name':d.name,'width':d.w,'height':d.h} for d in diagrams],ensure_ascii=False,indent=2),encoding='utf-8')
print('Generated',len(diagrams),'diagrams')
