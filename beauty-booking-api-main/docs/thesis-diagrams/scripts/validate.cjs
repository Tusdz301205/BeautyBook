const fs=require('fs'),path=require('path'),crypto=require('crypto'),cp=require('child_process');
const root=path.resolve(__dirname,'..'),repo=path.resolve(root,'../../..'),api=path.resolve(root,'../..');
const load=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const m=load('manifest.json'),inv=load('00-scope-and-traceability/source-inventory.json'),r=load('rendered/render-report.json');
// The documentation links to this command's own output, including a first run
// after cleaning rendered artifacts. Replace the marker with results below.
const reportPath=path.join(root,'rendered/validation-report.json');
if(!fs.existsSync(reportPath))fs.writeFileSync(reportPath,JSON.stringify({status:'validation in progress'}));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const failures=[],checks=[];const assert=(ok,msg)=>{if(!ok)failures.push(msg)};
assert(hash(path.join(api,'prisma/schema.prisma'))===inv.schemaSha256,'Schema changed since inventory');
for(const f of inv.files)assert(hash(path.join(api,f.path))===f.sha256,'Source changed: '+f.path);
assert(r.syntaxExitCode===0&&r.renderExitCode===0,'PlantUML syntax/render failed');
assert(r.diagrams.length===m.diagrams.length,'Render count mismatch');
for(const d of m.diagrams){
 const rr=r.diagrams.find(x=>x.id===d.id);assert(!!rr,'Missing report '+d.id);if(!rr)continue;
 for(const ext of ['html','svg','png'])assert(fs.existsSync(path.join(root,'rendered',d.id+'.'+ext)),'Missing '+d.id+'.'+ext);
 assert(hash(path.join(root,d.source))===rr.sourceSha256,'Stale render '+d.id);
 const svg=fs.readFileSync(path.join(root,'rendered',d.id+'.svg'),'utf8').match(/<svg\b[\s\S]*?<\/svg>/)[0];
 const html=fs.readFileSync(path.join(root,'rendered',d.id+'.html'),'utf8');assert(html.includes(svg),'HTML/SVG mismatch '+d.id);
 assert(crypto.createHash('sha256').update(svg).digest('hex')===rr.svgSha256,'SVG hash mismatch '+d.id);
 const png=fs.readFileSync(path.join(root,'rendered',d.id+'.png'));assert(png.subarray(1,4).toString()==='PNG','Invalid PNG '+d.id);
 assert(Math.abs(png.readUInt32BE(16)-rr.width*3)<=3&&Math.abs(png.readUInt32BE(20)-rr.height*3)<=3,'PNG dimensions '+d.id);
 assert(rr.outside.length===0,'Text outside SVG '+d.id);assert(rr.printMinPt>=8.5,'Below A4 legibility target '+d.id);
 assert(rr.fonts.every(f=>f.includes('Times New Roman')),'Wrong diagram font '+d.id);
 assert(!/<(?:linearGradient|radialGradient|filter|animate)\b/.test(svg),'Decorative effect '+d.id);
 const src=fs.readFileSync(path.join(root,d.source),'utf8');
 if(/^(BUC|SUC)-/.test(d.id)){
  const ids=[...src.matchAll(/^(?:actor|usecase) "[^"]+" as (\w+)/gm)].map(x=>x[1]);
  const svgIds=[...svg.matchAll(/data-uml-id="([^"]+)"/g)].map(x=>x[1]);
  assert(JSON.stringify(ids.sort())===JSON.stringify(svgIds.sort()),'Use case nodes mismatch '+d.id);
  const normalize=(a,b)=>[a,b].sort().join(' ');
  const edges=src.split(/\r?\n/).filter(l=>/^\w+\s+(?:--|-right-)\s+\w+$/.test(l)).map(l=>{const t=l.split(/\s+/);return normalize(t[0],t[2])}).sort();
  const svgEdges=[...svg.matchAll(/data-association="(\w+) (\w+)"/g)].map(x=>normalize(x[1],x[2])).sort();
  assert(edges.length>0&&JSON.stringify(edges)===JSON.stringify(svgEdges),'Use case edges mismatch '+d.id);
  assert([...svg.matchAll(/<ellipse\b[^>]*>/g)].every(x=>x[0].includes('fill="#fffde7"')&&x[0].includes('stroke="#773b4a"')),'Use case reference palette '+d.id);
  if(d.id.startsWith('SUC'))assert(svg.includes('Hệ thống BeautyBook'),'Wrong system boundary '+d.id);
 } else {
  assert(svg.includes('font-weight="bold"'),'Missing bold class/entity header '+d.id);
 }
 for(const name of d.classes||[])assert(inv.classes.some(c=>c.name===name),'Unknown class '+name);
 for(const name of d.models||[])assert(inv.models.some(c=>c.name===name),'Unknown model '+name);
 for(const method of d.methods||[]){const [cn,mn]=method.split('.');assert(inv.classes.find(c=>c.name===cn)?.members.some(x=>x.name===mn),'Unknown operation '+method)}
}
for(const model of inv.models)assert(m.diagrams.some(d=>d.group==='05-data-model'&&d.models.includes(model.name)),'No ERD coverage '+model.name);
for(const u of m.sucs){for(const group of ['02-system-use-cases','03-analysis-classes','04-design-classes'])assert(m.diagrams.some(d=>d.group===group&&d.sucs?.includes(u.id)),'No '+group+' coverage '+u.id)}
for(const b of m.bucs)assert(m.diagrams.some(d=>d.bucs?.includes(b.id)),'No BUC coverage '+b.id);
const files=[];function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(['archive','renderer','scripts'].includes(e.name))continue;const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(/\.(md|html)$/.test(p))files.push(p)}}walk(root);
let links=0;for(const p of files){const s=fs.readFileSync(p,'utf8');const refs=p.endsWith('.md')?[...s.matchAll(/\]\(([^)]+)\)/g)].map(x=>x[1]):[...s.matchAll(/(?:href|src)="([^"]+)"/g)].map(x=>x[1]);for(let ref of refs){if(/^(https?:|data:|mailto:|#)/.test(ref))continue;ref=decodeURIComponent(ref.split('#')[0]);if(!ref)continue;links++;assert(fs.existsSync(path.resolve(path.dirname(p),ref)),'Broken link '+path.relative(root,p)+' → '+ref)}}
checks.push({name:'Sources, rendered bytes, PNG dimensions, A4, UML nodes/edges, model/method coverage, local links',links,documents:files.length,failures:failures.length});
const python=process.env.BEAUTYBOOK_PYTHON||path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe');
const htmls=m.diagrams.map(d=>path.join(root,'rendered',d.id+'.html'));
for(const script of ['skills/diagram-design/skills/diagram-design/scripts/self_check.py','skills/diagram-design/scripts/verify-geometry.py']){
 const result=cp.spawnSync(python,[path.join(repo,script),...htmls],{encoding:'utf8',windowsHide:true,env:{...process.env,PYTHONIOENCODING:'utf-8'}});
 const name=path.basename(script,'.py');fs.writeFileSync(path.join(root,'rendered',name+'.log'),(result.stdout||'')+(result.stderr||'')+(result.error?.message||''));checks.push({name,exitCode:result.status});assert(result.status===0,'Skill check failed: '+name);
}
const report={date:new Date().toISOString(),sources:m.diagrams.length,html:m.diagrams.length,svg:m.diagrams.length,png:m.diagrams.length,models:inv.models.length,enums:inv.enums.length,sourceFiles:inv.files.length,bucs:m.bucs.length,sucs:m.sucs.length,checks,failures};
fs.writeFileSync(path.join(root,'rendered/validation-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(failures.length)process.exitCode=1;
