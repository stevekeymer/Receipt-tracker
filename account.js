/* ZeroHours Spend: profile and sign-in management. */
function spendAccountNotice(message,isError=false){
 const el=document.getElementById('spendProfileMessage');
 if(!el)return;
 el.textContent=message||'';
 el.style.color=isError?'#d96a72':'#147a5d';
}
async function spendLoadProfile(){
 if(!currentUser)return;
 const name=document.getElementById('spendProfileName');
 const email=document.getElementById('spendProfileEmail');
 if(name)name.value=currentUser.user_metadata?.display_name||'';
 if(email)email.value=currentUser.email||'';
 const current=document.getElementById('spendCurrentEmail');
 if(current)current.textContent=currentUser.email||'';
}
async function spendSaveProfile(event){
 event.preventDefault();
 const button=document.getElementById('spendProfileSave');
 const name=document.getElementById('spendProfileName').value.trim();
 if(name.length>100){spendAccountNotice('Name must be 100 characters or less.',true);return}
 button.disabled=true;
 try{
  const {data,error}=await sb.auth.updateUser({data:{display_name:name}});
  if(error)throw error;
  if(data.user)currentUser=data.user;
  spendAccountNotice('Profile updated successfully.');
 }catch(e){spendAccountNotice(e.message||'Unable to update your profile.',true)}
 finally{button.disabled=false}
}
async function spendChangeEmail(event){
 event.preventDefault();
 const email=document.getElementById('spendProfileEmail').value.trim().toLowerCase();
 const button=document.getElementById('spendEmailSave');
 if(!email||email===currentUser.email?.toLowerCase()){spendAccountNotice('Enter a different email address.',true);return}
 const password=document.getElementById('spendEmailPassword').value;
 if(!password){spendAccountNotice('Enter your current password to authorize this change.',true);return}
 if(!navigator.onLine){spendAccountNotice('Connect to the internet before changing your email.',true);return}
 if(!confirm('Request to change your sign-in email to '+email+'?'))return;
 button.disabled=true;
 try{
  // Verify password in an isolated, non-persistent client so the active MFA session is preserved.
  const verificationClient=window.supabase.createClient('https://pbbqmedwddfmnlmnsxtx.supabase.co','sb_publishable_eNkrJqt7TAQnuffUXftOTg_OeibVV-Z',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const {data:check,error:checkError}=await verificationClient.auth.signInWithPassword({email:currentUser.email,password});
  if(checkError||!check?.user||check.user.id!==currentUser.id)throw Error('Current password is incorrect. Email was not changed.');
  const {data:level,error:levelError}=await sb.auth.mfa.getAuthenticatorAssuranceLevel();
  if(levelError)throw levelError;
  if(level.nextLevel==='aal2'&&level.currentLevel!=='aal2')throw Error('Complete authenticator verification by signing in again before changing your email.');
  const {error}=await sb.auth.updateUser({email,emailRedirectTo:'https://spend.zerohours.ca/'});
  if(error)throw error;
  document.getElementById('spendEmailPassword').value='';
  spendAccountNotice('Email change requested. Check your new address for the confirmation link. Depending on the Supabase security setting, confirmation from the old address may also be required.');
 }catch(e){spendAccountNotice(e.message||'Unable to change your email.',true)}
 finally{button.disabled=false}
}
async function spendChangePassword(event){
 event.preventDefault();
 const next=document.getElementById('spendNewPassword').value;
 const confirmPassword=document.getElementById('spendConfirmPassword').value;
 const button=document.getElementById('spendPasswordSave');
 if(next.length<12){spendAccountNotice('Use a password with at least 12 characters.',true);return}
 if(next!==confirmPassword){spendAccountNotice('The passwords do not match.',true);return}
 if(!navigator.onLine){spendAccountNotice('Connect to the internet to update your password.',true);return}
 button.disabled=true;
 try{
  const {error}=await sb.auth.updateUser({password:next});
  if(error)throw error;
  document.getElementById('spendNewPassword').value='';
  document.getElementById('spendConfirmPassword').value='';
  spendAccountNotice('Password changed successfully.');
 }catch(e){spendAccountNotice(e.message||'Unable to change your password. You may need to reauthenticate.',true)}
 finally{button.disabled=false}
}
