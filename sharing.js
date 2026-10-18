/* Household sharing: online-only workspace switching, invite management. */
let spendWorkspaceOwner=null,spendShareRows=[];
function activeSpendOwner(){return spendWorkspaceOwner||currentUser?.id}
function sharedSpendMode(){return !!currentUser&&activeSpendOwner()!==currentUser.id}
function canViewSpendExpenses(){if(!currentUser)return false;if(!sharedSpendMode())return true;return spendShareRows.some(s=>s.owner_id===activeSpendOwner()&&s.member_id===currentUser.id&&s.status==='active'&&s.allow_view===true)}
function canDeleteSpendExpense(){if(!currentUser)return false;if(!sharedSpendMode())return true;return spendShareRows.some(s=>s.owner_id===activeSpendOwner()&&s.member_id===currentUser.id&&s.status==='active'&&s.allow_view===true&&s.allow_delete===true)}
async function refreshSpendShares(){
 if(!currentUser||!navigator.onLine)return;
 const {data,error}=await sb.from('spend_shares').select('id,owner_id,member_id,invite_email,status,allow_view,allow_delete,created_at').order('created_at',{ascending:false});
 if(error){console.warn('Unable to load household access',error);return}
 spendShareRows=data||[];
 if(sharedSpendMode()&&!spendShareRows.some(s=>s.owner_id===spendWorkspaceOwner&&s.member_id===currentUser.id&&s.status==='active'))spendWorkspaceOwner=currentUser.id;
 if(sharedSpendMode()&&!canViewSpendExpenses()){expenses=[];expenseItems=[];document.getElementById('expenseDetails').style.display='none';}
 renderSpendShares();if(typeof render==='function')render();
}
function renderSpendShares(){
 const select=document.getElementById('spendWorkspaceSelect'),list=document.getElementById('spendSharesList');
 if(!select||!list||!currentUser)return;
 const owner=activeSpendOwner(),incoming=spendShareRows.filter(s=>s.member_id===currentUser.id&&s.status==='active');
 select.innerHTML='<option value="'+currentUser.id+'">My expenses</option>'+incoming.map(s=>'<option value="'+s.owner_id+'">Shared account · '+escapeHTML(s.invite_email)+'</option>').join('');
 select.value=owner;
 const owned=spendShareRows.filter(s=>s.owner_id===currentUser.id);
 const pending=spendShareRows.filter(s=>s.status==='pending'&&s.owner_id!==currentUser.id);
 list.innerHTML='<h4>People you invited</h4>'+(owned.map(s=>
 '<div class="row" style="flex-wrap:wrap;gap:12px"><div><strong>'+escapeHTML(s.invite_email)+'</strong><small>'+escapeHTML(s.status)+'</small></div>'+
 '<label style="display:flex;align-items:center;gap:6px;font-size:13px"><input type="checkbox" style="width:18px;height:18px" '+(s.allow_view?'checked':'')+' onchange="setSpendAccess(\''+s.id+'\',this.checked,'+(s.allow_delete?'true':'false')+')">View all expenses</label>'+
 '<label style="display:flex;align-items:center;gap:6px;font-size:13px"><input type="checkbox" style="width:18px;height:18px" '+(s.allow_delete?'checked':'')+(s.allow_view?'':' disabled')+' onchange="setSpendAccess(\''+s.id+'\','+(s.allow_view?'true':'false')+',this.checked)">Allow delete</label>'+
 '<button class="muted" onclick="removeSpendShare(\''+s.id+'\')">Remove</button></div>'
 ).join('')||'<p>No invitations yet.</p>')+
 '<h4>Invitations for you</h4>'+(pending.map(s=>'<div class="row"><span>Household invitation · '+(s.allow_view?'Can view expenses':'Capture only')+'</span><button class="primary" onclick="acceptSpendShare(\''+s.id+'\')">Accept</button></div>').join('')||'<p>No pending invitations.</p>')+
 (incoming.length?'<h4>Accounts shared with you</h4>'+incoming.map(s=>'<div class="row"><span>Shared household · '+(s.allow_view?'View and capture':'Capture only')+'</span><button class="muted" onclick="removeSpendShare(\''+s.id+'\')">Leave</button></div>').join(''):'');
 const note=document.getElementById('spendWorkspaceNote');if(note)note.textContent=sharedSpendMode()?'Shared household: online only. '+(!canViewSpendExpenses()?'Capture only — you cannot view household transactions.':(canDeleteSpendExpense()?'You can view and delete expenses.':'You can view expenses, but not delete them.')):'Personal expenses. Offline PIN applies only to this account.';
}
async function inviteSpendShare(){
 if(!navigator.onLine){alert('Connect to invite someone.');return}
 const input=document.getElementById('spendInviteEmail'),email=input.value.trim();
 if(!email)return;
 const allowView=document.getElementById('spendInviteAllowView')?.checked||false;
 const allowDelete=allowView&&(document.getElementById('spendInviteAllowDelete')?.checked||false);
 const {error}=await sb.rpc('spend_invite_with_access',{p_email:email,p_allow_view:allowView,p_allow_delete:allowDelete});
 if(error){alert('Invitation failed: '+error.message);return}
 input.value='';document.getElementById('spendInviteAllowView').checked=false;document.getElementById('spendInviteAllowDelete').checked=false;document.getElementById('spendInviteAllowDelete').disabled=true;await refreshSpendShares();
 alert('Invitation created. Ask '+email+' to create or sign into their own ZeroHours Spend account with that email and accept the invitation in Configure → Shared access. Email invitations are not automatically sent yet.');
}
async function setSpendAccess(id,allowView,allowDelete){
 if(!navigator.onLine){alert('Connect to change permissions.');renderSpendShares();return}
 const {error}=await sb.rpc('spend_set_access',{p_id:id,p_allow_view:allowView,p_allow_delete:allowView&&allowDelete});
 if(error)alert('Unable to update permissions: '+error.message);
 await refreshSpendShares();
 if(sharedSpendMode())await loadCloudExpenses();
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
