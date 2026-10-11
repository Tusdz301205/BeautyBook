const fs=require('fs'),fsp=require('fs/promises'),path=require('path'),crypto=require('crypto'),{fork}=require('child_process');
const root=path.resolve(__dirname,'../../../..'),req=require('module').createRequire(path.join(root,'beauty-booking-api-main/package.json'));
if(process.argv[2]==='--child'){
  const directory=path.resolve(process.argv[3]),image=path.resolve(process.argv[4]);
  if(!directory.startsWith(path.join(root,'report-output/bugreport-remediation/storage-crash-'))||!image.startsWith(path.join(root,'report-output/bugreport-remediation')+path.sep))throw Error('child paths');
  const {MediaService}=req('./dist/src/media/media.service');
  const db={user:{findUnique:async()=>({id:'qa-crash-avatar'})},mediaFile:{create:async({data})=>{process.send({stage:'DISK_WRITTEN_METADATA_NOT_CREATED',storageKey:data.storageKey,size:data.fileSize});await new Promise(()=>setInterval(()=>{},1000));}},$transaction:async fn=>fn(db)};
  const service=new MediaService(db,{get:()=>directory}),bytes=fs.readFileSync(image);
  service.upload({id:'qa-crash-avatar',roles:['CUSTOMER']},{buffer:bytes,size:bytes.length,originalname:'QA-LANDSCAPE.png',mimetype:'image/png'},{entityType:'USER_AVATAR',entityId:'qa-crash-avatar'}).catch(()=>{process.send({stage:'CHILD_FAILED'});process.exitCode=1;});
}else{
  const runId=crypto.randomUUID(),out=path.join(root,'report-output/bugreport-remediation','storage-crash-'+runId),storage=path.join(out,'isolated-upload-root'),image=path.join(root,'report-output/bugreport-remediation/media-readable-58c4eae0-e0e3-4290-96fe-018079874a9e/LANDSCAPE.png');
  fs.mkdirSync(storage,{recursive:true});const report={runId,kind:'REAL_MEDIA_SERVICE_DISK_PROCESS_INTERRUPT_MOCK_METADATA_DB',version:require('./source-version.cjs')(root),limitations:'Metadata DB shim paused before CREATE. Actual child process forced termination, not whole Nest/API crash. Grace age adjusted only on own QA file; no production/files/database touched.'};let child;
  (async()=>{try{
    if(!fs.existsSync(image))throw Error('Existing labelled QA image missing');
    child=fork(__filename,['--child',storage,image],{cwd:root,env:{...process.env,NODE_ENV:'test',DATABASE_URL: new URL('/unused_storage_crash_fixture', 'postgresql://localhost').href},stdio:['ignore','ignore','ignore','ipc']});
    const receipt=await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('child seam timeout')),45000);child.once('message',message=>{clearTimeout(timeout);if(message.stage!=='DISK_WRITTEN_METADATA_NOT_CREATED')return reject(Error('child seam failed'));resolve(message);});child.once('error',reject);});
    const file=path.resolve(storage,receipt.storageKey);if(!file.startsWith(storage+path.sep)||child.pid===process.pid)throw Error('owned process/file guard');
    report.receipt={...receipt,pid:child.pid,at:new Date().toISOString()};
    const closed=new Promise(resolve=>child.once('close',(code,signal)=>resolve({code,signal})));
    child.kill('SIGKILL');report.processClosed=await closed;
    report.fileRetainedAfterForcedTermination=fs.existsSync(file);
    const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');report.bytesMatch=sha(fs.readFileSync(file))===sha(fs.readFileSync(image));
    const {inspectStorage}=req('./dist/src/media/storage-inventory'),prefix=receipt.storageKey.split('/').slice(0,2).join('/'),cutoff=new Date(Date.now()-24*3600000);
    report.freshInventory=await inspectStorage(storage,prefix,new Set(),cutoff);
    await fsp.utimes(file,new Date(),new Date(Date.now()-25*3600000));
    report.agedInventory=await inspectStorage(storage,prefix,new Set(),cutoff);
    report.pass=report.fileRetainedAfterForcedTermination&&report.bytesMatch&&report.freshInventory.retainedUntracked.length===1&&report.freshInventory.orphanCandidates.length===0&&report.agedInventory.orphanCandidates.length===1&&fs.existsSync(file);
    if(!report.pass)throw Error('process/FS/inventory assertion failed');
  }catch(e){report.failure=e.message;report.pass=false;}finally{if(child&&child.exitCode===null&&!child.killed)child.kill('SIGKILL');fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({out,pass:report.pass}));process.exitCode=report.pass?0:1;}})();
}
