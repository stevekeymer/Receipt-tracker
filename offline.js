/* ZeroHours Spend: local, per-account expense cache and retry queue. */
(function(){
 const DB='zerohours-spend-offline-v1',VERSION=1;
 function open(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB,VERSION);req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains('snapshots'))db.createObjectStore('snapshots',{keyPath:'userId'});if(!db.objectStoreNames.contains('queue'))db.createObjectStore('queue',{keyPath:'id'})};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
 async function transact(store,mode,action){const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction(store,mode);const req=action(tx.objectStore(store));tx.oncomplete=()=>{db.close();resolve(req?.result)};tx.onerror=()=>{db.close();reject(tx.error)};tx.onabort=()=>{db.close();reject(tx.error)}})}
 const put=(store,value)=>transact(store,'readwrite',s=>s.put(value));
 const get=(store,id)=>transact(store,'readonly',s=>s.get(id));
 const del=(store,id)=>transact(store,'readwrite',s=>s.delete(id));
 const all=store=>transact(store,'readonly',s=>s.getAll());
 async function pending(userId){return (await all('queue')).filter(x=>x.userId===userId).sort((a,b)=>a.createdAt-b.createdAt)}
 async function enqueue(userId,entry,items){const id=crypto.randomUUID();const task={id,userId,entry:{...entry,id,user_id:userId},items:items.map(i=>({...i,id:crypto.randomUUID(),expense_id:id})),createdAt:Date.now()};await put('queue',task);return task}
 async function sync(sb,userId){if(!navigator.onLine)return {synced:0,remaining:(await pending(userId)).length};let synced=0;for(const task of await pending(userId)){try{const {error}=await sb.from('expenses').upsert(task.entry,{onConflict:'id'});if(error)throw error;if(task.items.length){const {error:itemError}=await sb.from('expense_items').upsert(task.items,{onConflict:'id'});if(itemError)throw itemError}await del('queue',task.id);synced++}catch(e){console.warn('Offline expense waiting for retry',e);break}}return {synced,remaining:(await pending(userId)).length}}
 async function cache(userId,expenses,items){await put('snapshots',{userId,expenses,items,updatedAt:Date.now()})}
 async function snapshot(userId){return await get('snapshots',userId)}
 window.spendOffline={enqueue,pending,sync,cache,snapshot};
 if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(e=>console.warn('Offline support unavailable',e)));
})();
