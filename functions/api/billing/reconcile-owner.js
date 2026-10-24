import {reply,getUser,supabaseGet,stripe,stripeKeyReady,SUPABASE_URL} from './_lib.js';
export async function onRequestPost({request,env}){
 try{
  if(!stripeKeyReady(env))return reply({error:'Test billing is not configured yet.'},503);
  const {user,auth}=await getUser(request);
  const {account_id}=await request.json().catch(()=>({}));
  if(!/^[0-9a-f-]{36}$/i.test(account_id||''))return reply({error:'Invalid expense account.'},400);
  const shares=await supabaseGet('spend_shares?account_id=eq.'+encodeURIComponent(account_id)+'&member_id=eq.'+encodeURIComponent(user.id)+'&status=eq.active&select=owner_id',auth);
  if(!shares.length)return reply({error:'You are not an active member of this expense account.'},403);
  const owner=shares[0].owner_id,adminAuth='Bearer '+env.SUPABASE_SERVICE_ROLE_KEY;
  const hdr={apikey:env.SUPABASE_SERVICE_ROLE_KEY,authorization:adminAuth};
  const billResp=await fetch(SUPABASE_URL+'/rest/v1/spend_billing_subscriptions?owner_id=eq.'+encodeURIComponent(owner)+'&select=*',{headers:hdr});
  if(!billResp.ok)throw Error('Could not load subscription.');
  const bill=(await billResp.json())[0];
  if(!bill?.stripe_subscription_id||!['active','trialing','past_due'].includes(bill.status))return reply({updated:false});
  const seatsResp=await fetch(SUPABASE_URL+'/rest/v1/rpc/spend_billable_seats',{method:'POST',headers:{...hdr,'content-type':'application/json'},body:JSON.stringify({p_owner:owner})});
  if(!seatsResp.ok)throw Error('Could not calculate paid seats.');
  const seats=await seatsResp.json();
  const sub=await stripe(env,'subscriptions/'+encodeURIComponent(bill.stripe_subscription_id),null,'GET');
  const item=sub.items?.data?.find(i=>i.price?.id===bill.stripe_price_id);
  if(!item)throw Error('Subscription seat price not found.');
  if(item.quantity!==seats)await stripe(env,'subscription_items/'+encodeURIComponent(item.id),{quantity:String(seats),proration_behavior:'create_prorations'});
  return reply({updated:item.quantity!==seats});
 }catch(e){return reply({error:e.message||'Could not synchronize seats.'},400)}
}
