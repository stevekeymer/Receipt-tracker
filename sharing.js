/* ZeroHours Spend — account-specific sharing. Online-only for shared accounts. */
let spendWorkspaceOwner=null,spendShareRows=[],spendAccountRows=[],spendActiveAccountId=null,spendSharedAccountId=null;
function personalSpendAccount(owner){return spendAccountRows.find(a=>a.owner_id===owner&&a.is_default)}
function activeSpendOwner(){return spendWorkspaceOwner||currentUser?.id}
function sharedSpendMode(){return !!currentUser&&activeSpendOwner()!==currentUser.id}
function activeSpendAccount(){return sharedSpendMode()?spendSharedAccountId:(spendActiveAccountId||personalSpendAccount(currentUser?.id)?.id)}
function isPersonalSpendAccount(){return !sharedSpendMode()&&activeSpendAccount()===personalSpendAccount(currentUser?.id)?.id}
function activeSpendShare(){return spendShareRows.find(s=>s.account_id===activeSpendAccount()&&s.member_id===currentUser?.id&&s.status==='active')}
function canViewSpendExpenses(){return !!currentUser&&(!sharedSpendMode()||activeSpendShare()?.allow_view===true)}
function canDeleteSpendExpense(){return !!currentUser&&(!sharedSpendMode()||(activeSpendShare()?.allow_view===true&&activeSpendShare()?.allow_delete===true))}
function spendAccountName(id){return spendAccountRows.find(a=>a.id===id)?.name||'Expense account'}
function spendPermissionLabel(s){return s.allow_delete?'View, add, edit and delete':s.allow_view?'View, add and edit':'Add only'}
async function refreshSpendShares(){
 if(!currentUser||!navigator.onLine)return;
 const [{data:shares,error:shareError},{data:accounts,error:accountError}]=await Promise.all([
  sb.from('spend_shares').select('id,account_id,owner_id,member_id,invite_email,status,allow_view,allow_delete,created_at').order('created_at',{ascending:false}),
  sb.from('expense_accounts').select('id,owner_id,name,is_default,created_at').order('created_at')
 ]);
 if(shareError||accountError){console.warn('Could not load account sharing',shareError||accountError);return}
 spendShareRows=shares||[];spendAccountRows=accounts||[];
 if(!spendActiveAccountId||!spendAccountRows.some(a=>a.id===spendActiveAccountId&&a.owner_id===currentUser.id))spendActiveAccountId=personalSpendAccount(currentUser.id)?.id||null;
 if(sharedSpendMode()&&(!spendAccountRows.some(a=>a.id===spendSharedAccountId)||!activeSpendShare())){
  spendWorkspaceOwner=currentUser.id;spendSharedAccountId=null;
  expenses=[];expenseItems=[];
  const details=document.getElementById('expenseDetails');if(details)details.style.display='none';
 }
 if(sharedSpendMode()&&!canViewSpendExpenses()){expenses=[];expenseItems=[]}
 renderSpendShares();
 if(typeof render==='function')render();
}
function renderSpendShares(){
 const select=document.getElementById('spendQuickAccountSelect'),list=document.getElementById('spendSharesList');
 if(!select||!list||!currentUser)return;
 const ownedAccounts=spendAccountRows.filter(a=>a.owner_id===currentUser.id);
 const incoming=spendShareRows.filter(s=>s.member_id===currentUser.id&&s.status==='active'&&spendAccountRows.some(a=>a.id===s.account_id));
 const ownOptions=ownedAccounts.map(a=>'<option value="account:'+a.id+'">'+escapeHTML(a.name)+(a.is_default?' · Default':'')+'</option>').join('');
 const sharedOptions=incoming.map(s=>'<option value="shared:'+s.account_id+'">Shared with me · '+escapeHTML(spendAccountName(s.account_id))+'</option>').join('');
 select.innerHTML='<optgroup label="My accounts">'+ownOptions+'</optgroup>'+(incoming.length?'<optgroup label="Shared with me">'+sharedOptions+'</optgroup>':'');
 select.value=sharedSpendMode()?'shared:'+activeSpendAccount():'account:'+activeSpendAccount();
 updateSpendAccountContext();
 const inviteAccount=document.getElementById('spendInviteAccount');
 if(inviteAccount){
  const previous=inviteAccount.value;
  inviteAccount.innerHTML=ownedAccounts.map(a=>'<option value="'+a.id+'">'+escapeHTML(a.name)+'</option>').join('');
  if(ownedAccounts.some(a=>a.id===previous))inviteAccount.value=previous;
  else if(ownedAccounts.some(a=>a.id===activeSpendAccount()))inviteAccount.value=activeSpendAccount();
 }
 renderSpendAccountManager();
 const owned=spendShareRows.filter(s=>s.owner_id===currentUser.id);
 const pending=spendShareRows.filter(s=>s.status==='pending'&&s.owner_id!==currentUser.id);
 const heading=(name)=>'<h4 style="margin:22px 0 8px">'+name+'</h4>';
 const ownedRows=owned.map(s=>{
  const level=s.allow_delete?'manage':s.allow_view?'view':'capture';
  return '<div class="row" style="flex-wrap:wrap;gap:12px"><div style="flex:1;min-width:180px"><strong>'+escapeHTML(s.invite_email)+'</strong><small>'+escapeHTML(spendAccountName(s.account_id))+' · '+(s.status==='pending'?'Invitation pending':'Active access')+'</small></div>'+
  '<label style="font-size:13px">Permission<select aria-label="Permission for '+escapeHTML(s.invite_email)+'" onchange="setSpendAccess(\''+s.id+'\',this.value)" style="min-width:175px"><option value="capture"'+(level==='capture'?' selected':'')+'>Add only</option><option value="view"'+(level==='view'?' selected':'')+'>View, add and edit</option><option value="manage"'+(level==='manage'?' selected':'')+'>View, add, edit and delete</option></select></label>'+
  '<button class="muted" type="button" onclick="removeSpendShare(\''+s.id+'\')">Remove</button></div>';
 }).join('');
 const pendingRows=pending.map(s=>'<div class="row" style="flex-wrap:wrap;gap:12px"><div style="flex:1"><strong>'+escapeHTML(spendAccountName(s.account_id))+'</strong><small>Permission: '+spendPermissionLabel(s)+'</small></div><button class="primary" type="button" onclick="acceptSpendShare(\''+s.id+'\')">Accept invitation</button></div>').join('');
 const incomingRows=incoming.map(s=>'<div class="row"><div><strong>'+escapeHTML(spendAccountName(s.account_id))+'</strong><small>'+spendPermissionLabel(s)+'</small></div><button class="muted" type="button" onclick="removeSpendShare(\''+s.id+'\')">Leave</button></div>').join('');
 list.innerHTML=heading('People you invited')+(ownedRows||'<p class="note">No invitations yet. Choose an account and invite someone above.</p>')+
 heading('Invitations waiting for you')+(pendingRows||'<p class="note">No pending invitations.</p>')+
 (incoming.length?heading('Accounts shared with you')+incomingRows:'');

}
function updateSpendAccountContext(view){
 const note=document.getElementById('spendAccountContext');
 if(!note||!currentUser)return;
 const active=view||document.querySelector('.view.active')?.id||'home';
 const context=active==='scan'||active==='manual'?'New expenses will be saved here':
  active==='track'?'Showing transactions for this account':
  active==='alerts'?'Spending alerts for this account':
  active==='configure'?'Manage accounts and sharing below':'Your selected account';
 note.textContent=context+(sharedSpendMode()?' · Shared'+(canViewSpendExpenses()?'':' · Add only'):'');
}
async function inviteSpendShare(){
 if(!navigator.onLine){alert('Connect to send an invitation.');return}
 const account=document.getElementById('spendInviteAccount').value;
 const email=document.getElementById('spendInviteEmail').value.trim();
 const permission=document.getElementById('spendInvitePermission').value;
 if(!account||!email){alert('Choose an account and enter an email address.');return}
 if(!spendAccountRows.some(a=>a.id===account&&a.owner_id===currentUser?.id)){alert('Select one of your accounts.');return}
 const {error}=await sb.rpc('spend_invite_account',{p_account:account,p_email:email,p_allow_view:permission!=='capture',p_allow_delete:permission==='manage'});
 if(error){alert('Invitation failed: '+error.message);return}
 document.getElementById('spendInviteEmail').value='';
 await refreshSpendShares();
 alert('Invitation ready for '+email+'. Ask them to sign in with that address and accept '+spendAccountName(account)+' under Configure → Shared access. Invitations are not emailed automatically yet.');
}
async function setSpendAccess(id,level){
 if(!navigator.onLine){alert('Connect to change access.');renderSpendShares();return}
 const {error}=await sb.rpc('spend_set_access',{p_id:id,p_allow_view:level!=='capture',p_allow_delete:level==='manage'});
 if(error)alert('Could not update permission: '+error.message);
 await refreshSpendShares();
 if(sharedSpendMode())await loadCloudExpenses();
}
async function acceptSpendShare(id){
 if(!navigator.onLine){alert('Connect to accept an invitation.');return}
 const {error}=await sb.rpc('spend_accept_invite',{p_id:id});
 if(error){alert('Unable to accept invitation: '+error.message);return}
 await refreshSpendShares();
 const share=spendShareRows.find(s=>s.id===id);
 if(share&&confirm('Invitation accepted. Open '+spendAccountName(share.account_id)+' now?'))await switchSpendWorkspace('shared:'+share.account_id);
}
async function removeSpendShare(id){
 if(!navigator.onLine){alert('Connect to change shared access.');return}
 if(!confirm('Remove this person’s access to the selected expense account?'))return;
 const {error}=await sb.rpc('spend_remove_share',{p_id:id});
 if(error){alert('Could not remove access: '+error.message);return}
 await refreshSpendShares();
 if(sharedSpendMode())await loadCloudExpenses();
}
async function switchSpendWorkspace(value,options={}){
 if(!currentUser)return;
 if(!navigator.onLine){alert('Switching accounts requires internet.');renderSpendShares();return}
 const previous=activeSpendAccount(),wasShared=sharedSpendMode();
 if(editingId&&value!==(wasShared?'shared:':'account:')+previous){
  alert('Finish saving or cancel your edits before switching accounts.');renderSpendShares();return;
 }
 const currentView=document.querySelector('.view.active')?.id||'home';
 if(value.startsWith('account:')){
  const account=value.slice(8);
  const found=spendAccountRows.find(a=>a.id===account&&a.owner_id===currentUser.id);
  if(!found){alert('Account not found.');renderSpendShares();return}
  spendWorkspaceOwner=currentUser.id;spendSharedAccountId=null;spendActiveAccountId=account;
 }else if(value.startsWith('shared:')){
  const account=value.slice(7);
  const found=spendAccountRows.find(a=>a.id===account);
  const share=spendShareRows.find(s=>s.account_id===account&&s.member_id===currentUser.id&&s.status==='active');
  if(!found||!share){alert('Shared access is no longer available.');renderSpendShares();return}
  spendWorkspaceOwner=found.owner_id;spendSharedAccountId=account;
 }else{return}
 const changed=previous!==activeSpendAccount()||wasShared!==sharedSpendMode();
 if(changed){
  document.getElementById('expenseDetails').style.display='none';
  await loadCloudExpenses();
 }
 renderSpendShares();
 const target=options.stayOnPage?currentView:'home';
 if(changed){const note=document.getElementById('spendCaptureAccountLabel');if(note){note.textContent='';note.style.display='none'}}
 if(target==='track'&&!canViewSpendExpenses()){
  alert('This shared account allows adding expenses only. Its transaction history is private.');
  go('manual');
 }else if(!options.stayOnPage)go('home');
 else if(target==='track')render();
}
function renderSpendAccountManager(){
 const list=document.getElementById('spendAccountManager');
 if(!list||!currentUser)return;
 const owned=spendAccountRows.filter(a=>a.owner_id===currentUser.id);
 list.innerHTML=owned.map(a=>'<div class="row" style="flex-wrap:wrap;gap:12px"><div style="flex:1"><strong>'+escapeHTML(a.name)+'</strong><small>'+(a.is_default?'Default account · cannot be deleted':'Private unless you invite someone')+'</small></div><button class="muted" type="button" onclick="renameSpendAccount(\''+a.id+'\')">Rename</button>'+(a.is_default?'':'<button class="muted" type="button" onclick="deleteSpendAccount(\''+a.id+'\')">Delete</button>')+'</div>').join('');
}
async function createSpendAccount(){
 if(!currentUser||!navigator.onLine){alert('Connect to create an account.');return}
 const input=document.getElementById('newSpendAccountName'),name=input.value.trim();
 if(!name||name.length>80){alert('Enter an account name of 1–80 characters.');return}
 const {data,error}=await sb.from('expense_accounts').insert({owner_id:currentUser.id,name,is_default:false}).select('id').single();
 if(error){alert('Unable to create account: '+error.message);return}
 input.value='';await refreshSpendShares();await switchSpendWorkspace('account:'+data.id);
}
async function renameSpendAccount(id){
 const account=spendAccountRows.find(a=>a.id===id&&a.owner_id===currentUser.id);if(!account)return;
 const name=prompt('New account name',account.name)?.trim();
 if(!name||name===account.name)return;
 if(name.length>80){alert('Account name must be 80 characters or fewer.');return}
 const {error}=await sb.from('expense_accounts').update({name}).eq('id',id).eq('owner_id',currentUser.id);
 if(error)alert('Unable to rename account: '+error.message);
 await refreshSpendShares();
}
async function deleteSpendAccount(id){
 const account=spendAccountRows.find(a=>a.id===id&&a.owner_id===currentUser.id&&!a.is_default);if(!account)return;
 if(!confirm('Delete empty account "'+account.name+'"? Accounts with expenses, alerts or shared members cannot be deleted.'))return;
 const {error}=await sb.from('expense_accounts').delete().eq('id',id).eq('owner_id',currentUser.id);
 if(error){alert('This account cannot be deleted until its expenses, alerts and shared access have been removed. '+error.message);return}
 spendActiveAccountId=personalSpendAccount(currentUser.id)?.id;
 await refreshSpendShares();await loadCloudExpenses();
}
