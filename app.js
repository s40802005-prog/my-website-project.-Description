let mode='login', me=null, services=[];
const $=id=>document.getElementById(id);
async function api(url, options={}) {
 const res=await fetch('/api'+url,{...options,headers:{'Content-Type':'application/json',...(options.headers||{})}});
 const data=await res.json().catch(()=>({}));
 if(!res.ok) throw new Error(data.error||'Request failed'); return data;
}
function msg(id,text){$(id).textContent=text||''}
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{mode=b.dataset.tab;document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===b));$('authSubmit').textContent=mode==='login'?'Login securely':'Create account';});
$('authForm').onsubmit=async e=>{e.preventDefault();msg('authMsg','Please wait…');try{const d=await api('/'+mode,{method:'POST',body:JSON.stringify({email:$('email').value,password:$('password').value})});me=d.user;await showApp();}catch(err){msg('authMsg',err.message)}};
$('logout').onclick=async()=>{await api('/logout',{method:'POST'});location.reload()};
async function showApp(){
 $('auth').classList.add('hidden');$('dashboard').classList.remove('hidden');$('logout').classList.remove('hidden');$('welcomeEmail').textContent=me.email;$('adminPanel').classList.toggle('hidden',me.role!=='admin');
 await refresh();
}
async function refresh(){
 const [m,s,o,w]=await Promise.all([api('/me'),api('/services'),api('/orders'),api('/wallet')]);me=m.user;services=s.services;
 $('balance').textContent='₹'+Number(me.balance).toFixed(2);$('orderCount').textContent=o.orders.length;
 $('service').innerHTML=services.map(x=>`<option value="${x.id}" data-price="${x.price_per_1000}" data-min="${x.min_qty}" data-max="${x.max_qty}">${esc(x.name)} — ₹${Number(x.price_per_1000).toFixed(2)}/1k</option>`).join('');
 $('upi').textContent=w.upiId?'Pay to UPI ID: '+w.upiId:'UPI ID will appear here when admin configures it.';
 $('orders').innerHTML=o.orders.length?o.orders.map(x=>`<div class="item"><div><b>Order #${x.id}</b>${esc(x.link)}<br>${x.quantity} units · ₹${Number(x.total).toFixed(2)}</div><span class="status">${esc(x.status)}</span></div>`).join(''):'<p class="muted small">No orders yet.</p>';
 updateEstimate();
}
function updateEstimate(){const opt=$('service').selectedOptions[0];if(!opt)return;const qty=Number($('quantity').value||0);$('quantity').min=opt.dataset.min;$('quantity').max=opt.dataset.max;$('estimate').textContent='₹'+(Number(opt.dataset.price)*qty/1000).toFixed(2)}
$('service').onchange=updateEstimate;$('quantity').oninput=updateEstimate;
$('orderForm').onsubmit=async e=>{e.preventDefault();try{const d=await api('/orders',{method:'POST',body:JSON.stringify({serviceId:$('service').value,link:$('link').value,quantity:$('quantity').value})});msg('orderMsg','Order #'+d.orderId+' created. '+d.message);await refresh()}catch(err){msg('orderMsg',err.message)}};
$('walletForm').onsubmit=async e=>{e.preventDefault();try{await api('/wallet/request',{method:'POST',body:JSON.stringify({amount:$('amount').value,reference:$('reference').value})});msg('walletMsg','Request submitted. Admin will verify your payment.')}catch(err){msg('walletMsg',err.message)}};
$('serviceForm').onsubmit=async e=>{e.preventDefault();try{await api('/admin/services',{method:'POST',body:JSON.stringify({name:$('svcName').value,category:$('svcCategory').value,price_per_1000:$('svcPrice').value,min_qty:$('svcMin').value,max_qty:$('svcMax').value})});msg('adminMsg','Service added.');await refresh()}catch(err){msg('adminMsg',err.message)}};
$('refreshPayments').onclick=async()=>{try{const d=await api('/admin/payment-requests');$('payments').innerHTML=d.requests.length?d.requests.map(x=>`<div class="item"><div><b>${esc(x.email)} · ₹${x.amount}</b>Ref: ${esc(x.reference)}</div><button class="secondary" onclick="approve(${x.id})">Approve</button></div>`).join(''):'<p class="muted small">No pending requests.</p>'}catch(e){msg('adminMsg',e.message)}};
window.approve=async id=>{try{await api('/admin/wallet/'+id+'/approve',{method:'POST'});$('refreshPayments').click();await refresh()}catch(e){msg('adminMsg',e.message)}};
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
(async()=>{try{const d=await api('/me');me=d.user;await showApp()}catch{}})();
