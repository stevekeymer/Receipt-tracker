/* Optional PWA install invitation: Safari instructions and native Chromium prompt. */
(function(){
 'use strict';
 const standalone=()=>window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
 if(standalone())return;
 const force=new URLSearchParams(location.search).has('install');
 const key='zh-spend-install-dismissed-at';
 const waitDays=14;
 if(!force){try{if(Date.now()-Number(localStorage.getItem(key)||0)<waitDays*86400000)return}catch{}}
 const ua=navigator.userAgent||'';
 const ios=/iPhone|iPad|iPod/i.test(ua)||(/Macintosh/i.test(ua)&&navigator.maxTouchPoints>1);
 const safari=/Safari/i.test(ua)&&!/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
 let deferred=null,shown=false;
 const style=document.createElement('style');
 style.textContent=`
 .zh-install-banner{position:fixed;bottom:calc(16px + env(safe-area-inset-bottom,0px));left:16px;right:16px;z-index:9998;max-width:440px;margin:auto;padding:16px;background:#fff;color:#1c2b45;border:1px solid #dbe3ee;border-radius:18px;box-shadow:0 14px 45px rgba(10,26,50,.22);font-family:inherit}
 .zh-install-top{display:flex;align-items:center;gap:12px}
 .zh-install-icon{width:48px;height:48px;border-radius:12px;flex:none}
 .zh-install-copy{flex:1;min-width:0}
 .zh-install-copy strong{display:block;font-size:16px}
 .zh-install-copy small{display:block;margin-top:4px;color:#596982;line-height:1.45}
 .zh-install-actions{display:flex;gap:10px;margin-top:14px}
 .zh-install-actions button{flex:1;border-radius:10px;padding:11px 12px;font-weight:700;min-height:44px;cursor:pointer}
 .zh-install-accept{background:#153d75;color:white;border:0}
 .zh-install-later{background:#edf2f8;color:#30415a;border:0}
 .zh-install-help{margin:12px 0 0;font-size:13px;line-height:1.6;color:#34425b}
 .zh-install-help[hidden]{display:none}
 .dark .zh-install-banner{background:#202a3f;color:#f2f6ff;border-color:#495875}
 .dark .zh-install-copy small,.dark .zh-install-help{color:#d0d9ea}
 .dark .zh-install-later{background:#34425b;color:#f2f6ff}
 `;
 document.head.appendChild(style);
 function dismiss(){
  document.getElementById('zhInstallBanner')?.remove();
  try{localStorage.setItem(key,String(Date.now()))}catch{}
 }
 function show(){
  if(shown||standalone()||document.getElementById('zhInstallBanner'))return;
  // iOS other browsers may offer Share > Add to Home Screen as well.
  if(!ios&&!deferred&&!force)return;
  shown=true;
  const banner=document.createElement('aside');
  banner.id='zhInstallBanner';
  banner.className='zh-install-banner';
  banner.setAttribute('aria-label','Install ZeroHours Spend');
  banner.innerHTML='<div class="zh-install-top"><img class="zh-install-icon" src="/assets/spend-icon.png" alt=""><div class="zh-install-copy"><strong>Install ZeroHours Spend</strong><small>Open from your Home Screen and access supported offline features.</small></div></div><div class="zh-install-actions"><button type="button" class="zh-install-accept">Install app</button><button type="button" class="zh-install-later">Not now</button></div><p class="zh-install-help" hidden></p>';
  const accept=banner.querySelector('.zh-install-accept');
  const help=banner.querySelector('.zh-install-help');
  banner.querySelector('.zh-install-later').addEventListener('click',dismiss);
  accept.addEventListener('click',async()=>{
   if(deferred){
    const prompt=deferred;deferred=null;
    try{await prompt.prompt();const choice=await prompt.userChoice;if(choice?.outcome==='accepted')dismiss();else dismiss()}catch{dismiss()}
    return;
   }
   help.hidden=false;
   help.textContent=safari?'In Safari, tap Share (square with an up arrow), then Add to Home Screen. Turn on Open as Web App if offered, and tap Add.':'Use your browser’s Share menu, then choose Add to Home Screen. Safari provides the most consistent installation experience on iPhone.';
   accept.textContent='Got it';
   accept.onclick=dismiss;
  });
  document.body.appendChild(banner);
 }
 window.addEventListener('beforeinstallprompt',event=>{
  event.preventDefault();
  deferred=event;
  setTimeout(show,4500);
 });
 window.addEventListener('appinstalled',dismiss);
 // This script is injected after DOMContentLoaded by trial.js.
 // Run immediately when the document is already interactive/complete.
 const schedule=()=>{if(ios||force)setTimeout(show,force?500:4500)};
 if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',schedule,{once:true});
 }else{
  schedule();
 }
})();
