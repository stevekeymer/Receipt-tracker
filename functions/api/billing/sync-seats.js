import {reply,getUser,currentBilling,rpc,stripe,stripeKeyReady} from './_lib.js';
export async function onRequestPost({request,env}){
 try{
  if(!stripeKeyReady(env))return reply({error:'Test billing is not configured yet.'},503);
  const {user,auth}=await getUser(request);
  const b=await currentBilling(user.id,auth);
  if(!b?.stripe_subscription_id||!['active','trialing','past_due'].includes(b.status))return reply({error:'No subscription to synchronize.'},404);
  const count=await rpc('spend_my_billable_seats',{},auth);
  const subscription=await stripe(env,'subscriptions/'+encodeURIComponent(b.stripe_subscription_id),null,'GET');
  const item=subscription.items?.data?.find(i=>i.price?.id===b.stripe_price_id);
  if(!item)throw Error('Expected subscription seat price not found.');
  if(item.quantity!==count){
   await stripe(env,'subscription_items/'+encodeURIComponent(item.id),{quantity:String(count),proration_behavior:'create_prorations'});
  }
  return reply({seats:count,updated:item.quantity!==count});
 }catch(e){return reply({error:e.message||'Could not synchronize seats.'},400)}
}
