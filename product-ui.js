/* ZeroHours Spend: labeled product fields for all expense-editor renders. */
(function(){
 'use strict';
 const editor=document.getElementById('itemEditor');
 if(!editor)return;
 const css=document.createElement('style');
 css.textContent=`
 #itemEditor .spend-product-row{display:grid!important;grid-template-columns:minmax(0,2fr) minmax(90px,.8fr) minmax(110px,1fr) minmax(150px,1.2fr) auto;gap:12px;align-items:end;margin:12px 0 16px!important;padding:16px;background:#f8faff;border:1px solid #e2e8f1;border-radius:14px}
 #itemEditor .spend-product-field{display:flex;flex-direction:column;gap:7px;min-width:0}
 #itemEditor .spend-product-field label{font-size:13px;font-weight:700;color:#34425b}
 #itemEditor .spend-product-field input,#itemEditor .spend-product-field select{width:100%;max-width:none!important;min-width:0;margin:0}
 #itemEditor .spend-product-remove{min-height:44px;white-space:nowrap}
 .dark #itemEditor .spend-product-row{background:#222c42;border-color:#43506a}
 .dark #itemEditor .spend-product-field label{color:#dce6f7}
 @media(max-width:780px){#itemEditor .spend-product-row{grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px;padding:14px}
 #itemEditor .spend-product-field:first-child,#itemEditor .spend-product-field:nth-child(4),#itemEditor .spend-product-remove{grid-column:1/-1}
 #itemEditor .spend-product-remove{justify-self:start}}
 `;
 document.head.appendChild(css);
 const labels={'Product name':'Product name','Quantity':'Quantity','Product total (CAD)':'Total price (CAD)','Product category':'Category'};
 function decorate(){
  for(const row of Array.from(editor.children)){
   if(row.classList.contains('spend-product-row'))continue;
   const fields=Array.from(row.children);
   if(!fields.some(el=>el.getAttribute('aria-label')==='Product name'))continue;
   row.classList.add('spend-product-row');
   row.classList.remove('toolbar');
   row.style.marginBottom='';
   for(const field of fields){
    if(field.tagName==='BUTTON'){
     field.classList.add('spend-product-remove');
     field.textContent='Remove product';
     field.setAttribute('aria-label','Remove product');
     continue;
    }
    const name=field.getAttribute('aria-label');
    if(!labels[name])continue;
    const wrap=document.createElement('div');
    wrap.className='spend-product-field';
    const label=document.createElement('label');
    label.textContent=labels[name];
    field.id='spend-product-'+name.toLowerCase().replace(/[^a-z]+/g,'-')+'-'+Array.from(editor.children).indexOf(row);
    label.htmlFor=field.id;
    field.style.maxWidth='';
    field.before(wrap);
    wrap.append(label,field);
   }
  }
 }
 const observer=new MutationObserver(()=>{observer.disconnect();try{decorate()}finally{observer.observe(editor,{childList:true,subtree:false})}});
 observer.observe(editor,{childList:true,subtree:false});
 decorate();
 const section=editor.closest('.field');
 if(section){
  const notes=section.querySelectorAll('p.note');
  if(notes[0])notes[0].textContent='Optional: track individual products. Enter the quantity and total price for each item. Receipt scanning may fill these in automatically.';
  if(notes[1])notes[1].textContent='Product alerts use these names to track spending on specific items.';
 }
})();
