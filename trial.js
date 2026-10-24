/* Trial/payment access gate. Authentication is allowed for checkout, app access is not. */
let spendTrialState=null;
function spendTrialOverlay(message,canTrial=true){
 const overlay=document.getElementById('spendTrialGate');
 if(!overlay)return;
 document.getElementById('spendTrialDescription').textContent=message;
 document.getElementById('spendTrialCheckout').textContent=canTrial?'Activate 7-day trial — card required':'Subscribe for $9.99 CAD/month';
 overlay.style.display='grid';
}
async function spendCheckEntitlement(){
 if(!navigator.onLine){spendTrialOverlay('An internet connection is required to verify your subscription.');return false}
 try{
  const {data,error}=await sb.rpc('spend_my_entitlement');
  if(error)throw error;
  spendTrialState=data;
  if(data?.allowed){
   document.getElementById('spendTrialGate').style.display='none';
   return true;
  }
  const eligible=data?.reason==='trial_available';
  spendTrialOverlay(eligible
   ?'Start your 7-day free trial with a payment card in Stripe test mode. Your card will not be charged during the trial. After 7 days, the test subscription renews at $9.99 CAD per user per month unless cancelled. The trial includes a $1 CAD total AI processing allowance.'
   :'Your free trial has ended or was already used. Subscribe to continue accessing your expense accounts. Your saved data remains intact.',eligible);
  return false;
 }catch(e){
  spendTrialOverlay('Could not verify your subscription. Check your connection and try again.');
  console.error('Subscription access check failed',e);
  return false;
 }
}
async function spendTrialCheckout(){
 const button=document.getElementById('spendTrialCheckout');
 button.disabled=true;
 const msg=document.getElementById('spendTrialError');
 msg.textContent='';
 try{
  const result=await spendBillingRequest('checkout');
  if(!result.url)throw Error('Stripe Checkout did not return a URL.');
  location.assign(result.url);
 }catch(e){msg.textContent=e.message||'Unable to open Stripe Checkout';button.disabled=false}
}
async function spendTrialSignOut(){
 await sb.auth.signOut();
 location.reload();
}
async function spendTrialRetry(){
 if(await spendCheckEntitlement())location.reload();
}

/* Revalidate open sessions so an expired trial does not keep the app unlocked. */
async function spendRevalidateAccess(){
 if(!currentUser||document.getElementById('authGate')?.style.display!=='none')return;
 await spendCheckEntitlement();
}
setInterval(spendRevalidateAccess,60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)spendRevalidateAccess()});

/* Load the Settings UI enhancement after the main dashboard has initialized. */
document.addEventListener('DOMContentLoaded',()=>{
 // Check for new versions on every app launch, not only when enabling push.
 if('serviceWorker' in navigator){
   navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'})
     .then(reg=>reg.update()).catch(err=>console.warn('App update check unavailable',err));
 }
 const script=document.createElement('script');
 script.src='/settings-ui.js?v=1';
 script.onerror=()=>console.warn('Settings UI enhancement unavailable; standard settings remain accessible.');
 document.body.appendChild(script);
 const productScript=document.createElement('script');
 productScript.src='/product-ui.js?v=2';
 document.body.appendChild(productScript);
 // Public product information is accessible without signing in.
 const authPanel=document.querySelector('#authGate > .panel');
 if(authPanel&&!document.getElementById('spendLearnMore')){
   const link=document.createElement('a');
   link.id='spendLearnMore';
   link.href='/features.html';
   link.textContent='Learn about ZeroHours Spend';
   link.style.cssText='display:block;text-align:center;margin-top:14px;font-size:14px;color:#625cdd;font-weight:700';
   authPanel.appendChild(link);
 }
});
