const crypto = require('node:crypto');
const utc = () => new Date().toISOString();
const safe = value => String(value || '').replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '[JWT]').replace(/Bearer\s+\S+/gi, 'Bearer [redacted]');
class BrowserCases {
  constructor(page, { role, runId = crypto.randomUUID(), redact = safe } = {}) {
    this.page=page;this.role=role;this.runId=runId;this.redact=redact;this.cases=[];this.orphanEvents=[];this.current=null;this.requests=new WeakMap();this.pending=new Set();
    page.on('request', request => { this.requests.set(request,{owner:this.current,phase:this.current?.phase || 'outside-case'}); });
    page.on('response', response => {
      const request=response.request(), attribution=this.requests.get(request)||{owner:this.current,phase:this.current?.phase || 'outside-case'};
      const task=(async()=>{const event={kind:'http',at:utc(),phase:attribution.phase,method:request.method(),path:new URL(response.url()).pathname,status:response.status()};
        if(event.path.startsWith('/api/v1/')) {try { Object.defineProperty(event,'body',{value:await response.json()}); } catch { /* Not a JSON response. */ }
          this.record(event,attribution.owner);
        }
      })();this.pending.add(task);task.finally(()=>this.pending.delete(task));
    });
    page.on('requestfailed',request=>{const a=this.requests.get(request)||{owner:this.current,phase:this.current?.phase || 'outside-case'};this.record({kind:'network',at:utc(),phase:a.phase,method:request.method(),path:new URL(request.url()).pathname,message:this.redact(request.failure()?.errorText)},a.owner);});
    page.on('pageerror',error=>this.record({kind:'javascript',at:utc(),phase:this.current?.phase||'outside-case',message:this.redact(error.message)}));
    page.on('console',message=>{if(message.type()==='error'){const url=message.location()?.url;this.record({kind:'console',at:utc(),phase:this.current?.phase||'outside-case',path:url?.startsWith('http')?new URL(url).pathname:'',message:this.redact(message.text())});}});
  }
  record(event, owner=this.current) { if(owner) owner.events.push(event); else this.orphanEvents.push(event); }
  async drain(){while(this.pending.size)await Promise.all([...this.pending]);}
  async run(spec, body) {
    if(this.current)throw Error('Cases must run sequentially');
    const c={id:spec.id,role:this.role,route:spec.route,action:spec.action,startedAt:utc(),endedAt:null,phase:spec.phase||'content',events:[],assertions:[],status:'RUNNING',expectedRules:spec.expected||[]};this.cases.push(c);this.current=c;
    const control={phase:name=>{c.phase=name;},assert:(ok,message)=>{c.assertions.push({message,passed:Boolean(ok)});if(!ok)throw Error(message);}, response:(method,path)=>c.events.filter(e=>e.kind==='http'&&e.method===method&&e.path===path).at(-1)};
    try {await body(control);await this.drain();
      for(const required of spec.responses||[]){const matches=c.events.filter(e=>e.kind==='http'&&e.method===(required.method||'GET')&&e.path===required.path&&e.status===(required.status||200));control.assert(matches.length>0,'Required response: '+required.path);if(required.validate)control.assert(matches.some(e=>required.validate(e.body)),'Business response schema/content: '+required.path);}
      control.assert(c.assertions.length>0,'At least one business assertion is required');
    } catch(error) { c.assertions.push({message:this.redact(error.message),passed:false}); }
    finally {await this.drain();c.endedAt=utc();this.current=null;this.classify(c);}
    return c;
  }
  classify(c) {
    const usage=new Map();let unexpected=0;
    for(const e of [...c.events].sort((a,b)=>(a.kind==='console')-(b.kind==='console'))) {
      if(e.kind==='http'&&e.status<400)continue;
      const rule=c.expectedRules.find(r=>r.kind===e.kind&&r.phase===e.phase&&r.method===e.method&&r.path===e.path&&(r.status===undefined||r.status===e.status)&&(r.message===undefined||r.message===e.message));
      if(rule&&usage.get(rule)<(rule.max||1)){e.expected=true;e.reason=rule.reason;usage.set(rule,(usage.get(rule)||0)+1);}
      else if(rule&&!usage.has(rule)){e.expected=true;e.reason=rule.reason;usage.set(rule,1);}
      else if(e.kind==='console'&&/^Failed to load resource: the server responded with a status of \d{3} /.test(e.message)&&c.events.some(h=>h.kind==='http'&&h.expected&&h.phase===e.phase&&h.path===e.path)){e.expected=true;e.reason='Browser resource console message for exact expected HTTP response';}
      else {e.expected=false;unexpected++;}
    }
    for(const r of c.expectedRules)if(r.required&&!(usage.get(r)>0))c.assertions.push({message:'Expected controlled error was not observed: '+r.path,passed:false});
    c.status=unexpected||c.assertions.some(a=>!a.passed)?'FAIL':'PASS';
  }
  result(){for(const c of this.cases)this.classify(c);const fail=this.cases.filter(c=>c.status==='FAIL').length;return {runId:this.runId,role:this.role,cases:this.cases,orphanEvents:this.orphanEvents,exitCode:fail||this.orphanEvents.some(e=>e.kind!=='http'||e.status>=400)?1:0};}
}
module.exports={BrowserCases};
