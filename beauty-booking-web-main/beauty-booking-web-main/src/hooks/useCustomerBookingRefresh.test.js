import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { EventEmitter } from 'node:events';
import { bindSchedulerSocketEvents } from '../utils/schedulerSocketEvents.js';
function harness() {
  let generation = 0;
  let state={user:{id:'A'},accessToken:'token-A'},effect,previous,cleanup,refIndex=0;
  const refs=[],sockets=[],recoveries=[],calls=[];
  const store=selector=>selector(state);
  store.getState=()=>({...state,setSession:r=>{calls.push('session');state=r;return state.user;},clearSession:()=>{calls.push('clear');state={user:null,accessToken:null};}});
  const ctx={captureSessionGeneration:()=>generation,isSessionGenerationCurrent:lease=>lease===generation,
    useAuthStore:store,useRef:v=>{const i=refIndex++;return refs[i]??(refs[i]={current:v});},
    useEffect:(fn,deps)=>{const key=JSON.stringify(deps);if(key!==previous){previous=key;effect=fn;}},
    useOperationalRefresh:()=>{},schedulerSocketUrl:()=>'/qa',bindSchedulerSocketEvents,
    refreshSession:()=>new Promise((resolve,reject)=>recoveries.push({resolve,reject})),
    io:()=>{const s=new EventEmitter();s.disconnect=()=>{s.closed=true;};sockets.push(s);return s;}};
  const source=readFileSync(new URL('./useCustomerBookingRefresh.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replace('export function','function');
  vm.runInNewContext(source+';this.hook=useCustomerBookingRefresh;',ctx);
  return {sockets,calls,recoveries,transition:()=>generation++,setState:s=>{state=s;},render:(fn=()=>calls.push('read'))=>{refIndex=0;ctx.hook(fn);if(effect){cleanup?.();const next=effect;effect=null;cleanup=next();}},dispose:()=>cleanup?.()};
}
const settle=()=>new Promise(r=>setImmediate(r));
const batch=()=>new Promise(r=>setTimeout(r,100));
test('held customer events and reconnect invalidate API reads; event payload never replaces data',async()=>{
  const h=harness();h.render();const s=h.sockets[0];
  s.emit('booking_updated',{id:'foreign',status:'FAKE'});s.emit('booking_created');await batch();assert.deepEqual(h.calls,['read']);
  s.emit('connect');s.emit('scheduler_resync');await batch();assert.deepEqual(h.calls,['read','read']);h.dispose();
});
test('new refresh callback is used without opening duplicate socket leases',async()=>{
  const h=harness();h.render();h.render(()=>h.calls.push('latest'));assert.equal(h.sockets.length,1);
  h.sockets[0].emit('booking_updated');await batch();assert.deepEqual(h.calls,['latest']);h.dispose();
});
test('logout/account switch cancels queued reads and disconnects previous scope',async()=>{
  const h=harness();h.render();const old=h.sockets[0];old.emit('booking_updated');
  h.setState({user:{id:'B'},accessToken:'token-B'});h.render();await batch();assert.deepEqual(h.calls,[]);assert.equal(old.closed,true);
  old.emit('booking_updated');h.sockets[1].emit('booking_updated');await batch();assert.deepEqual(h.calls,['read']);h.dispose();
});
test('one auth recovery fences late old-account failure and does not clear a new session',async()=>{
  const h=harness();h.render();h.sockets[0].emit('scheduler_auth_failed');h.sockets[0].emit('scheduler_auth_failed');assert.equal(h.recoveries.length,1);
  h.setState({user:{id:'B'},accessToken:'token-B'});h.render();h.recoveries[0].reject(Error('old expired'));await settle();assert.deepEqual(h.calls,[]);h.dispose();
});
test('ordinary offline connect error is retained; denied refresh clears only matching session',async()=>{
  const h=harness();h.render();h.sockets[0].emit('connect_error',Error('offline'));assert.equal(h.recoveries.length,0);
  h.sockets[0].emit('connect_error',{data:{code:'WS_AUTH_FAILED'}});h.recoveries[0].reject(Error('revoked'));await settle();assert.deepEqual(h.calls,['clear']);h.dispose();
});

test('same-account matching-token transition and unmount fence both deferred recovery outcomes',async()=>{
  for(const mode of ['transition','unmount'])for(const failure of [false,true]){
    const h=harness();h.render();h.sockets[0].emit('scheduler_auth_failed');
    if(mode==='transition')h.transition();else h.dispose();
    if(failure)h.recoveries[0].reject(Error('stale'));else h.recoveries[0].resolve({user:{id:'A'},accessToken:'token-A'});
    await settle();assert.deepEqual(h.calls,[]);h.dispose();
  }
});
