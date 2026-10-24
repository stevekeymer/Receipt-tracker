/* ZeroHours Spend settings navigation and mobile usability enhancements.
   Presentation only: preserves existing forms, permissions, billing and handlers. */
(function () {
  'use strict';
  const root = document.getElementById('configure');
  if (!root || root.dataset.settingsEnhanced) return;
  const originalPanel = root.querySelector(':scope > .panel');
  if (!originalPanel) return;
  root.dataset.settingsEnhanced = 'true';

  const css = document.createElement('style');
  css.textContent = `
    .spend-settings-home{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;max-width:850px;margin:22px 0}
    .spend-settings-link{display:flex;align-items:center;gap:14px;text-align:left;border:1px solid #e3e9f2;background:#fff;border-radius:16px;padding:20px;min-height:100px;color:inherit;box-shadow:0 4px 16px #1d305008}
    .spend-settings-link:hover,.spend-settings-link:focus-visible{border-color:#625cdd;box-shadow:0 6px 24px #1d305015}
    .spend-settings-icon{display:grid;place-items:center;width:46px;height:46px;flex-shrink:0;border-radius:13px;background:#eef0ff;font-size:23px}
    .spend-settings-link strong{display:block;font-size:16px}.spend-settings-link small{display:block;font-size:13px;color:#718099;margin-top:5px;line-height:1.4}
    .spend-settings-chevron{margin-left:auto;font-size:22px;color:#8290a5}
    .spend-settings-page{max-width:850px}.spend-settings-page[hidden],.spend-settings-home[hidden]{display:none!important}
    .spend-settings-page > .panel{max-width:none;margin:12px 0 20px}
    .spend-settings-page h3{margin-top:24px}
    .spend-settings-page .panel .panel{border-radius:14px;box-shadow:none}
    .spend-settings-back{margin:4px 0 12px;display:inline-flex;align-items:center;gap:6px}
    .spend-settings-help{margin:0 0 16px;color:#7a8499}
    .spend-settings-current{border:1px solid #e3e9f2;border-radius:14px;background:#fff;padding:15px 18px;margin-top:15px;max-width:850px}
    .spend-mobile-nav{display:none}
    .dark .spend-settings-link,.dark .spend-settings-current{background:#222a40;border-color:#36415a;color:#f1f5ff}
    .dark .spend-settings-link small{color:#b8c5dc}
    .dark .spend-settings-icon{background:#39375c}
    @media(max-width:700px){
      .spend-settings-home{grid-template-columns:1fr;gap:10px}
      .spend-settings-link{min-height:76px;padding:14px}
      .spend-settings-page .panel{padding:18px}
      .spend-settings-page .row{flex-wrap:wrap}
      body{padding-bottom:76px}
      .spend-mobile-nav{position:fixed;bottom:0;left:0;right:0;z-index:35;display:grid;grid-template-columns:repeat(5,1fr);background:#fff;border-top:1px solid #e1e7ef;padding:8px 5px calc(8px + env(safe-area-inset-bottom));box-shadow:0 -3px 16px #1d30500b}
      .spend-mobile-nav button{border:0;background:transparent;color:#62718a;padding:6px 0;font-size:11px;display:flex;flex-direction:column;align-items:center;gap:3px;min-width:0}
      .spend-mobile-nav button span{font-size:21px;line-height:1.1}
      .spend-mobile-nav button[aria-current="page"]{color:#605bd2;font-weight:800}
      .dark .spend-mobile-nav{background:#222a40;border-color:#36415a}
      .dark .spend-mobile-nav button{color:#b8c5dc}
      .dark .spend-mobile-nav button[aria-current="page"]{color:#bdb8ff}
    }
  `;
  document.head.appendChild(css);

  const groups = [
    {id:'accounts',title:'Expense accounts',icon:'🏦',hint:'Create accounts and manage sharing'},
    {id:'categories',title:'Categories',icon:'🏷️',hint:'Organize how expenses are grouped'},
    {id:'billing',title:'Subscription & billing',icon:'💳',hint:'Plan, payments and AI allowance'},
    {id:'security',title:'Profile & security',icon:'🔐',hint:'Your details, password and sign-in verification'},
    {id:'appearance',title:'Appearance',icon:'🎨',hint:'Theme and display preferences'},
    {id:'offline',title:'Offline & device',icon:'📱',hint:'Offline PIN and session settings'}
  ];
  const pages = {};
  const home = document.createElement('div');
  home.className = 'spend-settings-home';
  home.id = 'spendSettingsHome';
  const header = root.querySelector('h1');
  if (header) header.textContent = 'Settings';
  const subtitle = header && header.nextElementSibling;
  if (subtitle && subtitle.tagName === 'P') subtitle.textContent = 'Manage your expense accounts, preferences and subscription.';

  for (const g of groups) {
    const button = document.createElement('button');
    button.type='button';
    button.className='spend-settings-link';
    button.innerHTML='<span class="spend-settings-icon" aria-hidden="true">'+g.icon+'</span><span><strong>'+g.title+'</strong><small>'+g.hint+'</small></span><span class="spend-settings-chevron" aria-hidden="true">›</span>';
    button.addEventListener('click',()=>open(g.id));
    home.appendChild(button);
    const page = document.createElement('div');
    page.className='spend-settings-page';
    page.id='spendSettings-'+g.id;
    page.hidden=true;
    const back=document.createElement('button');
    back.type='button';back.className='back spend-settings-back';back.textContent='← All settings';
    back.addEventListener('click',()=>open(null));
    const h=document.createElement('h2');h.textContent=g.title;
    page.append(back,h);
    pages[g.id]=page;
  }
  // Move existing settings elements rather than recreating forms, preserving their
  // IDs, listeners, permission checks and integration points.
  let section='appearance';
  const children=Array.from(originalPanel.children);
  for(const el of children){
    if(el.tagName==='H3'){
      const title=el.textContent.trim().toLowerCase();
      if(title==='categories')section='categories';
      else if(title==='account & security')section='security';
      else if(title==='shared access')section='accounts';
      if(title==='appearance'||title==='categories'||title==='account & security'||title==='shared access'){
        el.remove();continue;
      }
    }
    if(el.id==='spendBillingPanel')section='billing';
    if(el.querySelector && el.querySelector('h3')?.textContent.trim()==='Offline access & session')section='offline';
    pages[section].appendChild(el);
    if(section==='billing')section='categories'; // following Account & security heading sets the next section
    if(section==='offline')section='security'; // Shared access heading will switch to accounts
  }
  originalPanel.remove();
  root.append(home,...groups.map(g=>pages[g.id]));

  const billing = pages.billing.querySelector('#spendBillingPanel');
  if(billing){
    const note=billing.querySelector('p.note');
    if(note)note.textContent='See your subscription, included AI processing allowance and billing options. Members who already subscribe are not charged twice.';
    const allNotes=billing.querySelectorAll('p.note');
    if(allNotes.length>1)allNotes[allNotes.length-1].hidden=true;
  }
  // SMS MFA is not launched. Remove its informational controls from the
  // rendered Settings UI, while retaining the working authenticator-app 2FA.
  const mfa=pages.security.querySelector('#spendMfaEnable');
  if(mfa){
    const panel=mfa.closest('.panel');
    if(panel){
      for(const row of panel.querySelectorAll('.row')){
        if(row.textContent.includes('SMS verification'))row.remove();
      }
      for(const note of panel.querySelectorAll('p.note')){
        if(note.textContent.includes('SMS will only'))note.remove();
      }
    }
  }

  function open(id){
    const isDetail=!!id;
    home.hidden=isDetail;
    for(const g of groups)pages[g.id].hidden=g.id!==id;
    // Only one back link and one heading should be visible at a time.
    const dashboardBack=root.querySelector(':scope > .back');
    if(dashboardBack){
      dashboardBack.hidden=isDetail;
      dashboardBack.textContent='← Back to dashboard';
      dashboardBack.onclick=()=>window.go('home');
    }
    if(header)header.hidden=isDetail;
    if(subtitle&&subtitle.tagName==='P')subtitle.hidden=isDetail;
    window.scrollTo(0,0);
  }
  window.spendSettingsOpen=open;
  const priorGo=window.go;
  if(typeof priorGo==='function'){
    window.go=function(id){
      if(id==='configure')open(null);
      const result=priorGo.apply(this,arguments);
      updateNav(id);
      return result;
    };
  }
  window.openSpendSharing=function(){
    window.go('configure');
    open('accounts');
    const target=document.getElementById('spendSharingSection');
    if(target)target.scrollIntoView({block:'start',behavior:'smooth'});
  };

  const nav=document.createElement('nav');
  nav.className='spend-mobile-nav';
  nav.setAttribute('aria-label','Main navigation');
  const navItems=[['home','⌂','Home'],['scan','📷','Scan'],['track','▤','Expenses'],['alerts','♧','Alerts'],['configure','⚙','Settings']];
  for(const [id,icon,label] of navItems){
    const b=document.createElement('button');b.type='button';b.dataset.view=id;
    b.innerHTML='<span aria-hidden="true">'+icon+'</span>'+label;
    b.setAttribute('aria-label',label);
    b.addEventListener('click',()=>window.go(id));
    nav.appendChild(b);
  }
  document.body.appendChild(nav);
  function updateNav(id){
    for(const b of nav.querySelectorAll('button')){
      if(b.dataset.view===id)b.setAttribute('aria-current','page');
      else b.removeAttribute('aria-current');
    }
  }
  updateNav(document.querySelector('.view.active')?.id||'home');
  // Preserve the original Settings access points, but use familiar wording.
  for(const tile of document.querySelectorAll('#home .tile')){
    if(tile.getAttribute('onclick')==="go('configure')"){
      const title=tile.querySelector('strong'),hint=tile.querySelector('small');
      if(title)title.textContent='Settings';
      if(hint)hint.textContent='Accounts, preferences & billing';
    }
  }
})();
