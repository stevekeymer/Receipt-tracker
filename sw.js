const CACHE='zh-spend-shell-v7';
const SHELL=['/','/index.html','/manifest.webmanifest','/offline.js','/sharing.js','/recycle.js','/assets/spend-icon.svg','/assets/spend-icon.png','/assets/spend-logo.svg'];
const SUPABASE_JS='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.95.0/dist/umd/supabase.min.js';
self.addEventListener('install',event=>{event.waitUntil((async()=>{const cache=await caches.open(CACHE);await Promise.allSettled([...SHELL,SUPABASE_JS].map(url=>cache.add(url)));await self.skipWaiting()})())});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('zh-spend-shell-')&&key!==CACHE)await caches.delete(key);await self.clients.claim()})())});
self.addEventListener('fetch',event=>{const request=event.request;if(request.method!=='GET')return;const url=new URL(request.url);if(url.href===SUPABASE_JS){event.respondWith((async()=>{const cache=await caches.open(CACHE);const saved=await cache.match(request);if(saved)return saved;const response=await fetch(request);if(response.ok)await cache.put(request,response.clone());return response})());return}
if(url.origin!==self.location.origin)return;
if(url.pathname.startsWith('/api/')||url.pathname.startsWith('/auth/')||url.pathname.startsWith('/rest/'))return;
if(request.mode==='navigate'){event.respondWith((async()=>{try{const response=await fetch(request);if(response.ok){const cache=await caches.open(CACHE);await cache.put('/index.html',response.clone())}return response}catch(e){return await caches.match('/index.html')||Response.error()}})());return}
event.respondWith((async()=>{const cache=await caches.open(CACHE);const saved=await cache.match(request);if(saved)return saved;const response=await fetch(request);if(response.ok)await cache.put(request,response.clone());return response})())});
