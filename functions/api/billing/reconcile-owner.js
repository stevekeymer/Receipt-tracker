import {reply,getUser,supabaseGet,stripeKeyReady,reconcileMemberSponsors} from './_lib.js';
export async function onRequestPost({request,env}){
 try{
  if(!stripeKeyReady(env))return reply({error:'Test billing is not configured yet.'},503);
  const {user,auth}=await getUser(request);
  const {account_id}=await request.json().catch(()=>({}));
  if(!/^[0-9a-f-]{36}$/i.test(account_id||''))return reply({error:'Invalid expense account.'},400);
  const shares=await supabaseGet('spend_shares?account_id=eq.'+encodeURIComponent(account_id)+'&member_id=eq.'+encodeURIComponent(user.id)+'&status=eq.active&select=owner_id',auth);
  if(!shares.length)return reply({error:'You are not an active member of this expense account.'},403);
  const changes=await reconcileMemberSponsors(env,user.id);
  return reply({updated:true,changes});
 }catch(e){return reply({error:e.message||'Could not synchronize seats.'},400)}
}
