"""Source-checked physical overview, with obstacle-aware orthogonal routing."""
from pathlib import Path
import re, json, heapq, math, hashlib
from collections import defaultdict
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).parent
SCHEMA = ROOT.parents[2] / 'beauty-booking-api-main/prisma/schema.prisma'
SCALE = 3
W, H, STEP = 2500, 1470, 3
NAME = '19_database_diagram_tong_quat'
SOURCE = SCHEMA.read_text(encoding='utf-8')
MODELS = dict(re.findall(r'model\s+(\w+)\s*\{(.*?)\n\}', SOURCE, re.S))

# Fixed reading order: identity and organization above; appointments in the
# center; service catalogue to the right; results and supporting links below.
LAYOUT = [
 ('Role', 0, 0, []), ('UserRole', 1, 0, ['userId','roleId']),
 ('User', 2, 0, []), ('BusinessOwnerProfile', 3, 0, ['userId']),
 ('Business', 4, 0, ['ownerId']), ('ServiceCategory', 5, 0, ['businessId']),
 ('Notification', 0, 1, ['userId','relatedBookingId']),
 ('CustomerProfile', 1, 1, ['userId']), ('BookingContact', 2, 1, ['bookingId']),
 ('Branch', 3, 1, ['businessId']),
 ('BusinessService', 4, 1, ['businessId','categoryId','canonicalServiceId']),
 ('CanonicalService', 5, 1, []),
 ('CustomerVoucher', 0, 2, ['customerId','voucherId']),
 ('Voucher', 1, 2, ['businessId']),
 ('Booking', 2, 2, ['customerId','branchId','recurringPlanId','voucherId']),
 ('StaffProfile', 3, 2, ['branchId','userId']),
 ('BranchServiceOffering', 4, 2, ['branchId','businessServiceId','categoryId']),
 ('ServiceVariant', 5, 2, ['serviceId']),
 ('VoucherRedemption', 0, 3, ['bookingId','voucherId','customerVoucherId']),
 ('Payment', 1, 3, ['bookingId']),
 ('RecurringBookingPlan', 2, 3, ['customerId','branchId','staffId','comboId']),
 ('BookingService', 3, 3, ['bookingId','serviceId','staffId','comboId']),
 ('StaffService', 4, 3, ['staffId','serviceId']),
 ('PromotionService', 5, 3, ['promotionId','serviceId']),
 ('PricingSnapshot', 0, 4, ['bookingId']),
 ('Review', 1, 4, ['bookingId','customerId']),
 ('ReviewServiceRating', 2, 4, ['reviewId','bookingServiceId','staffId']),
 ('Combo', 3, 4, ['businessId','branchId']),
 ('ComboService', 4, 4, ['comboId','serviceId']),
 ('Promotion', 5, 4, ['businessId']),
 ('BookingStatusHistory', 0, 5, ['bookingId']),
 ('AppointmentChangeRequest', 1, 5, ['bookingId','proposedStaffId']),
 ('StaffBranchAssignment', 2, 5, ['staffId','branchId']),
 ('PromotionBusiness', 3, 5, ['promotionId','businessId']),
 ('PromotionBranch', 4, 5, ['promotionId','branchId']),
 ('PromotionCombo', 5, 5, ['promotionId','comboId']),
]

def font(size=21, bold=False):
    return ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf' if bold else 'C:/Windows/Fonts/arial.ttf', size*SCALE)

nodes = {}
edges = []
for model, col, row, displayed_fks in LAYOUT:
    body = MODELS[model]
    physical = re.search(r'@@map\("([^"]+)"\)', body).group(1)
    fields = {m.group(1):(m.group(2),m.group(3)) for m in re.finditer(r'^[ \t]+(\w+)[ \t]+(\w+\??)[ \t]*([^\n]*)',body,re.M)}
    composite = re.search(r'@@id\(\[([^]]+)\]',body)
    pks = [x.strip() for x in composite.group(1).split(',')] if composite else [k for k,v in fields.items() if re.search(r'(?<!@)@id\b',v[1])]
    relations = {}
    for line in body.splitlines():
        m = re.search(r'^\s*\w+\s+(\w+)\??\s+@relation\(.*fields:\s*\[([^]]+)\],\s*references:\s*\[([^]]+)\]',line)
        if m:
            fk, ref = m.group(2).strip(),m.group(3).strip()
            relations[fk] = (m.group(1),ref)
    keys = pks + [f for f in displayed_fks if f not in pks]
    attrs = []
    for key in keys:
        assert key in fields, (model,key)
        marks = []
        if key in pks: marks.append('PK')
        if key in displayed_fks:
            assert key in relations, (model,key,'not a declared FK')
            marks.append('FK')
            target, reference = relations[key]
            edges.append(dict(source=model, field=key, target=target, reference=reference))
        if '@unique' in fields[key][1]: marks.append('UQ')
        attrs.append(' '.join(marks)+'  '+key+('?' if fields[key][0].endswith('?') else ''))
    x, y = 54+col*414, 36+row*234
    nodes[model] = dict(name=physical,model=model,x=x,y=y,w=324,h=54+24*len(keys)+10,keys=keys,attrs=attrs)

for e in edges:
    assert e['target'] in nodes
    assert e['reference'] in nodes[e['target']]['keys']

# Grid routing forbids entering any table. Shared destination stubs are okay;
# unrelated routes avoid shared segments and use small bridges at crossings.
gw, gh = W//STEP, (H-70)//STEP
blocked = set()
for n in nodes.values():
    for gx in range(math.floor((n['x']-9)/STEP),math.ceil((n['x']+n['w']+9)/STEP)+1):
        for gy in range(math.floor((n['y']-9)/STEP),math.ceil((n['y']+n['h']+9)/STEP)+1):
            blocked.add((gx,gy))
occupied = defaultdict(set)
used_segments = defaultdict(set)

def port(n,key,side):
    y = n['y']+66+24*n['keys'].index(key)
    x = n['x'] if side=='L' else n['x']+n['w']
    outer = x-18 if side=='L' else x+18
    return (x,y),(round(outer/STEP),round(y/STEP))

def route(start,goal,edge_id,target_key):
    queue=[(0,0,start[0],start[1],-1)]
    costs={(start[0],start[1],-1):0};prev={}
    finish=None
    while queue:
        _,cost,x,y,direction=heapq.heappop(queue)
        state=(x,y,direction)
        if cost!=costs.get(state): continue
        if (x,y)==goal: finish=state;break
        for nd,(dx,dy) in enumerate(((1,0),(-1,0),(0,1),(0,-1))):
            nx,ny=x+dx,y+dy
            if not (2<=nx<gw-2 and 2<=ny<gh-2): continue
            if (nx,ny) in blocked and (nx,ny) not in (start,goal):continue
            segment=tuple(sorted(((x,y),(nx,ny))))
            same = used_segments[segment]
            # Parallel runs are expensive. Crossing a previous edge is possible
            # only in open gutters and will receive a visible bridge.
            if same and target_key not in same:continue
            penalty=0
            crossing=9 if occupied[(nx,ny)] and target_key not in occupied[(nx,ny)] else 0
            nc=cost+1+(5 if direction!=-1 and nd!=direction else 0)+penalty+crossing
            ns=(nx,ny,nd)
            if nc<costs.get(ns,float('inf')):
                costs[ns]=nc;prev[ns]=state
                h=abs(nx-goal[0])+abs(ny-goal[1])
                heapq.heappush(queue,(nc+h,nc,nx,ny,nd))
    if finish is None:return None
    path=[];cur=finish
    while True:
        path.append(cur[:2])
        if cur not in prev:break
        cur=prev[cur]
    path.reverse()
    for a,b in zip(path,path[1:]):
        used_segments[tuple(sorted((a,b)))].add(target_key)
    for p in path:occupied[p].add(target_key)
    return [(x*STEP,y*STEP) for x,y in path]

def length(e):
    a,b=nodes[e['source']],nodes[e['target']]
    return abs(a['x']-b['x'])+abs(a['y']-b['y'])

routes=[]
for e in sorted(edges,key=length):
    a,b=nodes[e['source']],nodes[e['target']]
    if a['x']<b['x']:sa,sb='R','L'
    elif a['x']>b['x']:sa,sb='L','R'
    else:sa=sb='L' if a['x']<W/2 else 'R'
    opposite={'L':'R','R':'L'}
    path=None
    for left,right in [(sa,sb),(sa,opposite[sb]),(opposite[sa],sb),(opposite[sa],opposite[sb])]:
        pa,ga=port(a,e['field'],left);pb,gb=port(b,e['reference'],right)
        path=route(ga,gb,e,(e['target'],e['reference']))
        if path is not None:break
    if path is None:raise RuntimeError(('No path',e))
    pts=[pa]+path+[pb]
    # Remove collinear grid points.
    compact=[pts[0]]
    for i in range(1,len(pts)-1):
        p,q,r=compact[-1],pts[i],pts[i+1]
        if (p[0]==q[0]==r[0]) or (p[1]==q[1]==r[1]):continue
        compact.append(q)
    compact.append(pts[-1])
    routes.append(dict(**e,points=compact))

im=Image.new('RGB',(W*SCALE,H*SCALE),'white');d=ImageDraw.Draw(im)
def line(pts,fill='#5d6670',width=1.5):
    d.line([(round(x*SCALE),round(y*SCALE)) for x,y in pts],fill=fill,width=round(width*SCALE),joint='curve')
def txt(value,x,y,size=21,bold=False,center=False,fill='#111111'):
    f=font(size,bold)
    if center:x-=d.textlength(value,font=f)/SCALE/2
    d.text((round(x*SCALE),round(y*SCALE)),value,font=f,fill=fill)

drawn=[];crossings=0
for e in routes:
    points=e['points'];line(points)
    # White-backed small arc on vertical segments distinguishes a crossing from
    # a junction. Incoming paths to the same PK can share their final trunk.
    for a,b in zip(points,points[1:]):
        vertical=a[0]==b[0]
        horizontal=a[1]==b[1]
        if not vertical and not horizontal:raise AssertionError('Non-orthogonal edge')
        for c,f,old in drawn:
            if old['target']==e['target'] and old['reference']==e['reference']:continue
            if vertical:
                if c[1]!=f[1]:continue
                x=a[0];lo,hi=sorted((a[1],b[1]));lx,hx=sorted((c[0],f[0]));y=c[1]
            else:
                if c[0]!=f[0]:continue
                y=a[1];lx,hx=sorted((a[0],b[0]));lo,hi=sorted((c[1],f[1]));x=c[0]
            if lx+8<x<hx-8 and lo+8<y<hi-8:
                d.rectangle(((x-3)*SCALE,(y-6)*SCALE,(x+3)*SCALE,(y+6)*SCALE),fill='white')
                if horizontal:
                    d.rectangle(((x-6)*SCALE,(y-3)*SCALE,(x+6)*SCALE,(y+3)*SCALE),fill='white')
                d.arc(((x-6)*SCALE,(y-6)*SCALE,(x+6)*SCALE,(y+6)*SCALE),270 if vertical else 180,90 if vertical else 360,fill='#5d6670',width=4)
                crossings+=1
    # Arrow terminates at the referenced PK row. No arbitrary relationship IDs.
    a,b=points[-2:];dx=b[0]-a[0];dy=b[1]-a[1];norm=math.hypot(dx,dy);ux,uy=dx/norm,dy/norm
    line([(b[0]-10*ux+4*uy,b[1]-10*uy-4*ux),b,(b[0]-10*ux-4*uy,b[1]-10*uy+4*ux)],width=1.7)
    for a,b in zip(points,points[1:]):drawn.append((a,b,e))

for key,n in nodes.items():
    x,y,w,h=n['x'],n['y'],n['w'],n['h']
    d.rectangle((x*SCALE,y*SCALE,(x+w)*SCALE,(y+h)*SCALE),fill='white',outline='#303840',width=5)
    d.rectangle((x*SCALE,y*SCALE,(x+w)*SCALE,(y+52)*SCALE),fill='#E1E6EB' if key in ('Booking','BookingService') else '#F0F1F2',outline='#303840',width=5)
    title=n['name'];f=font(21,True)
    if d.textlength(title,font=f)/SCALE>w-16:
        parts=title.split('_');mid=min(range(1,len(parts)),key=lambda i:abs(len('_'.join(parts[:i]))-len('_'.join(parts[i:]))))
        txt('_'.join(parts[:mid])+'_',x+w/2,y+2,20,True,True)
        txt('_'.join(parts[mid:]),x+w/2,y+26,20,True,True)
    else:txt(title,x+w/2,y+13,21,True,True)
    for idx,attr in enumerate(n['attrs']):txt(attr,x+12,y+55+idx*24,21)

# Legend stays within the image so it travels with the diagram.
line([(54,H-64),(W-54,H-64)],'#b2b6ba',1)
txt('PK: khóa chính     FK: khóa ngoại     UQ: duy nhất     ?: có thể để trống',54,H-54,20)
txt('Mũi tên: FK → khóa được tham chiếu. Đường có cầu vượt chỉ giao nhau, không tạo liên kết.',54,H-27,20)
# Right-align the legend.
legend=f'{len(nodes)} bảng cốt lõi  |  {len(edges)} quan hệ chính'
d.rectangle(((W-650)*SCALE,(H-58)*SCALE,W*SCALE,(H-30)*SCALE),fill='white')
txt(legend,W-54-d.textlength(legend,font=font(20))/SCALE,H-54,20)
out=ROOT/'figures'/f'{NAME}.png';im.save(out,dpi=(300,300))

# Record exactly which true foreign keys were drawn; omissions are deliberate
# in an overview and are explained in the report rather than silently invented.
manifest=dict(name=NAME,tables=len(nodes),relationships=len(edges),width=W,height=H,
    source_sha256=hashlib.sha256(SOURCE.encode()).hexdigest(),nodes=nodes,edges=routes,crossing_bridges=crossings)
(ROOT/'database_overview_manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
im.thumbnail((2000,1176));im.save(ROOT/'overview_preview.png')
print(json.dumps({'tables':len(nodes),'relations':len(edges),'bridges':crossings,'file':str(out)}))
