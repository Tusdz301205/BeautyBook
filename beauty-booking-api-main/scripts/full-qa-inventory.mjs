import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync,readdirSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,relative,join} from 'node:path';
import {execFileSync} from 'node:child_process';
const require=createRequire(import.meta.url),{scanControllers}=require('./controller-metadata.cjs');
const root=resolve('..'),out=resolve(root,'docs/full-system-qa');mkdirSync(out,{recursive:true});
const routes=scanControllers(process.cwd()).routes;
writeFileSync(resolve(out,'api-inventory.json'),JSON.stringify(routes.map((r,i)=>({id:`API-${String(i+1).padStart(3,'0')}`,platform:'API',...r,functionalStatus:'NOT_RUN',securityStatus:'NOT_RUN',evidence:[]})),null,2));
function walk(dir){return readdirSync(dir).flatMap(n=>{const p=join(dir,n);return statSync(p).isDirectory()?walk(p):/\.(ts|tsx|js|jsx|json|prisma|css)$/.test(n)?[p]:[];});}
const paths=['beauty-booking-api-main/src','beauty-booking-api-main/prisma','beauty-booking-web-main/beauty-booking-web-main/src','mobile/src','mobile-preview/src'].flatMap(p=>walk(resolve(root,p)));
const files=Object.fromEntries(paths.map(p=>[relative(root,p).replaceAll('\\','/'),createHash('sha256').update(readFileSync(p)).digest('hex')]));
writeFileSync(resolve(out,'evidence/current/code-version.json'),JSON.stringify({capturedAt:new Date().toISOString(),head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),dirty:true,files},null,2));
console.log(`Inventoried ${routes.length} API operations; ${Object.keys(files).length} source hashes; functional execution still NOT_RUN.`);
