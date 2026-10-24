import {reply,getUser,rpc,currentBilling,stripe,stripeKeyReady,TEST_PRICE,serviceRead} from './_lib.js';
export async function onRequestPost({request,env}){
 try{
  if(!stripeKeyReady(env))return reply({error:'Test billing is not configured yet. Add Stripe test and Supabase server secrets.'},503);
  const {user,auth}=await getUser(request);
  const existing=await currentBilling(user.id,auth);
  if(existing?.status==='active'||existing?.status==='trialing')return reply({error:'Your subscription is already active. Open Manage billing instead.'},409);
  const seats=await rpc('spend_my_billable_seats',{},auth);
  if(!Number.isInteger(seats)||seats<1||seats>10000)throw Error('Invalid billable seat count.');
  const trialHistory=await serviceRead(env,'spend_trial_history','user_id=eq.'+encodeURIComponent(user.id),'user_id');
  const eligibleForTrial=trialHistory.length===0&&!existing?.stripe_subscription_id;
  const origin='https://spend.zerohours.ca';
  const p={
   mode:'subscription',success_url:origin+'/?billing=success',cancel_url:origin+'/?billing=cancel',
   client_reference_id:user.id,'metadata[owner_id]':user.id,'subscription_data[metadata][owner_id]':user.id,
   'line_items[0][price]':TEST_PRICE,'line_items[0][quantity]':String(seats),
   'allow_promotion_codes':'true',
   'payment_method_collection':'always',
   'billing_address_collection':'auto'
  };
  if(eligibleForTrial){
   p['subscription_data[trial_period_days]']='7';
   p['subscription_data[trial_settings][end_behavior][missing_payment_method]']='cancel';
  }
  if(existing?.stripe_customer_id)p.customer=existing.stripe_customer_id;
  else p.customer_email=user.email;
  const session=await stripe(env,'checkout/sessions',p);
  return reply({url:session.url,seats,amount_cad:seats*9.99,trial:eligibleForTrial});
 }catch(e){return reply({error:e.message||'Unable to create checkout session.'},400)}
}
