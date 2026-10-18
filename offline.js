/* ZeroHours Spend encrypted offline store. PIN unlock is local, never a Supabase login. */
(function(){
'use strict';
const DB='zerohours-spend-offline-v1',VERSION=2,enc=new TextEncoder(),dec=new TextDecoder();
let activeUser=null,activeKey=null;
const bytes=n=>crypto.getRandomValues(new Uint8Array(n));
const b64=a=>btoa(String.fromCharCode(...new Uint8Array(a)));
const un64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
function open(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB,VERSION);req.onupgradeneeded=()=>{const db=req.result;for(const [name,keyPath] of [['snapshots','userId'],['queue','id'],['locks','userId']])if(!db.objectStoreNames.contains(name))db.createObjectStore(name,{keyPath})};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
async function tx(store,mode,fn){const db=await open();return new Promise((resolve,reject)=>{const t=db.transaction(store,mode),r=fn(t.objectStore(store));t.oncomplete=()=>{db.close();resolve(r?.result)};t.onerror=()=>{db.close();reject(t.error)};t.onabort=()=>{db.close();reject(t.error)}})}
const put=(s,v)=>tx(s,'readwrite',o=>o.put(v)),get=(s,id)=>tx(s,'readonly',o=>o.get(id)),del=(s,id)=>tx(s,'readwrite',o=>o.delete(id)),all=s=>tx(s,'readonly',o=>o.getAll());
async function derive(pin,salt){const raw=await crypto.subtle.importKey('raw',enc.encode(pin),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',salt:un64(salt),iterations:350000,hash:'SHA-256'},raw,{name:'AES-GCM',length:256},false,['encrypt','decrypt'])}
async function encrypt(value,key=activeKey){if(!key)throw Error('Offline storage is locked');const iv=bytes(12);const data=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,enc.encode(JSON.stringify(value)));return {iv:b64(iv),ciphertext:b64(data)}}
async function decrypt(value,key=activeKey){if(!key||!value?.ciphertext)throw Error('Offline storage is locked');const data=await crypto.subtle.decrypt({name:'AES-GCM',iv:un64(value.iv)},key,un64(value.ciphertext));return JSON.parse(dec.decode(data))}
async function account(){const locks=await all('locks');return locks[0]||null}
async function setup(user,pin){
 if(!navigator.onLine)throw Error('Set up your PIN while online');
 if(!/^\d{6,12}$/.test(pin))throw Error('Use a 6–12 digit PIN');
 const old=await account();if(old&&old.userId!==user.id)throw Error('Offline access is already configured for another account on this device');
 const salt=b64(bytes(16)),key=await derive(pin,salt),check=await encrypt({userId:user.id,tag:'ZeroHours Spend'},key);
 // Migrate legacy plaintext records into encrypted records before enabling the lock.
 const existing=await get('snapshots',user.id);
 const queued=(await all('queue')).filter(t=>t.userId===user.id);
 const encryptedSnapshot=existing&&!existing.ciphertext?await encrypt({expenses:existing.expenses||[],items:existing.items||[],updatedAt:existing.updatedAt},key):null;
 const encryptedQueue=await Promise.all(queued.filter(t=>!t.ciphertext).map(async t=>({id:t.id,userId:t.userId,createdAt:t.createdAt,...await encrypt(t,key)})));
 if(encryptedSnapshot)await put('snapshots',{userId:user.id,...encryptedSnapshot});
 for(const item of encryptedQueue)await put('queue',item);
 await put('locks',{userId:user.id,email:user.email,salt,check,failed:0,lockedUntil:0});
 activeUser=user.id;activeKey=key;
}
async function unlock(pin){const meta=await account();if(!meta)throw Error('Offline access is not configured');if(Date.now()<(meta.lockedUntil||0))throw Error('Too many attempts. Try again later.');
 try{const key=await derive(pin,meta.salt),proof=await decrypt(meta.check,key);if(proof.userId!==meta.userId)throw Error('Incorrect PIN');activeUser=meta.userId;activeKey=key;await put('locks',{...meta,failed:0,lockedUntil:0});return {id:meta.userId,email:meta.email}}catch(e){const failed=(meta.failed||0)+1;await put('locks',{...meta,failed,lockedUntil:failed>=5?Date.now()+300000:0});throw Error('Incorrect offline PIN'+(failed>=5?'. Wait five minutes before retrying.':'.'))}}
function lock(){activeUser=null;activeKey=null}
async function clear(userId){if(!ready(userId))throw Error('Unlock offline data before signing out');for(const task of await pending(userId))throw Error('Sync pending offline expenses before signing out');await del('snapshots',userId);await del('locks',userId);lock()}
async function disable(userId){
 const meta=await account();
 if(!meta)return;
 if(meta.userId!==userId)throw Error('Offline data belongs to a different account');
 if(!ready(userId))throw Error('Unlock your offline PIN first. If forgotten, use online account recovery.');
 const tasks=await pending(userId);
 if(tasks.length)throw Error('Sync '+tasks.length+' pending offline expense(s) before disabling the PIN.');
 await del('snapshots',userId);
 await del('locks',userId);
 lock();
}
async function resetForgotten(userId){
 if(!navigator.onLine)throw Error('Reconnect to reset the PIN');
 const meta=await account();
 if(!meta)return;
 if(meta.userId!==userId)throw Error('This device contains offline data for another account');
 const queued=(await all('queue')).filter(t=>t.userId===userId);
 if(queued.length)throw Error('This device has '+queued.length+' encrypted unsynced expense(s). They cannot be recovered without the old PIN. To preserve them, cancel and unlock with your old PIN.');
 await del('snapshots',userId);
 await del('locks',userId);
 lock();
}
function ready(id){return activeUser===id&&!!activeKey}
async function snapshot(userId){if(!ready(userId))return null;const row=await get('snapshots',userId);if(!row)return null;return decrypt(row)}
async function cache(userId,expenses,items){if(!ready(userId))return;const value=await encrypt({expenses,items,updatedAt:Date.now()});await put('snapshots',{userId,...value})}
async function pending(userId){if(!ready(userId))return [];const rows=(await all('queue')).filter(t=>t.userId===userId).sort((a,b)=>a.createdAt-b.createdAt);return Promise.all(rows.map(async row=>decrypt(row)))}
async function enqueue(userId,entry,items){if(!ready(userId))throw Error('Set up and unlock your offline PIN first');const id=crypto.randomUUID();const task={id,userId,entry:{...entry,id,user_id:userId},items:items.map(i=>({...i,id:crypto.randomUUID(),expense_id:id})),createdAt:Date.now()};await put('queue',{id,userId,createdAt:task.createdAt,...await encrypt(task)});return task}
async function sync(sb,userId){if(!navigator.onLine||!ready(userId))return {synced:0,remaining:0};let synced=0;for(const task of await pending(userId)){try{const {error}=await sb.from('expenses').upsert(task.entry,{onConflict:'id',ignoreDuplicates:true});if(error)throw error;if(task.items.length){const {error:itemError}=await sb.from('expense_items').upsert(task.items,{onConflict:'id',ignoreDuplicates:true});if(itemError)throw itemError}await del('queue',task.id);synced++}catch(e){console.warn('Expense remains queued for retry',e);break}}return {synced,remaining:(await pending(userId)).length}}
window.spendOffline={account,setup,unlock,lock,clear,disable,resetForgotten,ready,snapshot,cache,pending,enqueue,sync};
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(console.warn));
})();
