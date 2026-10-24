/* ZeroHours Spend recycle bin: deleted expenses can be restored for 30 days. */
let spendRecycleRows=[];
function spendRecycleDaysLeft(value){
 const days=Math.ceil((new Date(value).getTime()+30*86400000-Date.now())/86400000);
 return Math.max(0,days);
}
async function loadSpendRecycleBin(){
 const list=document.getElementById('spendRecycleList');
 if(!list||!currentUser)return;
 if(!navigator.onLine){list.innerHTML='<p>Connect to the internet to view or restore deleted expenses.</p>';return}
 list.innerHTML='<p>Loading deleted expenses…</p>';
 const {data,error}=await sb.from('expenses')
  .select('id,user_id,merchant,amount,spent_on,category,deleted_at')
  .eq('user_id',activeSpendOwner()).eq('account_id',activeSpendAccount()).not('deleted_at','is',null)
  .gt('deleted_at',new Date(Date.now()-30*86400000).toISOString())
  .order('deleted_at',{ascending:false});
 if(error){list.textContent='Unable to load recycle bin: '+error.message;return}
 spendRecycleRows=data||[];
 renderSpendRecycleBin();
}
function renderSpendRecycleBin(){
 const list=document.getElementById('spendRecycleList');if(!list)return;
 const canRestore=canDeleteSpendExpense();
 document.getElementById('spendRecycleCount').textContent=spendRecycleRows.length+' deleted expense'+(spendRecycleRows.length===1?'':'s');
 list.innerHTML=spendRecycleRows.length?spendRecycleRows.map(e=>{
  const days=spendRecycleDaysLeft(e.deleted_at);
  return '<div class="row"><div><strong>'+escapeHTML(e.merchant)+'</strong><small>'+escapeHTML(e.spent_on)+' · '+escapeHTML(e.category)+' · '+days+' day'+(days===1?'':'s')+' remaining</small></div><div style="display:flex;align-items:center;gap:12px"><strong>'+money(Number(e.amount))+'</strong>'+(canRestore?'<button class="muted" onclick="restoreSpendExpense(\''+e.id+'\')">Restore</button>':'<span class="pill">Owner permission required</span>')+'</div></div>';
 }).join(''):'<p>Your recycle bin is empty.</p>';
}
async function restoreSpendExpense(id){
 if(!navigator.onLine){alert('Connect to restore an expense.');return}
 if(!canDeleteSpendExpense()){alert('The account owner has not granted permission to restore expenses.');return}
 const expense=spendRecycleRows.find(e=>e.id===id);if(!expense)return;
 if(!confirm('Restore '+expense.merchant+' ('+money(Number(expense.amount))+') to expenses?'))return;
 const {data,error}=await sb.rpc('spend_restore_expense',{p_expense_id:id});
 if(error||!data){alert(error?.message||'Expense could not be restored. It may have expired or your permissions changed.');await loadSpendRecycleBin();return}
 await loadCloudExpenses();await loadSpendRecycleBin();
}
