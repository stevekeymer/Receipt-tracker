/* ZeroHours Spend: optional authenticator-app two-factor authentication. */
let spendMfaPendingFactor=null,spendMfaLoginUser=null,spendMfaVerified=false;
function spendMfaMessage(id,message,error=false){
 const el=document.getElementById(id);if(!el)return;
 el.textContent=message||'';el.style.color=error?'#e67b84':'#79d7b7';
}
function spendMfaShowGate(){
 document.getElementById('authGate').style.display='none';
 document.getElementById('pinGate').style.display='none';
 document.getElementById('spendMfaGate').style.display='grid';
 document.getElementById('spendMfaCode').value='';
 spendMfaMessage('spendMfaLoginMessage','');
 document.getElementById('spendMfaCode').focus();
}
async function spendMfaCheckLogin(user){
 if(!navigator.onLine)throw Error('Connect to the internet to verify your authenticator code.');
 const {data,error}=await sb.auth.mfa.getAuthenticatorAssuranceLevel();
 if(error)throw error;
 if(data.nextLevel==='aal2'&&data.currentLevel!=='aal2'){
  spendMfaLoginUser=user;spendMfaShowGate();return false;
 }
 spendMfaLoginUser=null;document.getElementById('spendMfaGate').style.display='none';
 return true;
}
async function spendMfaVerifyLogin(event){
 event.preventDefault();
 const button=document.getElementById('spendMfaLoginSubmit'),code=document.getElementById('spendMfaCode').value.trim();
 if(!/^\d{6}$/.test(code)){spendMfaMessage('spendMfaLoginMessage','Enter the six-digit code from your authenticator app.',true);return}
 button.disabled=true;
 try{
  const {data,error}=await sb.auth.mfa.listFactors();if(error)throw error;
  const factor=data.totp?.find(f=>f.status==='verified');
  if(!factor)throw Error('No verified authenticator found. Contact support for account recovery.');
  const {error:verifyError}=await sb.auth.mfa.challengeAndVerify({factorId:factor.id,code});
  if(verifyError)throw verifyError;
  const user=spendMfaLoginUser;spendMfaLoginUser=null;
  spendMfaVerified=true;
  document.getElementById('spendMfaGate').style.display='none';
  if(recoveringOfflinePin)await completePinRecovery(user);
  else await authenticated(user);
 }catch(e){spendMfaMessage('spendMfaLoginMessage',e.message||'Could not verify code. Try again.',true)}
 finally{button.disabled=false}
}
async function spendMfaCancelLogin(){
 spendMfaLoginUser=null;spendMfaVerified=false;
 await sb.auth.signOut();
 document.getElementById('spendMfaGate').style.display='none';
 document.getElementById('authGate').style.display='grid';
 switchAuth('signin');
}
async function spendMfaRefreshSettings(){
 const status=document.getElementById('spendMfaStatus'),enable=document.getElementById('spendMfaEnable'),disable=document.getElementById('spendMfaDisable');
 if(!status||!currentUser)return;
 if(!navigator.onLine){status.textContent='Connect to manage two-factor authentication.';enable.hidden=true;disable.hidden=true;return}
 try{
  const {data,error}=await sb.auth.mfa.listFactors();if(error)throw error;
  const enabled=data.totp?.filter(f=>f.status==='verified')||[];
  status.textContent=enabled.length?'Enabled · Authenticator code required when signing in':'Off · Optional. Sign in with your password only.';
  enable.hidden=enabled.length>0;disable.hidden=!enabled.length;
  if(enabled.length)document.getElementById('spendMfaSetup').hidden=true;
 }catch(e){status.textContent='Unable to check two-factor status: '+e.message}
}
async function spendMfaStartEnrollment(){
 if(!navigator.onLine){alert('Connect to the internet to enable two-factor authentication.');return}
 const button=document.getElementById('spendMfaEnable');button.disabled=true;
 try{
  const {data:factors,error:listError}=await sb.auth.mfa.listFactors();if(listError)throw listError;
  if(factors.totp?.some(f=>f.status==='verified')){await spendMfaRefreshSettings();return}
  for(const factor of factors.totp||[]){if(factor.status==='unverified')await sb.auth.mfa.unenroll({factorId:factor.id})}
  const {data,error}=await sb.auth.mfa.enroll({factorType:'totp',friendlyName:'ZeroHours Spend'});
  if(error)throw error;
  spendMfaPendingFactor=data.id;
  const img=document.getElementById('spendMfaQr');
  img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(data.totp.qr_code);
  document.getElementById('spendMfaSecret').textContent=data.totp.secret;
  document.getElementById('spendMfaSetup').hidden=false;
  spendMfaMessage('spendMfaSetupMessage','');
 }catch(e){spendMfaMessage('spendMfaSettingsMessage',e.message||'Could not start setup.',true)}
 finally{button.disabled=false}
}
async function spendMfaFinishEnrollment(event){
 event.preventDefault();
 const code=document.getElementById('spendMfaSetupCode').value.trim(),button=document.getElementById('spendMfaFinish');
 if(!spendMfaPendingFactor)return;
 if(!/^\d{6}$/.test(code)){spendMfaMessage('spendMfaSetupMessage','Enter a six-digit code.',true);return}
 button.disabled=true;
 try{
  const {error}=await sb.auth.mfa.challengeAndVerify({factorId:spendMfaPendingFactor,code});if(error)throw error;
  spendMfaPendingFactor=null;spendMfaVerified=true;
  document.getElementById('spendMfaSetup').hidden=true;
  document.getElementById('spendMfaSetupCode').value='';
  document.getElementById('spendMfaQr').removeAttribute('src');
  document.getElementById('spendMfaSecret').textContent='';
  spendMfaMessage('spendMfaSettingsMessage','Two-factor authentication is now enabled.');
  await spendMfaRefreshSettings();
 }catch(e){spendMfaMessage('spendMfaSetupMessage',e.message||'Code verification failed.',true)}
 finally{button.disabled=false}
}
async function spendMfaCancelEnrollment(){
 if(spendMfaPendingFactor){await sb.auth.mfa.unenroll({factorId:spendMfaPendingFactor});spendMfaPendingFactor=null}
 document.getElementById('spendMfaSetup').hidden=true;
 document.getElementById('spendMfaQr').removeAttribute('src');
 document.getElementById('spendMfaSecret').textContent='';
 document.getElementById('spendMfaSetupCode').value='';
}
async function spendMfaDisable(){
 if(!confirm('Turn off two-factor authentication? Your account will only require your password to sign in.'))return;
 try{
  const {data:level,error:levelError}=await sb.auth.mfa.getAuthenticatorAssuranceLevel();
  if(levelError)throw levelError;
  if(level.currentLevel!=='aal2')throw Error('Please sign out and sign back in with your authenticator code before disabling.');
  const {data,error}=await sb.auth.mfa.listFactors();if(error)throw error;
  for(const factor of data.totp?.filter(f=>f.status==='verified')||[]){
   const {error:removeError}=await sb.auth.mfa.unenroll({factorId:factor.id});if(removeError)throw removeError;
  }
  spendMfaMessage('spendMfaSettingsMessage','Two-factor authentication disabled.');
  await spendMfaRefreshSettings();
 }catch(e){spendMfaMessage('spendMfaSettingsMessage',e.message||'Unable to disable two-factor authentication.',true)}
}
