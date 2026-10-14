const base='https://pbbqmedwddfmnlmnsxtx.supabase.co';
const publicKey='sb_publishable_eNkrJqt7TAQnuffUXftOTg_OeibVV-Z';
const respond=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
export async function onRequestPost({request,env}){
 if(!env.RESEND_API_KEY||!env.ALERT_FROM_EMAIL)return respond({error:'Email delivery is not configured yet. Add RESEND_API_KEY and ALERT_FROM_EMAIL in Cloudflare Pages secrets.'},503);
 const token=request.headers.get('authorization')||'';
 if(!token.startsWith('Bearer '))return respond({error:'Sign in required'},401);
 const headers={apikey:publicKey,authorization:token};
 const u=await fetch(base+'/auth/v1/user',{headers});
 if(!u.ok)return respond({error:'Session expired'},401);
 const user=await u.json();
 let body;try{body=await request.json()}catch{return respond({error:'Invalid request'},400)}
 if(typeof body?.id!=='string'||!(/^[0-9a-f-]{36}$/i).test(body.id))return respond({error:'Invalid notification'},400);
 const n=await fetch(base+'/rest/v1/spending_notifications?id=eq.'+encodeURIComponent(body.id)+'&select=id,title,message,email_requested,email_sent_at',{headers});
 if(!n.ok)return respond({error:'Unable to verify notification'},502);
 const notification=(await n.json())[0];
 if(!notification||!notification.email_requested)return respond({error:'Email not enabled for this alert'},403);
 if(notification.email_sent_at)return respond({alreadySent:true});
 if(!user.email)return respond({error:'Account has no email address'},400);
 const mail=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({from:env.ALERT_FROM_EMAIL,to:[user.email],subject:'ZeroHours Spend alert: '+notification.title,text:notification.title+'\n\n'+notification.message+'\n\nView your alerts: https://spend.zerohours.ca/'})});
 if(!mail.ok){const detail=await mail.text();return respond({error:'Email provider rejected delivery',detail:detail.slice(0,180)},502)}
 await fetch(base+'/rest/v1/spending_notifications?id=eq.'+encodeURIComponent(body.id),{method:'PATCH',headers:{...headers,'content-type':'application/json','Prefer':'return=minimal'},body:JSON.stringify({email_sent_at:new Date().toISOString()})});
 return respond({sent:true});
}