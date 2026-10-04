// Local PlantUML -> inline HTML -> standalone SVG and browser PNG.
const fs=require('fs'),path=require('path'),cp=require('child_process'),crypto=require('crypto');
const {pathToFileURL}=require('url');
const root=path.resolve(__dirname,'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
const runtime=process.env.BEAUTYBOOK_NODE_MODULES||path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
let playwright;try{playwright=require('playwright')}catch{playwright=require(path.join(runtime,'playwright'))}
const jar=process.env.PLANTUML_JAR||path.join(process.env.USERPROFILE,'.vscode/extensions/jebbs.plantuml-2.18.1/plantuml.jar');
if(!fs.existsSync(jar))throw Error('Set PLANTUML_JAR to local plantuml.jar');
const check=cp.spawnSync('java',['-Dfile.encoding=UTF-8','-jar',jar,'-charset','UTF-8','-checkonly',path.join(root,'*/*.puml')],{encoding:'utf8',windowsHide:true});
if(check.status!==0)throw Error(check.stderr||check.stdout||'PlantUML syntax failed');
const render=cp.spawnSync('java',['-Dfile.encoding=UTF-8','-jar',jar,'-charset','UTF-8','-tsvg','-o','../rendered',path.join(root,'*/*.puml')],{encoding:'utf8',windowsHide:true});
if(render.status!==0)throw Error(render.stderr||render.stdout||'PlantUML render failed');
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const css=`body{margin:0;padding:24px;background:#fff;color:#111;font:16px 'Times New Roman',serif}main{max-width:1400px;margin:auto}h1{font:700 26px 'Times New Roman'}p{line-height:1.5}svg{display:block;max-width:100%;height:auto;margin:24px auto}a{color:#244e70}nav{display:flex;gap:18px;flex-wrap:wrap}.caption{border-top:1px solid #bbb;padding-top:16px;color:#444}@media print{body{padding:0}nav{display:none}svg{max-height:175mm;max-width:277mm}h1{font-size:13pt}p{font-size:9pt}}@page{size:A4 landscape;margin:10mm}`;
const report=[];
(async()=>{
 const browser=await playwright.chromium.launch({headless:true,channel:'msedge'});
 const page=await browser.newPage({viewport:{width:1600,height:1200},deviceScaleFactor:3});
 for(const d of manifest.diagrams){
  const file=path.join(root,'rendered',d.id+'.svg');let svg=fs.readFileSync(file,'utf8').replace(/<\?xml[^>]*\?>/g,'');
  let semanticPresentation=null;
  if(/^(BUC|SUC)-/.test(d.id)){const p=require('./present-usecases.cjs')(fs.readFileSync(path.join(root,d.source),'utf8'));svg=p.svg;semanticPresentation=p.check;}
  if(/Syntax Error|Syntax error|An error has occurred/i.test(svg))throw Error('Error SVG '+d.id);
  const width=Number(svg.match(/<svg[^>]*\bwidth="([\d.]+)(?:px)?"/)?.[1]);
  const height=Number(svg.match(/<svg[^>]*\bheight="([\d.]+)(?:px)?"/)?.[1]);
  if(!width||!height)throw Error('Missing dimensions '+d.id);
  const landscapeScale=Math.min(277*72/25.4/width,165*72/25.4/height);
  const portraitScale=Math.min(190*72/25.4/width,250*72/25.4/height);
  const orientation=portraitScale>landscapeScale?'portrait':'landscape';
  const relationTable=d.relations?.length?'<h2>Quan hệ được vẽ</h2><table><thead><tr><th>FK nguồn</th><th>Đích</th><th>Nguồn → đích</th><th>Đích → nguồn</th></tr></thead><tbody>'+d.relations.map(r=>`<tr><td>${escape(r.from+'.'+r.fields.join('+'))}</td><td>${escape(r.to+'.'+r.references.join('+'))}</td><td>${r.required?'1':'0..1'}</td><td>${r.unique?'0..1':'0..*'}</td></tr>`).join('')+'</tbody></table>':'';
  svg=svg.replace(/<svg\b([^>]*)>/,(_,attrs)=>`<svg${attrs} role="img" aria-labelledby="${d.id}-title ${d.id}-desc"><title id="${d.id}-title">${escape(d.id+' — '+d.title)}</title><desc id="${d.id}-desc">${escape(d.scope)}</desc>`);
  const html=`<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(d.id+' — '+d.title)}</title><style>${css}table{border-collapse:collapse;font-size:14px}td,th{border:1px solid #ccc;padding:8px;text-align:left}@media print{svg{max-width:${orientation==='portrait'?190:277}mm;max-height:${orientation==='portrait'?250:165}mm}table{break-before:page}}@page{size:A4 ${orientation};margin:10mm}</style></head><body><main><nav><a href="../index.html">Mục lục</a><a href="../${d.source}">PlantUML</a><a href="${d.id}.svg">SVG</a><a href="${d.id}.png">PNG</a></nav><h1>${escape(d.id+' — '+d.title)}</h1>${svg}<p class="caption">${escape(d.scope)}</p>${relationTable}</main></body></html>`;
  const hp=path.join(root,'rendered',d.id+'.html');fs.writeFileSync(hp,html);
  // SVG export is extracted from the exact HTML supplied to the browser.
  const extracted=html.match(/<svg\b[\s\S]*?<\/svg>/)[0];fs.writeFileSync(file,'<?xml version="1.0" encoding="UTF-8"?>\n'+extracted);
  await page.goto(pathToFileURL(hp).href);await page.evaluate(()=>document.fonts.ready);
  await page.locator('svg').evaluate((el)=>{el.style.maxWidth='none';el.style.width=el.getAttribute('width');el.style.height=el.getAttribute('height')});
  const geometry=await page.locator('svg').evaluate(el=>{
    const vb=el.viewBox.baseVal;const texts=[...el.querySelectorAll('text')];const outside=[];
    for(const t of texts){const b=t.getBBox();if(b.x<vb.x-1||b.y<vb.y-1||b.x+b.width>vb.x+vb.width+1||b.y+b.height>vb.y+vb.height+1)outside.push(t.textContent)}
    return {textCount:texts.length,outside,fonts:[...new Set(texts.map(t=>getComputedStyle(t).fontFamily))]};
  });
  await page.locator('svg').screenshot({path:path.join(root,'rendered',d.id+'.png'),omitBackground:true});
  const printScale=Math.max(landscapeScale,portraitScale);
  const sizes=[...svg.matchAll(/font-size="([\d.]+)"/g)].map(x=>Number(x[1]));
  report.push({id:d.id,width,height,orientation,semanticPresentation,sourceSha256:hash(fs.readFileSync(path.join(root,d.source))),svgSha256:hash(extracted),htmlSvgMatches:true,printMinPt:+(Math.min(...sizes)*printScale).toFixed(2),...geometry});
  if(report.length%10===0)console.log('Rendered '+report.length+'/'+manifest.diagrams.length);
 }
 await browser.close();
 fs.writeFileSync(path.join(root,'rendered/render-report.json'),JSON.stringify({tool:'PlantUML 1.2024.3 + local Graphviz; Edge/Playwright PNG x3',syntaxExitCode:check.status,renderExitCode:render.status,diagrams:report},null,2));
 console.log(JSON.stringify({rendered:report.length,outside:report.filter(r=>r.outside.length).map(r=>r.id),smallPrint:report.filter(r=>r.printMinPt<8.5).map(r=>({id:r.id,pt:r.printMinPt,w:r.width,h:r.height}))}));
})().catch(e=>{console.error(e);process.exit(1)});
