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
 if(!confirm('Request to change your sign-in email to '+email+'? Verification may be required at both addresses.'))return;
 button.disabled=true;
 try{
  const {error}=await sb.auth.updateUser({email});
  if(error)throw error;
  spendAccountNotice('Email change requested. Follow the verification instructions sent to your email address(es). Your existing email stays active until confirmed.');
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
