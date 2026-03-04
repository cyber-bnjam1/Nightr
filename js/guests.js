// ============================================================
// NIGHTR — Invités & RSVP
// ============================================================
import { showModal, showToast, getActiveEvent } from ‘./app.js’;
import { addSubItem, updateSubItem, deleteSubItem, listenSubCollection, updateEvent } from ‘./firebase.js’;

let unsubGuests = null;

export function renderGuests(container, state) {
const event = getActiveEvent();
if (!event) { container.innerHTML = noEventHtml(); return; }

container.innerHTML = `
<div class="view-enter">
<h2 class="view-title">Invités & RSVP</h2>
<p class="view-subtitle">${event.name}</p>

```
  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-value" style="color:var(--green-accent);" id="statConfirmed">0</div>
      <div class="stat-label">Confirmés ✅</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" style="color:var(--text-secondary);" id="statPending">0</div>
      <div class="stat-label">En attente ⏳</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" style="color:var(--red-accent);" id="statDeclined">0</div>
      <div class="stat-label">Déclinés ❌</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" id="statTotal">0</div>
      <div class="stat-label">Total</div>
    </div>
  </div>

  <div id="progressWrap" style="margin-bottom:20px;">
    <div class="progress-bar"><div class="progress-fill" id="rsvpProgress" style="width:0%"></div></div>
    <div style="font-size:12px;color:var(--text-tertiary);margin-top:6px;text-align:right;" id="rsvpLabel">0% de réponses</div>
  </div>

  <div style="display:flex;gap:8px;margin-bottom:16px;">
    <button class="btn-primary" id="addGuestBtn" style="flex:1;">+ Ajouter un invité</button>
    <button class="btn-secondary" id="importContactsBtn">📱 Contacts</button>
  </div>

  <div style="display:flex;gap:8px;margin-bottom:12px;">
    ${['all','confirmed','pending','declined'].map((f,i) => `
      <button class="filter-btn ${i===0?'active':''}" data-filter="${f}" style="
        flex:1;padding:8px 4px;border-radius:var(--radius-full);font-size:12px;font-weight:600;
        background:${i===0?'rgba(124,58,237,0.25)':'var(--glass-bg)'};
        border:1px solid ${i===0?'rgba(168,85,247,0.3)':'var(--glass-border)'};
        color:${i===0?'var(--purple-light)':'var(--text-secondary)'};cursor:pointer;">
        ${ ['Tous','✅','⏳','❌'][i] }
      </button>
    `).join('')}
  </div>

  <div id="guestsList" class="stagger"></div>
  <div style="height:80px;"></div>
</div>
```

`;

let currentFilter = ‘all’;
let allGuests = [];

// Filter buttons
container.querySelectorAll(’.filter-btn’).forEach(btn => {
btn.addEventListener(‘click’, () => {
container.querySelectorAll(’.filter-btn’).forEach(b => {
b.style.background = ‘var(–glass-bg)’;
b.style.borderColor = ‘var(–glass-border)’;
b.style.color = ‘var(–text-secondary)’;
b.classList.remove(‘active’);
});
btn.style.background = ‘rgba(124,58,237,0.25)’;
btn.style.borderColor = ‘rgba(168,85,247,0.3)’;
btn.style.color = ‘var(–purple-light)’;
btn.classList.add(‘active’);
currentFilter = btn.dataset.filter;
renderGuestsList(container, allGuests, currentFilter);
});
});

// Subscribe to guests
if (unsubGuests) unsubGuests();
unsubGuests = listenSubCollection(state.user.uid, event.id, ‘guests’, guests => {
allGuests = guests;
updateStats(container, guests, event, state);
renderGuestsList(container, guests, currentFilter);
});

container.getElementById = (id) => container.querySelector(’#’ + id); // polyfill for scoping

document.getElementById(‘addGuestBtn’).addEventListener(‘click’, () => showAddGuestModal(state, event));
document.getElementById(‘importContactsBtn’).addEventListener(‘click’, () => importContacts(state, event));
}

function renderGuestsList(container, guests, filter) {
const filtered = filter === ‘all’ ? guests : guests.filter(g => g.status === filter);
const list = container.querySelector(’#guestsList’);
if (!list) return;

if (filtered.length === 0) {
list.innerHTML = `<div class="empty-state"> <div class="empty-icon">👥</div> <div class="empty-title">Aucun invité</div> <div class="empty-desc">${filter === 'all' ? 'Ajoute tes premiers invités !' : 'Aucun invité dans cette catégorie'}</div> </div>`;
return;
}

list.innerHTML = filtered.map(guest => `<div class="list-item" data-guest-id="${guest.id}"> <div class="list-item-icon" style="background:${avatarBg(guest.status)};border-radius:50%;"> ${guest.name.charAt(0).toUpperCase()} </div> <div class="list-item-content"> <div class="list-item-title">${escHtml(guest.name)}</div> <div class="list-item-subtitle"> ${guest.phone ? guest.phone : ''} ${guest.plus ? ' · +1' : ''} ${guest.group ?` · ${guest.group}`: ''} </div> </div> <div style="display:flex;align-items:center;gap:6px;"> <div class="rsvp-btns" style="display:flex;gap:4px;"> <button class="rsvp-btn" data-id="${guest.id}" data-status="confirmed" title="Confirmé" style="padding:6px 8px;border-radius:20px;border:1px solid;font-size:12px;cursor:pointer;transition:all 0.15s; background:${guest.status==='confirmed'?'rgba(16,185,129,0.25)':'transparent'}; border-color:${guest.status==='confirmed'?'rgba(16,185,129,0.4)':'var(--glass-border)'}; color:${guest.status==='confirmed'?'#34d399':'var(--text-tertiary)'};">✅</button> <button class="rsvp-btn" data-id="${guest.id}" data-status="pending" title="En attente" style="padding:6px 8px;border-radius:20px;border:1px solid;font-size:12px;cursor:pointer;transition:all 0.15s; background:${guest.status==='pending'?'rgba(245,158,11,0.2)':'transparent'}; border-color:${guest.status==='pending'?'rgba(245,158,11,0.3)':'var(--glass-border)'}; color:${guest.status==='pending'?'#fbbf24':'var(--text-tertiary)'};">⏳</button> <button class="rsvp-btn" data-id="${guest.id}" data-status="declined" title="Décliné" style="padding:6px 8px;border-radius:20px;border:1px solid;font-size:12px;cursor:pointer;transition:all 0.15s; background:${guest.status==='declined'?'rgba(239,68,68,0.2)':'transparent'}; border-color:${guest.status==='declined'?'rgba(239,68,68,0.3)':'var(--glass-border)'}; color:${guest.status==='declined'?'#f87171':'var(--text-tertiary)'};">❌</button> </div> <button class="guest-delete" data-id="${guest.id}" style="background:none;border:none;color:var(--text-tertiary);padding:4px;cursor:pointer;font-size:14px;">✕</button> </div> </div>`).join(’’);

// RSVP buttons
list.querySelectorAll(’.rsvp-btn’).forEach(btn => {
btn.addEventListener(‘click’, async () => {
const { id, status } = btn.dataset;
// state is not directly available here, find from parent
const state = window.__nightrState;
const event = window.__nightrEvent;
if (!state || !event) return;
try {
await updateSubItem(state.user.uid, event.id, ‘guests’, id, { status });
} catch(e) { showToast(‘Erreur de mise à jour’, ‘error’); }
});
});

// Delete
list.querySelectorAll(’.guest-delete’).forEach(btn => {
btn.addEventListener(‘click’, async () => {
const state = window.__nightrState;
const event = window.__nightrEvent;
if (!state || !event) return;
if (confirm(‘Supprimer cet invité ?’)) {
await deleteSubItem(state.user.uid, event.id, ‘guests’, btn.dataset.id);
}
});
});
}

function updateStats(container, guests, event, state) {
const confirmed = guests.filter(g => g.status === ‘confirmed’).length;
const pending   = guests.filter(g => g.status === ‘pending’).length;
const declined  = guests.filter(g => g.status === ‘declined’).length;
const total     = guests.length;
const answered  = confirmed + declined;

container.querySelector(’#statConfirmed’).textContent = confirmed;
container.querySelector(’#statPending’).textContent   = pending;
container.querySelector(’#statDeclined’).textContent  = declined;
container.querySelector(’#statTotal’).textContent     = total;

const pct = total > 0 ? Math.round((answered / total) * 100) : 0;
const prog = container.querySelector(’#rsvpProgress’);
const lbl  = container.querySelector(’#rsvpLabel’);
if (prog) prog.style.width = pct + ‘%’;
if (lbl)  lbl.textContent = `${pct}% de réponses`;

// Store for RSVP btn handlers
window.__nightrState = state;
window.__nightrEvent = event;

// Update event counts
updateEvent(state.user.uid, event.id, { guestCount: total, confirmedCount: confirmed });
}

// ── Add Guest Modal ───────────────────────────────────
function showAddGuestModal(state, event, prefill = {}) {
const close = showModal(`<h3 class="modal-title">Ajouter un invité</h3> <div class="input-group"> <label class="input-label">Nom & Prénom *</label> <input class="input-field" id="gName" type="text" placeholder="Marie Dupont" value="${prefill.name || ''}" /> </div> <div class="input-group"> <label class="input-label">Téléphone</label> <input class="input-field" id="gPhone" type="tel" placeholder="+33 6 12 34 56 78" value="${prefill.phone || ''}" /> </div> <div class="input-group"> <label class="input-label">Email</label> <input class="input-field" id="gEmail" type="email" placeholder="marie@exemple.fr" value="${prefill.email || ''}" /> </div> <div class="input-group"> <label class="input-label">Groupe</label> <select class="input-field" id="gGroup"> <option value="">Aucun groupe</option> <option value="Famille">Famille</option> <option value="Amis">Amis</option> <option value="Collègues">Collègues</option> <option value="Autres">Autres</option> </select> </div> <div class="input-group" style="display:flex;align-items:center;gap:12px;"> <label style="font-size:14px;color:var(--text-secondary);flex:1;">Accompagné(e) (+1)</label> <input type="checkbox" id="gPlus" style="width:20px;height:20px;accent-color:var(--purple-core);" /> </div> <div style="display:flex;gap:12px;margin-top:16px;"> <button class="btn-secondary" id="cancelGuest" style="flex:1;">Annuler</button> <button class="btn-primary" id="saveGuest" style="flex:2;">Ajouter</button> </div>`);

document.getElementById(‘cancelGuest’).addEventListener(‘click’, close);
document.getElementById(‘saveGuest’).addEventListener(‘click’, async () => {
const name = document.getElementById(‘gName’).value.trim();
if (!name) { showToast(‘Le nom est requis’, ‘error’); return; }
const data = {
name,
phone: document.getElementById(‘gPhone’).value.trim() || null,
email: document.getElementById(‘gEmail’).value.trim() || null,
group: document.getElementById(‘gGroup’).value || null,
plus: document.getElementById(‘gPlus’).checked,
status: ‘pending’,
};
try {
await addSubItem(state.user.uid, event.id, ‘guests’, data);
showToast(`${name} ajouté(e) !`, ‘success’);
close();
} catch(e) { showToast(‘Erreur’, ‘error’); }
});
}

// ── Import Contacts ───────────────────────────────────
async function importContacts(state, event) {
if (!(‘contacts’ in navigator && ‘ContactsManager’ in window)) {
showToast(‘Contact Picker non supporté sur cet appareil’, ‘error’);
return;
}
try {
const props = [‘name’, ‘tel’, ‘email’];
const contacts = await navigator.contacts.select(props, { multiple: true });
if (!contacts.length) return;
let count = 0;
for (const c of contacts) {
await addSubItem(state.user.uid, event.id, ‘guests’, {
name: c.name?.[0] || ‘Inconnu’,
phone: c.tel?.[0] || null,
email: c.email?.[0] || null,
status: ‘pending’,
plus: false,
});
count++;
}
showToast(`${count} contact(s) importé(s) !`, ‘success’);
} catch(e) {
showToast(‘Import annulé’, ‘info’);
}
}

// ── Helpers ───────────────────────────────────────────
function avatarBg(status) {
if (status === ‘confirmed’) return ‘rgba(16,185,129,0.25)’;
if (status === ‘declined’)  return ‘rgba(239,68,68,0.2)’;
return ‘rgba(255,255,255,0.08)’;
}

function noEventHtml() {
return `<div class="view-enter"><div class="empty-state">
<div class="empty-icon">🎉</div>
<div class="empty-title">Aucune soirée active</div>
<div class="empty-desc">Crée ou sélectionne une soirée depuis le dashboard.</div>

  </div></div>`;
}

function escHtml(s) {
if (!s) return ‘’;
return s.replace(/&/g,’&’).replace(/</g,’<’).replace(/>/g,’>’).replace(/”/g,’"’);
}