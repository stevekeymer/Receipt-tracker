/* Household sharing: online-only workspace switching, invite management. */
let spendWorkspaceOwner=null,spendShareRows=[];
function activeSpendOwner(){return spendWorkspaceOwner||currentUser?.id}
function sharedSpendMode(){return !!currentUser&&activeSpendOwner()!==currentUser.id}
async function refreshSpendShares(){
 if(!currentUser||!navigator.onLine)return;
 const {data,error}=await sb.from('spend_shares').select('id,owner_id,member_id,invite_email,status,created_at').order('created_at',{ascending:false});
 if(error){console.warn('Unable to load household access',error);return}
 spendShareRows=data||[];
 if(sharedSpendMode()&&!spendShareRows.some(s=>s.owner_id===spendWorkspaceOwner&&s.member_id===currentUser.id&&s.status==='active'))spendWorkspaceOwner=currentUser.id;
 renderSpendShares();
}
function renderSpendShares(){
 const select=document.getElementById('spendWorkspaceSelect'),list=document.getElementById('spendSharesList');
 if(!select||!list||!currentUser)return;
 const owner=activeSpendOwner(),incoming=spendShareRows.filter(s=>s.member_id===currentUser.id&&s.status==='active');
 select.innerHTML='<option value="'+currentUser.id+'">My expenses</option>'+incoming.map(s=>'<option value="'+s.owner_id+'">Shared account · '+escapeHTML(s.invite_email)+'</option>').join('');
 select.value=owner;
 const owned=spendShareRows.filter(s=>s.owner_id===currentUser.id);
 const pending=spendShareRows.filter(s=>s.status==='pending'&&s.owner_id!==currentUser.id);
 list.innerHTML='<h4>People you invited</h4>'+(owned.map(s=>'<div class="row"><div><strong>'+escapeHTML(s.invite_email)+'</strong><small>'+escapeHTML(s.status)+'</small></div><button class="muted" onclick="removeSpendShare(\''+s.id+'\')">Remove</button></div>').join('')||'<p>No invitations yet.</p>')+
 '<h4>Invitations for you</h4>'+(pending.map(s=>'<div class="row"><span>Household invitation</span><button class="primary" onclick="acceptSpendShare(\''+s.id+'\')">Accept</button></div>').join('')||'<p>No pending invitations.</p>')+
 (incoming.length?'<h4>Accounts shared with you</h4>'+incoming.map(s=>'<div class="row"><span>Shared household</span><button class="muted" onclick="removeSpendShare(\''+s.id+'\')">Leave</button></div>').join(''):'');
 const note=document.getElementById('spendWorkspaceNote');if(note)note.textContent=sharedSpendMode()?'Shared household: online only. Expenses belong to the account owner.':'Personal expenses. Offline PIN applies only to this account.';
}
async function inviteSpendShare(){
 if(!navigator.onLine){alert('Connect to invite someone.');return}
 const input=document.getElementById('spendInviteEmail'),email=input.value.trim();
 if(!email)return;
 const {error}=await sb.rpc('spend_invite',{p_email:email});
 if(error){alert('Invitation failed: '+error.message);return}
 input.value='';await refreshSpendShares();
 alert('Invitation created. Ask '+email+' to create or sign into their own ZeroHours Spend account with that email and accept the invitation in Configure → Shared access. Email invitations are not automatically sent yet.');
}
async function acceptSpendShare(id){
 if(!navigator.onLine){alert('Connect to accept an invitation.');return}
 const {error}=await sb.rpc('spend_accept_invite',{p_id:id});if(error){alert(error.message);return}
 await refreshSpendShares();alert('Invitation accepted. Select the shared household from the account selector.');
}
async function removeSpendShare(id){
 if(!navigator.onLine){alert('Connect to change shared access.');return}
 if(!confirm('Remove this shared access?'))return;
 const {error}=await sb.rpc('spend_remove_share',{p_id:id});if(error){alert(error.message);return}
 await refreshSpendShares();await loadCloudExpenses();
}
async function switchSpendWorkspace(owner){
 if(!currentUser)return;
 if(owner!==currentUser.id&&!navigator.onLine){alert('Shared households require an internet connection.');renderSpendShares();return}
 if(owner!==currentUser.id&&!spendShareRows.some(s=>s.owner_id===owner&&s.member_id===currentUser.id&&s.status==='active')){alert('Shared access is no longer available.');renderSpendShares();return}
 spendWorkspaceOwner=owner;
 editingId=null;draftItems=[];renderItemEditor();
 document.getElementById('expenseForm').reset();
 document.getElementById('expenseDetails').style.display='none';
 await loadCloudExpenses();renderSpendShares();go('home');
}
