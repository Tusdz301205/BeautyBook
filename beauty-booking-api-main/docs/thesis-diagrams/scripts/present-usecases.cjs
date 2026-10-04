// Deterministic UML presentation of the PlantUML declarations/associations.
// No domain data is introduced here. Every actor, ellipse and edge is parsed
// from the editable source; canonical IDs are retained in SVG data attributes.
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function wrap(s,max=29){const result=[];for(const line of s.split('\\n')){let row='';for(const word of line.split(' ')){if(row&&row.length+word.length+1>max){result.push(row);row=''}row+=(row?' ':'')+word}result.push(row)}return result}
module.exports=function(source){
 const actors=[...source.matchAll(/^actor "([^"]+)" as (\w+)(?: <<([^>]+)>>)?/gm)].map(m=>({label:m[1],id:m[2],stereo:m[3]}));
 const ucs=[...source.matchAll(/^usecase "([^"]+)" as (\w+)/gm)].map(m=>({label:m[1],id:m[2]}));
 const edges=[...source.matchAll(/^(\w+) -(?:right-|-)(\w+)?\s*(\w+)?$/gm)].map(m=>[m[1],m[2]||m[3]]);
 const boundary=source.match(/^rectangle "([^"]+)"/m)?.[1];
 if(!boundary||!actors.length||!ucs.length)throw Error('Cannot parse UML use case');
 for(const [a,b] of edges)if(!actors.concat(ucs).some(n=>n.id===a)||!actors.concat(ucs).some(n=>n.id===b))throw Error('Unresolved association '+a+' '+b);
 const business=actors.some(a=>a.stereo==='business worker');
 const width=business?1240:1040,height=120+Math.max(ucs.length, business?3:actors.length)*175;
 const cx=business?655:735,rx=business?250:275,ry=60;
 const nodes=new Map();
 ucs.forEach((n,i)=>nodes.set(n.id,{...n,x:cx,y:125+i*(height-225)/Math.max(1,ucs.length-1),kind:'uc'}));
 actors.forEach((n,i)=>nodes.set(n.id,{...n,x:business&&n.stereo==='business worker'?1110:130,y:business?height/2:100+i*(height-235)/Math.max(1,actors.length-1),kind:'actor'}));
 const body=[];
 body.push(`<rect x="${business?350:420}" y="18" width="${business?872:610}" height="${height-36}" rx="6" fill="white" stroke="#773b4a"/><text x="${business?780:725}" y="53" text-anchor="middle" font-size="18" font-weight="700">${esc(boundary)}</text>`);
 for(const [a,b] of edges){const na=nodes.get(a),nb=nodes.get(b),actor=na.kind==='actor'?na:nb,uc=na.kind==='uc'?na:nb;const ae=edges.filter(e=>e.includes(actor.id));const ai=ae.findIndex(e=>e[0]===a&&e[1]===b);const ue=edges.filter(e=>e.includes(uc.id));const ui=ue.findIndex(e=>e[0]===a&&e[1]===b);const right=actor.x>uc.x;const ay=actor.y-8+ai*16/Math.max(1,ae.length-1);const uy=uc.y-25+ui*50/Math.max(1,ue.length-1);const ux=uc.x+(right?1:-1)*rx*Math.sqrt(1-(uy-uc.y)**2/ry**2);const ax=actor.x+(right?-28:28);const track=right?1030-ai*12:285+ai*14+actors.findIndex(n=>n.id===actor.id)*3;
 body.push(`<path data-association="${a} ${b}" d="M ${ax} ${ay} H ${track} V ${uy} H ${ux}" fill="none" stroke="#773b4a" stroke-width="1.2" stroke-linejoin="round"/>`)}
 for(const n of nodes.values()){
 if(n.kind==='uc'){body.push(`<g data-uml-id="${n.id}"><ellipse cx="${n.x}" cy="${n.y}" rx="${rx}" ry="${ry}" fill="#fffde7" stroke="#773b4a"/>`);const lines=wrap(n.label,45);body.push(...lines.map((s,i)=>`<text x="${n.x}" y="${n.y-(lines.length-1)*11+i*22+6}" text-anchor="middle" font-size="17">${esc(s)}</text>`),'</g>')}
 else {body.push(`<g data-uml-id="${n.id}"><circle cx="${n.x}" cy="${n.y-40}" r="13" fill="white" stroke="#773b4a"/><path d="M ${n.x} ${n.y-27} V ${n.y+22} M ${n.x-28} ${n.y} H ${n.x+28} M ${n.x} ${n.y+22} l -22 28 M ${n.x} ${n.y+22} l 22 28" fill="none" stroke="#773b4a"/>`);if(n.stereo)body.push(`<text x="${n.x}" y="${n.y-66}" text-anchor="middle" font-size="15">«${esc(n.stereo)}»</text>`);body.push(...wrap(n.label,25).map((s,i)=>`<text x="${n.x}" y="${n.y+76+i*21}" text-anchor="middle" font-size="17">${esc(s)}</text>`),'</g>')}
 }
 return {svg:`<svg xmlns="http://www.w3.org/2000/svg" width="${width}px" height="${height}px" viewBox="0 0 ${width} ${height}" style="background:white;font-family:'Times New Roman',serif">${body.join('')}</svg>`,check:{actors:actors.length,usecases:ucs.length,associations:edges.length,sourceBased:true}};
};
