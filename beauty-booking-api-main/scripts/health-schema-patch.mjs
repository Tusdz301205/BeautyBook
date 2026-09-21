// Outputs apply_patch payload; never writes the source itself.
import { readFileSync } from 'node:fs';
import { models, retiredEnums } from './health-archive-manifest.mjs';
const source = readFileSync('prisma/schema.prisma','utf8');
const removed = new Set(Object.keys(models));
const chunks = [];
for(const m of source.matchAll(/^(model|enum) (\w+) \{[\s\S]*?^\}/gm)) {
  if((m[1]==='model'&&removed.has(m[2]))||(m[1]==='enum'&&retiredEnums.includes(m[2]))) {
    chunks.push('@@\n'+m[0].split(/\r?\n/).map(l=>'-'+l).join('\n'));
  } else if(m[1]==='model') {
    for(const line of m[0].split(/\r?\n/)) {
      const field=/^\s+\w+\s+(\w+)(?:\[\]|\?)?(?:\s|$)/.exec(line);
      if(field&&removed.has(field[1]))chunks.push('@@\n-'+line);
    }
  }
}
process.stdout.write('*** Begin Patch\n*** Update File: beauty-booking-api-main/prisma/schema.prisma\n'+chunks.join('\n')+'\n*** End Patch');
