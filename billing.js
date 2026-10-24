/* ZeroHours Spend test-mode subscriptions. Never sends live payments. */
const spendBillingPrice=9.99;
function spendBillingMessage(message,error=false){
 const el=document.getElementById('spendBillingMessage');if(!el)return;
 el.textContent=message||'';el.style.color=error?'#db7882':'#5eb8a5';
}
async function spendBillingRequest(path){
 const {data:{session}}=await sb.auth.getSession();
 if(!session)throw Error('Sign in to manage billing.');
 const res=await fetch('/api/billing/'+path,{method:'POST',headers:{authorization:'Bearer '+session.access_token}});
 const body=await res.json().catch(()=>({}));
 if(!res.ok)throw Error(body.error||'Billing request failed.');
 return body;
}
async function spendLoadBilling(){
 if(!currentUser||!navigator.onLine)return;
 const state=document.getElementById('spendBillingState'),seatsEl=document.getElementById('spendBillingSeats');
 if(!state||!seatsEl)return;
 try{
  const [bill,seats]=await Promise.all([
   sb.from('spend_billing_subscriptions').select('status,seats,cancel_at_period_end,current_period_end,environment').eq('owner_id',currentUser.id).maybeSingle(),
   sb.rpc('spend_my_billable_seats')
  ]);
  if(bill.error)throw bill.error;if(seats.error)throw seats.error;
  const count=Number(seats.data)||1,record=bill.data;
  seatsEl.textContent=count+' billable user'+(count===1?'':'s')+' × $9.99 = $'+(count*spendBillingPrice).toFixed(2)+' CAD/month before taxes';
  state.textContent=record?.status&&record.status!=='inactive'
   ?'Stripe test subscription: '+record.status+(record.cancel_at_period_end?' · Cancels at period end':'')+'.'
   :'No test subscription yet. Existing app access is unchanged.';
  document.getElementById('spendBillingCheckout').hidden=!!record&&['active','trialing'].includes(record.status);
  document.getElementById('spendBillingPortal').hidden=!record?.status||record.status==='inactive';
  document.getElementById('spendBillingSync').hidden=!record||!['active','trialing','past_due'].includes(record.status);
  const {data:usage,error:usageError}=await sb.from('spend_ai_usage').select('status,actual_cad_cents,reserved_cad_cents,period_start').eq('user_id',currentUser.id).eq('period_start',new Date().toISOString().slice(0,7)+'-01');
  if(!usageError){
   const used=(usage||[]).reduce((sum,x)=>sum+(x.status==='reserved'?x.reserved_cad_cents:x.status==='completed'?x.actual_cad_cents:0),0);
   document.getElementById('spendBillingAI').textContent='AI budget (across all accounts): $'+(used/100).toFixed(2)+' / $4.00 CAD this calendar month';
  }
 }catch(e){spendBillingMessage('Unable to load billing: '+e.message,true)}
}
async function spendBillingAction(action){
 const button=document.getElementById(action==='checkout'?'spendBillingCheckout':action==='portal'?'spendBillingPortal':'spendBillingSync');
 button.disabled=true;spendBillingMessage('');
 try{
  const result=await spendBillingRequest(action==='sync'?'sync-seats':action);
  if(result.url){location.assign(result.url);return}
  spendBillingMessage('Seat count synchronized: '+result.seats+' paid user(s).');
  await spendLoadBilling();
 }catch(e){spendBillingMessage(e.message,true)}
 finally{button.disabled=false}
}
