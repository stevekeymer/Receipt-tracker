const CACHE='zh-spend-shell-v21';
const SHELL=['/','/index.html','/manifest.webmanifest','/offline.js','/sharing.js','/recycle.js','/mfa.js','/account.js','/billing.js','/assets/spend-icon.svg','/assets/spend-icon.png','/assets/spend-logo.svg'];
const SUPABASE_JS='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.95.0/dist/umd/supabase.min.js';
self.addEventListener('install',event=>{event.waitUntil((async()=>{const cache=await caches.open(CACHE);await Promise.allSettled([...SHELL,SUPABASE_JS].map(url=>cache.add(url)));await self.skipWaiting()})())});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('zh-spend-shell-')&&key!==CACHE)await caches.delete(key);await self.clients.claim()})())});
self.addEventListener('fetch',event=>{const request=event.request;if(request.method!=='GET')return;const url=new URL(request.url);if(url.href===SUPABASE_JS){event.respondWith((async()=>{const cache=await caches.open(CACHE);const saved=await cache.match(request);if(saved)return saved;const response=await fetch(request);if(response.ok)await cache.put(request,response.clone());return response})());return}
if(url.origin!==self.location.origin)return;
if(url.pathname.startsWith('/api/')||url.pathname.startsWith('/auth/')||url.pathname.startsWith('/rest/'))return;
if(['/offline.js','/sharing.js','/recycle.js'].includes(url.pathname)){
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  try{
   const response=await fetch(new Request(url.origin+url.pathname,{cache:'no-store'}));
   if(response.ok){await cache.put(url.pathname,response.clone());return response}
   throw Error('Helper script request failed');
  }catch(e){return await cache.match(url.pathname)||await caches.match(url.pathname)||Response.error()}
 })());return
}
if(request.mode==='navigate'){event.respondWith((async()=>{try{const response=await fetch(request);if(response.ok){const cache=await caches.open(CACHE);await cache.put('/index.html',response.clone())}return response}catch(e){return await caches.match('/index.html')||Response.error()}})());return}
event.respondWith((async()=>{const cache=await caches.open(CACHE);const saved=await cache.match(request);if(saved)return saved;const response=await fetch(request);if(response.ok)await cache.put(request,response.clone());return response})())});

self.addEventListener('push',event=>{
 let payload={};
 try{payload=event.data?event.data.json():{}}catch{payload={}}
 const title=String(payload.title||'ZeroHours Spend');
 event.waitUntil(self.registration.showNotification(title,{
  body:String(payload.body||'You have a new spending alert.'),
  icon:'/assets/spend-icon.png',
  badge:'/assets/spend-icon.png',
  tag:String(payload.tag||'zerohours-spending-alert'),
  data:{url:'/'},
  renotify:false
 }));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 event.waitUntil((async()=>{
  const windows=await clients.matchAll({type:'window',includeUncontrolled:true});
  for(const client of windows){if(new URL(client.url).origin===self.location.origin){await client.focus();client.postMessage({type:'OPEN_ALERTS'});return}}
  await clients.openWindow('/');
 })());
});
