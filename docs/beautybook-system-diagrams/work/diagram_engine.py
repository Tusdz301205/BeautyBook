from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
from xml.etree.ElementTree import Element, SubElement, ElementTree
import math, html, re

ROOT = Path(__file__).parent
OUT = ROOT / 'figures'
OUT.mkdir(exist_ok=True)
SCALE = 3

def font(size, bold=False):
    return ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf' if bold else 'C:/Windows/Fonts/arial.ttf', round(size*SCALE))

class Diagram:
    def __init__(self, name, width=960, height=1000):
        self.name, self.w, self.h = name, width, height
        self.nodes, self.edges, self.notes = [], [], []
        self.boundary = None
    def actor(self, id, label, x, y):
        self.nodes.append(dict(id=id, kind='actor', label=label, x=x, y=y, w=110, h=140))
    def uc(self, id, label, x, y, w=300, h=95):
        label=re.sub(r'^(?:NV|HT)\d+[a-z]?\n','',label)
        self.nodes.append(dict(id=id, kind='ellipse', label=label, x=x, y=y, w=w, h=h))
    def entity(self,id,label,cx,cy,w=240,h=76):
        self.nodes.append(dict(id=id,kind='entity',label=label,x=cx-w/2,y=cy-h/2,w=w,h=h))
    def diamond(self,id,label,cx,cy,w=180,h=110):
        self.nodes.append(dict(id=id,kind='diamond',label=label,x=cx-w/2,y=cy-h/2,w=w,h=h))
    def box(self, id, title, attrs, x, y, w=370, methods=None, stereotype=None, size=20):
        title_lines = ([stereotype] if stereotype else []) + title.split('\n')
        hh = 20 + len(title_lines)*27
        bodyh = max(35, len(attrs)*27+16)
        mh = (len(methods)*27+16) if methods else 0
        self.nodes.append(dict(id=id, kind='box', title=title, attrs=attrs, methods=methods or [], stereotype=stereotype,
                               x=x,y=y,w=w,h=hh+bodyh+mh,hh=hh,bodyh=bodyh,size=size))
    def edge(self, points, start='', end='', label='', dashed=False, arrow=False, label_pos=None, start_pos=None, end_pos=None):
        self.edges.append(dict(points=points,start=start,end=end,label=label,dashed=dashed,arrow=arrow,
                               label_pos=label_pos,start_pos=start_pos,end_pos=end_pos))
    def note(self, text, x, y, size=19, bold=False):
        self.notes.append((text,x,y,size,bold))
    def save(self):
        im=Image.new('RGB',(self.w*SCALE,self.h*SCALE),'white'); d=ImageDraw.Draw(im)
        def line(points, width=2, dashed=False):
            pts=[(round(x*SCALE),round(y*SCALE)) for x,y in points]
            if not dashed: d.line(pts, fill='black', width=round(width*SCALE), joint='curve'); return
            for (x1,y1),(x2,y2) in zip(pts,pts[1:]):
                length=math.hypot(x2-x1,y2-y1)
                for k in range(0,math.ceil(length),round(12*SCALE)):
                    a=k/length; b=min(k+7*SCALE,length)/length
                    d.line([(x1+(x2-x1)*a,y1+(y2-y1)*a),(x1+(x2-x1)*b,y1+(y2-y1)*b)],fill='black',width=round(width*SCALE))
        def text(text,x,y,size=21,bold=False,align='center',white=False):
            f=font(size,bold); lines=text.split('\n'); step=size*1.25*SCALE
            widths=[d.textlength(s,font=f) for s in lines]
            if white:
                left=x*SCALE-(max(widths)/2 if align=='center' else 0)
                d.rectangle([left-4*SCALE,y*SCALE-2*SCALE,left+max(widths)+4*SCALE,y*SCALE+len(lines)*step],fill='white')
            for i,s in enumerate(lines):
                xx=x*SCALE-(widths[i]/2 if align=='center' else 0)
                d.text((xx,y*SCALE+i*step),s,font=f,fill='black',stroke_width=0)
        if self.boundary:
            x,y,w,h,label=self.boundary
            d.rectangle([x*SCALE,y*SCALE,(x+w)*SCALE,(y+h)*SCALE],outline='black',width=2*SCALE)
            text(label,x+w/2,y+14,22,True)
        for e in self.edges:
            line(e['points'],1.6,e['dashed'])
            if e['arrow']:
                (a,b),(x,y)=e['points'][-2:]; ang=math.atan2(y-b,x-a); length=14
                line([(x-length*math.cos(ang-.45),y-length*math.sin(ang-.45)),(x,y),(x-length*math.cos(ang+.45),y-length*math.sin(ang+.45))],1.6)
        for n in self.nodes:
            x,y,w,h=n['x'],n['y'],n['w'],n['h']
            if n['kind']=='actor':
                cx=x+w/2
                d.ellipse([(cx-15)*SCALE,y*SCALE,(cx+15)*SCALE,(y+30)*SCALE],outline='black',width=2*SCALE,fill='white')
                line([(cx,y+30),(cx,y+83)]);line([(cx-31,y+52),(cx+31,y+52)])
                line([(cx,y+83),(cx-28,y+112)]);line([(cx,y+83),(cx+28,y+112)])
                text(n['label'],cx,y+120,21)
            elif n['kind']=='ellipse':
                d.ellipse([x*SCALE,y*SCALE,(x+w)*SCALE,(y+h)*SCALE],outline='black',fill='white',width=2*SCALE)
                count=len(n['label'].split('\n'));text(n['label'],x+w/2,y+(h-count*26)/2,21)
            elif n['kind'] in ['entity','diamond']:
                if n['kind']=='diamond':
                    points=[((x+w/2)*SCALE,y*SCALE),((x+w)*SCALE,(y+h/2)*SCALE),((x+w/2)*SCALE,(y+h)*SCALE),(x*SCALE,(y+h/2)*SCALE)]
                    d.polygon(points,fill='white',outline='black',width=2*SCALE)
                else:d.rectangle([x*SCALE,y*SCALE,(x+w)*SCALE,(y+h)*SCALE],outline='black',fill='white',width=2*SCALE)
                count=len(n['label'].split('\n'));size=19 if n['kind']=='diamond' and count>1 else 21
                text(n['label'],x+w/2,y+(h-count*size*1.25)/2,size,n['kind']=='entity')
            else:
                d.rectangle([x*SCALE,y*SCALE,(x+w)*SCALE,(y+h)*SCALE],outline='black',fill='white',width=2*SCALE)
                title=([n['stereotype']] if n['stereotype'] else [])+n['title'].split('\n')
                text('\n'.join(title),x+w/2,y+9,n['size'],True)
                line([(x,y+n['hh']),(x+w,y+n['hh'])])
                text('\n'.join(n['attrs']),x+12,y+n['hh']+7,n['size'],align='left')
                if n['methods']:
                    yy=y+n['hh']+n['bodyh'];line([(x,yy),(x+w,yy)])
                    text('\n'.join(n['methods']),x+12,yy+7,n['size'],align='left')
        for e in self.edges:
            if e['label']:
                pos=e['label_pos'] or e['points'][len(e['points'])//2]
                text(e['label'],*pos,18,white=True)
            for side,offset in [('start',14),('end',-34)]:
                if e[side]:
                    point=e[f'{side}_pos'] or (e['points'][0] if side=='start' else e['points'][-1])
                    if not e[f'{side}_pos']: point=(point[0]+offset,point[1]+6)
                    text(e[side],*point,18,white=True)
        for note in self.notes:text(*note)
        im.save(OUT/f'{self.name}.png',dpi=(300,300))
        return self

def export_drawio(diagrams):
    root=Element('mxfile',host='app.diagrams.net',type='device')
    for diagram in diagrams:
        page=SubElement(root,'diagram',id=diagram.name,name=diagram.name)
        model=SubElement(page,'mxGraphModel',dx='960',dy=str(diagram.h),grid='1',gridSize='10',page='1',pageWidth=str(diagram.w),pageHeight=str(diagram.h))
        r=SubElement(model,'root');SubElement(r,'mxCell',id='0');SubElement(r,'mxCell',id='1',parent='0')
        def vertex(id,label,x,y,w,h,style):
            c=SubElement(r,'mxCell',id=id,value=label,style=style+';fontFamily=Arial;fontSize=21;fontColor=#000000;strokeColor=#000000;fillColor=#ffffff;whiteSpace=wrap;html=1;',vertex='1',parent='1')
            SubElement(c,'mxGeometry',x=str(x),y=str(y),width=str(w),height=str(h),**{'as':'geometry'})
        if diagram.boundary:
            x,y,w,h,label=diagram.boundary
            vertex('boundary',label,x,y,w,h,'rounded=0;verticalAlign=top;spacingTop=10')
        for i,e in enumerate(diagram.edges):
            c=SubElement(r,'mxCell',id=f'edge{i}',value=e['label'],style=f"edgeStyle=none;rounded=0;endArrow={'open' if e['arrow'] else 'none'};dashed={int(e['dashed'])};html=1;fontFamily=Arial;fontSize=18;strokeColor=#000000;",edge='1',parent='1')
            g=SubElement(c,'mxGeometry',relative='1',**{'as':'geometry'})
            for pts,typ in [(e['points'][0],'sourcePoint'),(e['points'][-1],'targetPoint')]:SubElement(g,'mxPoint',x=str(pts[0]),y=str(pts[1]),**{'as':typ})
            if len(e['points'])>2:
                arr=SubElement(g,'Array',**{'as':'points'})
                for xx,yy in e['points'][1:-1]:SubElement(arr,'mxPoint',x=str(xx),y=str(yy))
        for n in diagram.nodes:
            if n['kind']=='box':
                label='<b>'+html.escape(n['title']).replace('\n','<br>')+'</b><hr>'+ '<br>'.join(html.escape(s) for s in n['attrs'])
                if n['methods']:label+='<hr>'+'<br>'.join(html.escape(s) for s in n['methods'])
                style='rounded=0;align=left;spacing=10'
            else:
                label=html.escape(n['label']).replace('\n','<br>')
                style={'actor':'shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top','ellipse':'ellipse','entity':'rounded=0;fontStyle=1','diamond':'rhombus'}[n['kind']]
            vertex(n['id'],label,n['x'],n['y'],n['w'],n['h'],style)
    ElementTree(root).write(ROOT/'BeautyBook_so_do.drawio',encoding='utf-8',xml_declaration=True)
