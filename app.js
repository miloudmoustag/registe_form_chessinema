
async function loadCount() {
  try {
    const response = await fetch('/api/ticket-count', { headers: { Accept: 'application/json' } });
    if (!response.ok) return;
    const { count } = await response.json();
    document.getElementById('ticketsLeft').textContent = count ?? '—';
  } catch (error) {}
}
loadCount();


function setErr(id, msg) {
  const el = document.getElementById('e-'+id);
  const inp = document.getElementById(id);
  if(el){ el.textContent = msg; el.classList.toggle('on', !!msg); }
  if(inp) inp.classList.toggle('err', !!msg);
}
function clearAll() {
  ['firstName','lastName','email','phone','cin','inst','level','ticket'].forEach(id => setErr(id,''));
  document.getElementById('e-inst').classList.remove('on');
}

function validate() {
  clearAll();
  let ok = true;
  const g = id => document.getElementById(id)?.value.trim() ?? '';

  const fn   = g('firstName'), ln = g('lastName');
  const em   = g('email'), ph = g('phone');
  const cin  = g('cin').toUpperCase();
  const inst = document.querySelector('input[name="inst"]:checked');
  const lv   = g('level');
  const tkt  = g('ticketNum').toUpperCase();

  if(!fn){ setErr('firstName','First name is required.'); ok=false; }
  if(!ln){ setErr('lastName','Last name is required.'); ok=false; }
  if(!em||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)){ setErr('email','Enter a valid email address.'); ok=false; }
  if(!ph||!/^0[0-9]{9}$/.test(ph.replace(/\s/g,''))){ setErr('phone','10-digit Moroccan number starting with 0.'); ok=false; }
  if(!cin||!/^[A-Z]{1,2}[0-9]{5,7}$/.test(cin)){ setErr('cin','Format: 1–2 letters then 5–7 digits (e.g. K123456).'); ok=false; }
  if(!inst){ setErr('inst','Please select your institution.'); ok=false; }
  if(!lv){ setErr('level','Please enter your level or year.'); ok=false; }

  if(!tkt){
    document.getElementById('noTicketMsg').classList.remove('hidden');
    ok = false;
  } else {
    document.getElementById('noTicketMsg').classList.add('hidden');
  }

  return ok ? { fn, ln, em, ph, cin, inst: inst.value, lv, tkt } : null;
}


document.getElementById('regForm').addEventListener('submit', async e => {
  e.preventDefault();
  const data = validate(); if(!data) return;

  const btn = document.getElementById('submitBtn');
  const msg = document.getElementById('statusMsg');
  btn.disabled = true; btn.classList.add('loading'); btn.textContent = '🕷️ Processing…';
  msg.className = 'smsg';

  try {
    const response = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(data)
    });
    const res = await response.json();

    btn.disabled=false; btn.classList.remove('loading'); btn.textContent='☠️ CLAIM YOUR SEAT';

    const errors = {
      invalid_ticket: '🎫 Ticket not found or already used. Please check your ticket number.',
      email_exists:   '📧 This email address is already registered.',
      cin_exists:     '🪪 This CIN is already registered.',
    };
    if(res?.success) { showSuccess(data.tkt); loadCount(); }
    else {
      msg.className='smsg error';
      msg.textContent = errors[res?.error] ?? '⚠️ Something went wrong. Please try again.';
    }

  } catch(err) {
    btn.disabled=false; btn.classList.remove('loading'); btn.textContent='☠️ CLAIM YOUR SEAT';
    msg.className='smsg error'; msg.textContent='⚠️ Could not reach the server. Check your connection.';
  }
});


function showSuccess(tkt) {
  document.getElementById('popTkt').textContent = `Ticket ${tkt} — sealed and spent.`;
  document.getElementById('successOverlay').classList.add('on');
  document.getElementById('regForm').reset();
  clearAll();
  document.getElementById('noTicketMsg').classList.add('hidden');
}
function closePopup() { document.getElementById('successOverlay').classList.remove('on'); }
document.getElementById('popCloseBtn').addEventListener('click', closePopup);
document.getElementById('successOverlay').addEventListener('click', e => { if(e.target===e.currentTarget) closePopup(); });


['cin','ticketNum'].forEach(id => {
  document.getElementById(id).addEventListener('input', function(){
    const p = this.selectionStart; this.value = this.value.toUpperCase(); this.setSelectionRange(p,p);
  });
});
