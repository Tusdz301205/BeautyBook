import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root=path.dirname(fileURLToPath(import.meta.url));
for(const name of ['extract-source','build','render','publish','validate']) {
  const r=spawnSync(process.execPath,[path.join(root,'scripts',name+'.cjs')],{stdio:'inherit',windowsHide:true});
  if(r.status!==0)process.exit(r.status||1);
}
