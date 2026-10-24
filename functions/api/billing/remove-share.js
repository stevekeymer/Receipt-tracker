import {reply,getUser,supabaseGet,rpc,stripeKeyReady,reconcileOwner,reconcileMemberSponsors} from './_lib.js';
export async function onRequestPost({request,env}){
 try{
  if(!stripeKeyReady(env))return reply({error:'Test billing is not configured yet.'},503);
  const {user,auth}=await getUser(request);
  const {share_id}=await request.json().catch(()=>({}));
  if(!/^[0-9a-f-]{36}$/i.test(share_id||''))return reply({error:'Invalid invitation.'},400);
  const rows=await supabaseGet('spend_shares?id=eq.'+encodeURIComponent(share_id)+'&select=id,owner_id,member_id',auth);
  const share=rows[0];
  if(!share||(share.owner_id!==user.id&&share.member_id!==user.id))return reply({error:'Shared access not found.'},404);
  await rpc('spend_remove_share',{p_id:share_id},auth);
  // Share removal must remain successful even if Stripe is temporarily unavailable.
  try{
   const owners=new Set([share.owner_id]);
   if(share.member_id){
    const changes=await reconcileMemberSponsors(env,share.member_id);
    for(const change of changes)owners.delete(change.owner);
   }
   for(const owner of owners)await reconcileOwner(env,owner);
   return reply({removed:true,billing_synced:true});
  }catch(syncError){
   console.error('Shared access removed, but hybrid seat reconciliation needs retry:',syncError);
   return reply({removed:true,billing_synced:false,warning:'Shared access removed. Seat billing needs reconciliation.'});
  }
 }catch(e){return reply({error:e.message||'Unable to remove shared access.'},400)}
}
