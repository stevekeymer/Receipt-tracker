export const SUPABASE_URL='https://pbbqmedwddfmnlmnsxtx.supabase.co';
export const SUPABASE_PUBLIC_KEY='sb_publishable_eNkrJqt7TAQnuffUXftOTg_OeibVV-Z';
export const TEST_PRICE='price_1UTw2PFmszEXwvfMa1ZTFtwW';
export const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
export function stripeReady(env){return !!(env.STRIPE_SECRET_KEY?.startsWith('sk_test_')&&env.SUPABASE_SERVICE_ROLE_KEY&&env.STRIPE_WEBHOOK_SECRET)}
export function stripeKeyReady(env){return !!(env.STRIPE_SECRET_KEY?.startsWith('sk_test_')&&env.SUPABASE_SERVICE_ROLE_KEY)}
export async function getUser(request){
 const auth=request.headers.get('authorization')||'';
 if(!auth.startsWith('Bearer '))throw Error('Sign in first.');
 const res=await fetch(SUPABASE_URL+'/auth/v1/user',{headers:{apikey:SUPABASE_PUBLIC_KEY,authorization:auth}});
 if(!res.ok)throw Error('Session expired.');
 const user=await res.json();
 if(!user?.id)throw Error('Session expired.');
 return {user,auth};
}
export async function supabaseGet(path,auth){
 const r=await fetch(SUPABASE_URL+'/rest/v1/'+path,{headers:{apikey:SUPABASE_PUBLIC_KEY,authorization:auth,accept:'application/json'}});
 if(!r.ok)throw Error('Unable to read billing records.');
 return r.json();
}
export async function rpc(name,body,auth){
 const r=await fetch(SUPABASE_URL+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:SUPABASE_PUBLIC_KEY,authorization:auth,'content-type':'application/json'},body:JSON.stringify(body)});
 const data=await r.json().catch(()=>({}));
 if(!r.ok)throw Error(data.message||'Unable to check seat count.');
 return data;
}
export async function adminUpsert(env,table,record){
 const r=await fetch(SUPABASE_URL+'/rest/v1/'+table+'?on_conflict=owner_id',{method:'POST',headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY,'content-type':'application/json',prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(record)});
 if(!r.ok)throw Error('Billing database update failed ('+r.status+').');
}
export async function stripe(env,path,params,method='POST'){
 if(!env.STRIPE_SECRET_KEY?.startsWith('sk_test_'))throw Error('Test-mode Stripe key not configured.');
 const headers={authorization:'Bearer '+env.STRIPE_SECRET_KEY};
 const opts={method,headers};
 if(params&&method!=='GET'){headers['content-type']='application/x-www-form-urlencoded';opts.body=new URLSearchParams(params).toString()}
 const r=await fetch('https://api.stripe.com/v1/'+path,opts);
 const data=await r.json().catch(()=>({}));
 if(!r.ok)throw Error(data.error?.message||'Stripe request failed.');
 if(data.livemode===true)throw Error('Live Stripe objects are not allowed in this test integration.');
 return data;
}
export async function currentBilling(owner,auth){
 const rows=await supabaseGet('spend_billing_subscriptions?owner_id=eq.'+encodeURIComponent(owner)+'&select=*',auth);
 return rows[0]||null;
}
export async function requireAal2IfNeeded(auth){
 const r=await fetch(SUPABASE_URL+'/auth/v1/factors',{headers:{apikey:SUPABASE_PUBLIC_KEY,authorization:auth}});
 // Database RLS protects billing reads; MFA assurance is enforced by the spend_mfa_authorized function.
 return r.ok;
}

export async function serviceRead(env,table,filter,columns='*'){
 const url=SUPABASE_URL+'/rest/v1/'+table+'?'+filter+'&select='+encodeURIComponent(columns);
 const res=await fetch(url,{headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY}});
 if(!res.ok)throw Error('Billing member lookup failed.');
 return res.json();
}
export async function serviceSeats(env,owner){
 const res=await fetch(SUPABASE_URL+'/rest/v1/rpc/spend_billable_seats',{method:'POST',headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY,'content-type':'application/json'},body:JSON.stringify({p_owner:owner})});
 if(!res.ok)throw Error('Could not calculate hybrid seats.');
 return res.json();
}
export async function reconcileOwner(env,owner){
 const bills=await serviceRead(env,'spend_billing_subscriptions','owner_id=eq.'+encodeURIComponent(owner));
 const bill=bills[0];
 if(!bill?.stripe_subscription_id||!['active','trialing','past_due'].includes(bill.status)||bill.environment!=='test')return {owner,skipped:true};
 const count=await serviceSeats(env,owner);
 const sub=await stripe(env,'subscriptions/'+encodeURIComponent(bill.stripe_subscription_id),null,'GET');
 const item=sub.items?.data?.find(i=>i.price?.id===TEST_PRICE);
 if(!item)throw Error('Subscription seat item missing.');
 if(item.quantity!==count){
  await stripe(env,'subscription_items/'+encodeURIComponent(item.id),{quantity:String(count),proration_behavior:'create_prorations'});
 }
 return {owner,seats:count,updated:item.quantity!==count};
}
export async function reconcileMemberSponsors(env,member){
 // An individual can be covered by only one subscription. Reconcile every owner
 // sharing an account with them when their subscription status changes.
 const shares=await serviceRead(env,'spend_shares','member_id=eq.'+encodeURIComponent(member)+'&status=eq.active','owner_id');
 const owners=[...new Set(shares.map(s=>s.owner_id))];
 const result=[];
 for(const owner of owners)result.push(await reconcileOwner(env,owner));
 return result;
}
