import {reply,stripe,adminUpsert,TEST_PRICE,reconcileMemberSponsors,reconcileOwnerMemberSponsors} from './_lib.js';
const encoder=new TextEncoder();
function hex(bytes){return Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('')}
async function validSignature(body,header,secret){
 const parts=Object.fromEntries((header||'').split(',').map(x=>x.split('=')));
 const timestamp=Number(parts.t);
 if(!timestamp||Math.abs(Date.now()/1000-timestamp)>300)return false;
 const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const digest=hex(await crypto.subtle.sign('HMAC',key,encoder.encode(parts.t+'.'+body)));
 // Stripe can send multiple v1 signatures.
 const signatures=(header||'').split(',').filter(x=>x.startsWith('v1=')).map(x=>x.slice(3));
 return signatures.some(s=>s.length===digest.length&&[...s].reduce((diff,c,i)=>diff|(c.charCodeAt(0)^digest.charCodeAt(i)),0)===0);
}
async function updateSubscription(env,sub,owner){
 if(!owner||!sub?.id)throw Error('Missing owner or subscription ID.');
 if(sub.livemode)throw Error('Live subscription events are disabled.');
 const item=sub.items?.data?.find(i=>i.price?.id===TEST_PRICE);
 if(!item)throw Error('Subscription is not a ZeroHours Spend seat plan.');
 const periodStart=item.current_period_start||sub.current_period_start;
 const periodEnd=item.current_period_end||sub.current_period_end;
 const toDate=t=>typeof t==='number'?new Date(t*1000).toISOString():null;
 await adminUpsert(env,'spend_billing_subscriptions',{
  owner_id:owner,stripe_customer_id:typeof sub.customer==='string'?sub.customer:sub.customer?.id,
  stripe_subscription_id:sub.id,stripe_price_id:TEST_PRICE,
  status:sub.status,seats:item.quantity||1,
  trial_start:toDate(sub.trial_start),trial_end:toDate(sub.trial_end),
  current_period_start:toDate(periodStart),current_period_end:toDate(periodEnd),
  cancel_at_period_end:!!sub.cancel_at_period_end,environment:'test',updated_at:new Date().toISOString()
 });
 if(sub.trial_start&&sub.trial_end){
  const res=await fetch('https://pbbqmedwddfmnlmnsxtx.supabase.co/rest/v1/spend_trial_history?on_conflict=user_id',{
   method:'POST',headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY,'content-type':'application/json',prefer:'resolution=ignore-duplicates,return=minimal'},
   body:JSON.stringify({user_id:owner,stripe_subscription_id:sub.id,activated_at:toDate(sub.trial_start),trial_end:toDate(sub.trial_end)})
  });
  if(!res.ok)throw Error('Could not record trial activation ('+res.status+').');
 }
}
export async function onRequestPost({request,env}){
 if(!env.STRIPE_WEBHOOK_SECRET||!env.SUPABASE_SERVICE_ROLE_KEY||!env.STRIPE_SECRET_KEY?.startsWith('sk_test_'))return reply({error:'Test billing webhook not configured.'},503);
 const raw=await request.text();
 if(!await validSignature(raw,request.headers.get('stripe-signature'),env.STRIPE_WEBHOOK_SECRET))return reply({error:'Invalid Stripe signature.'},400);
 let event;try{event=JSON.parse(raw)}catch{return reply({error:'Invalid payload.'},400)}
 if(event.livemode!==false)return reply({error:'Live Stripe events are not accepted.'},400);
 try{
  if(event.type==='checkout.session.completed'){
   const session=event.data?.object;
   if(session.mode==='subscription'&&session.subscription){
    const sub=await stripe(env,'subscriptions/'+encodeURIComponent(session.subscription),null,'GET');
    const owner=sub.metadata?.owner_id||session.client_reference_id;
    await updateSubscription(env,sub,owner);
    await reconcileMemberSponsors(env,owner);
    await reconcileOwnerMemberSponsors(env,owner);
   }
  }else if(['customer.subscription.created','customer.subscription.updated','customer.subscription.deleted'].includes(event.type)){
   const object=event.data?.object;
   if(object?.metadata?.owner_id){
    // Retrieve canonical state to avoid stale/out-of-order event payloads.
    const sub=await stripe(env,'subscriptions/'+encodeURIComponent(object.id),null,'GET');
    await updateSubscription(env,sub,object.metadata.owner_id);
    await reconcileMemberSponsors(env,object.metadata.owner_id);
    await reconcileOwnerMemberSponsors(env,object.metadata.owner_id);
   }
  }
  return reply({received:true});
 }catch(e){return reply({error:'Webhook processing failed: '+e.message},500)}
}
