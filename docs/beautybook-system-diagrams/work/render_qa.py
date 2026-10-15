from pathlib import Path
from pdf2image import convert_from_path
from pypdf import PdfReader
import json, sys
sys.stdout.reconfigure(encoding='utf-8')

root=Path(__file__).parent
pdf=root/'BeautyBook_QA.pdf'
render=root/'render'
render.mkdir(exist_ok=True)
for old in render.glob('page-*.png'):old.unlink()
pages=convert_from_path(str(pdf),dpi=110,fmt='png',output_folder=str(root/'render'),thread_count=4,
    poppler_path='C:/Users/Admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/poppler/Library/bin',paths_only=True)
for index,source in enumerate(sorted(pages,key=lambda p:int(Path(p).stem.split('-')[-1]))):
    Path(source).replace(root/'render'/f'page-{index+1}.png')
reader=PdfReader(pdf)
summary=[]
for i,page in enumerate(reader.pages):
    text=page.extract_text() or ''
    lines=[s.strip() for s in text.splitlines() if s.strip()]
    summary.append({'page':i+1,'words':len(text.split()),'start':' | '.join(lines[2:5]),'end':' | '.join(lines[-4:]),'images':len(page.images)})
    if any(t in text for t in ['Error!','Reference source not found','No table of figures entries found']):print('FIELD ERROR',i+1)
(root/'page_summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
for p in summary:print(p)
