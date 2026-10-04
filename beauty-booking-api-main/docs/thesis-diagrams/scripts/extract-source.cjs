// Read-only source inventory. Never connects to a database.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ts = require('typescript');
const root = path.resolve(__dirname, '../../..');
const out = path.resolve(__dirname, '..');
const rel = p => path.relative(root, p).replaceAll('\\', '/');
const hash = s => crypto.createHash('sha256').update(s).digest('hex');
const schema = fs.readFileSync(path.join(root, 'prisma/schema.prisma'), 'utf8');
const blocks = [...schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)];
const enums = [...schema.matchAll(/^enum (\w+) \{([\s\S]*?)^\}/gm)].map(m=>({name:m[1],values:m[2].split(/\r?\n/).map(l=>l.trim()).filter(l=>/^\w/.test(l))}));
const array = (s,key) => (s.match(new RegExp(key+'\\s*:\\s*\\[([^\\]]+)\\]'))?.[1]||'').split(',').map(x=>x.trim()).filter(Boolean);
const models = blocks.map(match => {
  const fields = match[2].split(/\r?\n/).filter(l=>/^\s*\w+\s+\w/.test(l)).map(line=>{
    const raw=line.trim(), [name,decl]=raw.split(/\s+/), type=decl.replace(/[?\[\]]/g,'');
    return {name,type,kind:blocks.some(m=>m[1]===type)?'object':enums.some(e=>e.name===type)?'enum':'scalar',isList:decl.endsWith('[]'),isRequired:!decl.endsWith('?'),isId:/@id\b/.test(raw),isUnique:/@unique\b/.test(raw),dbName:raw.match(/@map\("([^"]+)"\)/)?.[1]||name,relationFromFields:array(raw,'fields'),relationToFields:array(raw,'references'),relationName:raw.match(/@relation\("([^"]+)"/)?.[1],relationOnDelete:raw.match(/onDelete:\s*(\w+)/)?.[1]||null,raw};
  });
  const constraints=match[2].split(/\r?\n/).map(l=>l.trim()).filter(l=>l.startsWith('@@'));
  return {name:match[1],dbName:match[2].match(/@@map\("([^"]+)"\)/)?.[1]||match[1],fields,constraints,uniqueFields:[...match[2].matchAll(/@@unique\(\[([^\]]+)\]/g)].map(m=>m[1].split(',').map(s=>s.trim())),primaryKey:match[2].match(/@@id\(\[([^\]]+)\]/)?.[1]?.split(',').map(s=>s.trim())||fields.filter(f=>f.isId).map(f=>f.name),line:schema.slice(0,match.index).split('\n').length,raw:match[0]};
});
const classes = [], functions = [], files = [];
function walk(dir) { for (const entry of fs.readdirSync(dir,{withFileTypes:true})) {
  const full = path.join(dir,entry.name);
  if(entry.isDirectory()) walk(full);
  else if(entry.name.endsWith('.ts') && !/\.(spec|test)\.ts$/.test(entry.name)) inspect(full);
} }
function inspect(file) {
  const content=fs.readFileSync(file,'utf8'), sf=ts.createSourceFile(file,content,ts.ScriptTarget.Latest,true);
  files.push({path:rel(file),sha256:hash(content)});
  const line=n=>sf.getLineAndCharacterOfPosition(n.getStart(sf)).line+1;
  const dec=n=>(ts.canHaveDecorators(n)?ts.getDecorators(n)||[]:[]).map(x=>x.getText(sf));
  const params=n=>n.parameters.map(p=>({name:p.name.getText(sf),type:p.type?.getText(sf)||'inferred',optional:!!p.questionToken||!!p.initializer,defaultValue:p.initializer?.getText(sf),modifiers:(p.modifiers||[]).map(m=>m.getText(sf))}));
  function visit(n) {
    if(ts.isClassDeclaration(n)||ts.isInterfaceDeclaration(n)) {
      classes.push({name:n.name?.text,file:rel(file),line:line(n),kind:ts.isInterfaceDeclaration(n)?'interface':'class',decorators:dec(n),heritage:(n.heritageClauses||[]).map(h=>h.getText(sf)),members:n.members.map(m=>({name:ts.isConstructorDeclaration(m)?'constructor':m.name?.getText(sf),kind:ts.isMethodDeclaration(m)||ts.isMethodSignature(m)?'method':ts.isConstructorDeclaration(m)?'constructor':'property',line:line(m),type:m.type?.getText(sf)||'inferred',modifiers:(m.modifiers||[]).filter(x=>x.kind!==ts.SyntaxKind.Decorator).map(x=>x.getText(sf)),decorators:dec(m),typeParameters:(m.typeParameters||[]).map(t=>({name:t.name.text,declaration:t.getText(sf)})),parameters:m.parameters?params(m):[]}))});
    } else if(ts.isFunctionDeclaration(n)&&n.name) functions.push({name:n.name.text,file:rel(file),line:line(n),parameters:params(n),type:n.type?.getText(sf)||'inferred'});
    ts.forEachChild(n,visit);
  } visit(sf);
}
walk(path.join(root,'src'));
const result={verifiedAt:new Date().toISOString(),method:'Static source inspection; no database/runtime verification',schemaSha256:hash(schema),models,enums,classes,functions,files};
fs.mkdirSync(path.join(out,'00-scope-and-traceability'),{recursive:true});
fs.writeFileSync(path.join(out,'00-scope-and-traceability/source-inventory.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({models:models.length,classes:classes.length,files:files.length}));
