/* ZeroHours Spend: accessible product editor labels and mobile layout.
   Enhances the existing editor without changing draft item storage or save logic. */
(function(){
 'use strict';
 const editor=document.getElementById('itemEditor');
 if(!editor||typeof window.renderItemEditor!=='function')return;
 const style=document.createElement('style');
 style.textContent=`
 #itemEditor .spend-product-row{display:grid;grid-template-columns:minmax(0,2fr) minmax(90px,.8fr) minmax(110px,1fr) minmax(150px,1.2fr) auto;gap:12px;align-items:end;margin:12px 0 16px;padding:16px;background:#f8faff;border:1px solid #e2e8f1;border-radius:14px}
 #itemEditor .spend-product-field{display:flex;flex-direction:column;gap:7px;min-width:0}
 #itemEditor .spend-product-field>label{font-size:13px;font-weight:750;color:#34425b}
 #itemEditor .spend-product-field>input,#itemEditor .spend-product-field>select{width:100%;max-width:none!important;min-width:0;margin:0}
 #itemEditor .spend-product-remove{min-height:44px;white-space:nowrap}
 body.dark #itemEditor .spend-product-row{background:#222c42;border-color:#43506a}
 body.dark #itemEditor .spend-product-field>label{color:#dce6f7}
 @media(max-width:780px){
 #itemEditor .spend-product-row{grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px;padding:14px}
 #itemEditor .spend-product-field:first-child{grid-column:1/-1}
 #itemEditor .spend-product-field:nth-child(4){grid-column:1/-1}
 #itemEditor .spend-product-remove{grid-column:1/-1;justify-self:start}
 }
 `;
 document.head.appendChild(style);
 const original=window.renderItemEditor;
 window.renderItemEditor=function(){
  original.apply(this,arguments);
  const rows=Array.from(editor.children);
  for(const row of rows){
   if(row.classList.contains('spend-product-row'))continue;
   row.classList.add('spend-product-row');
   row.classList.remove('toolbar');
   row.style.marginBottom='';
   const fields=Array.from(row.children);
   for(const field of fields){
    if(field.tagName==='BUTTON'){
     field.classList.add('spend-product-remove');
     field.textContent='Remove product';
     field.setAttribute('aria-label','Remove product');
     continue;
    }
    const title=field.getAttribute('aria-label')==='Product name'?'Product name':
     field.getAttribute('aria-label')==='Quantity'?'Quantity':
     field.getAttribute('aria-label')==='Product total (CAD)'?'Total price (CAD)':
     field.getAttribute('aria-label')==='Product category'?'Category':'Detail';
    const wrap=document.createElement('div');
    wrap.className='spend-product-field';
    const label=document.createElement('label');
    label.textContent=title;
    field.id='spend-product-'+title.toLowerCase().replace(/[^a-z]+/g,'-')+'-'+Array.from(editor.children).indexOf(row);
    label.htmlFor=field.id;
    field.removeAttribute('style');
    field.before(wrap);
    wrap.append(label,field);
   }
  }
 };
 window.renderItemEditor();
 const section=editor.closest('.field');
 if(section){
  const notes=section.querySelectorAll('p.note');
  if(notes[0])notes[0].textContent='Optional: add individual products to track what you buy. Enter the quantity and total price for each product. Receipt scanning may fill these details automatically.';
  if(notes[1])notes[1].textContent='Product alerts use these names to track spending on specific items.';
 }
})();
