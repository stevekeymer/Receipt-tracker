import {reply,getUser,currentBilling,stripe,stripeKeyReady} from './_lib.js';
export async function onRequestPost({request,env}){
 try{
  if(!stripeKeyReady(env))return reply({error:'Test billing is not configured yet.'},503);
  const {user,auth}=await getUser(request);
  const b=await currentBilling(user.id,auth);
  if(!b?.stripe_customer_id)return reply({error:'No billing customer found. Subscribe first.'},404);
  const session=await stripe(env,'billing_portal/sessions',{customer:b.stripe_customer_id,return_url:'https://spend.zerohours.ca/'});
  return reply({url:session.url});
 }catch(e){return reply({error:e.message||'Could not open billing portal.'},400)}
}
