// ============================================================
// NIGHTR — Contributions (ce que les invités ramènent)
// ============================================================
import { showModal, showToast, getActiveEvent } from ‘./app.js’;
import { addSubItem, updateSubItem, deleteSubItem, listenSubCollection } from ‘./firebase.js’;

let unsubContribs = null;

const CATEGORIES = [‘🍾 Boissons’,‘🍕 Nourriture’,‘🧊 Glaces & desserts’,‘🎵 Musique’,‘🎈 Décoration’,‘📷 Photo/Vidéo’,‘🎲 Jeux’,‘📦 Autre’];

export function renderContributions(container, state) {
const event = getActiveEvent();
if (!event) { container.innerHTML = noEventHtml(); return; }

container.innerHTML = `
<div class="view-enter stagger">
<h2 class="view-title">Contributions</h2>
<p class="view-subtitle">Qui ramène quoi à ${escHtml(event.name)}</p>

```
  <div class="stats-grid" style="margin-bottom:20px;">
    <div class="stat-card">
      <div class="stat-value" id="statAssigned" style="color:var(--green-accent);">0</div>
      <div class="stat-label">Assignés ✅</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" id="statFree" style="color:var(--amber-accent);">0</div>
      <div class="stat-label">Libres ⚡</div>
    </div>
  </div>

  <button class="btn-primary btn-full" id="addContribBtn" style="margin-bottom:20px;">+ Ajouter un item</button>

  <!-- Group by category -->
  <div id="contribsByCategory"></div>
  <div style="height:40px;"></div>
</div>
```

`;

window.__nightrContribState = state;
window.__nightrContribEvent = event;

if (unsubContribs) unsubContribs();
unsubContribs = listenSubCollection(state.user.uid, event.id, ‘contributions’, items => {
renderContribsList(container, items, state, event);
const assigned = items.filter(i => i.assignedTo).length;
const stat1 = container.querySelector(’#statAssigned’);
const stat2 = container.querySelector(’#statFree’);
if (stat1) stat1.textContent = assigned;
if (stat2) stat2.textContent = items.length - assigned;
});

container.querySelector(’#addContribBtn’).addEventListener(‘click’, () => showAddContribModal(state, event));
}

function renderContribsList(container, items, state, event) {
const byCategory = {};
items.forEach(item => {
const cat = item.category || ‘📦 Autre’;
if (!byCategory[cat]) byCategory[cat] = [];
byCategory[cat].push(item);
});

const el = container.querySelector(’#contribsByCategory’);
if (!el) return;

if (items.length === 0) {
el.innerHTML = `<div class="empty-state"> <div class="empty-icon">🛒</div> <div class="empty-title">Aucun item pour l'instant</div> <div class="empty-desc">Ajoute ce que les invités peuvent ramener.</div> </div>`;
return;
}

el.innerHTML = Object.entries(byCategory).map(([cat, catItems]) => `<div style="margin-bottom:20px;"> <p class="section-title">${cat}</p> ${catItems.map(item =>`
<div class="list-item" style="flex-wrap:wrap;gap:8px;">
<div class="list-item-icon" style="background:var(--glass-bg-strong);">
${item.assignedTo ? ‘✅’ : ‘🔲’}
</div>
<div class="list-item-content">
<div class="list-item-title">${escHtml(item.name)}</div>
<div class="list-item-subtitle">
${item.quantity ? `Qté: ${item.quantity}` : ‘’}
${item.assignedTo ? ` · Par: ${escHtml(item.assignedTo)}` : ’ · Non assigné’}
</div>
</div>
<div style="display:flex;gap:6px;align-items:center;">
<button class="assign-btn glass-btn" data-id="${item.id}" data-assigned="${item.assignedTo || ''}"
style="font-size:11px;width:auto;padding:0 10px;height:30px;border-radius:20px;">
${item.assignedTo ? ‘Changer’ : ‘+ Assigner’}
</button>
<button class="del-contrib glass-btn" data-id="${item.id}"
style="width:30px;height:30px;font-size:12px;color:var(--text-tertiary);">✕</button>
</div>
</div>
`).join('')} </div> `).join(’’);

// Assign
el.querySelectorAll(’.assign-btn’).forEach(btn => {
btn.addEventListener(‘click’, () => showAssignModal(state, event, btn.dataset.id, btn.dataset.assigned));
});

// Delete
el.querySelectorAll(’.del-contrib’).forEach(btn => {
btn.addEventListener(‘click’, async () => {
if (confirm(‘Supprimer cet item ?’)) {
await deleteSubItem(state.user.uid, event.id, ‘contributions’, btn.dataset.id);
}
});
});
}

function showAddContribModal(state, event) {
const close = showModal(`<h3 class="modal-title">Ajouter un item</h3> <div class="input-group"> <label class="input-label">Nom de l'item *</label> <input class="input-field" id="cName" type="text" placeholder="Champagne, pizza, …" /> </div> <div class="input-group"> <label class="input-label">Catégorie</label> <select class="input-field" id="cCategory"> ${CATEGORIES.map(c =>`<option value="${c}">${c}</option>`).join('')} </select> </div> <div class="input-group"> <label class="input-label">Quantité souhaitée</label> <input class="input-field" id="cQty" type="text" placeholder="2 bouteilles, 1 pack, …" /> </div> <div class="input-group"> <label class="input-label">Notes</label> <input class="input-field" id="cNotes" type="text" placeholder="Sans alcool, végétarien, …" /> </div> <div style="display:flex;gap:12px;margin-top:16px;"> <button class="btn-secondary" id="cancelContrib" style="flex:1;">Annuler</button> <button class="btn-primary" id="saveContrib" style="flex:2;">Ajouter</button> </div> `);

document.getElementById(‘cancelContrib’).addEventListener(‘click’, close);
document.getElementById(‘saveContrib’).addEventListener(‘click’, async () => {
const name = document.getElementById(‘cName’).value.trim();
if (!name) { showToast(‘Le nom est requis’, ‘error’); return; }
await addSubItem(state.user.uid, event.id, ‘contributions’, {
name,
category: document.getElementById(‘cCategory’).value,
quantity: document.getElementById(‘cQty’).value.trim() || null,
notes: document.getElementById(‘cNotes’).value.trim() || null,
assignedTo: null,
});
showToast(`"${name}" ajouté !`, ‘success’);
close();
});
}

function showAssignModal(state, event, itemId, current) {
const close = showModal(`<h3 class="modal-title">Assigner à un invité</h3> <div class="input-group"> <label class="input-label">Nom de l'invité</label> <input class="input-field" id="assignName" type="text" placeholder="Nom de l'invité…" value="${escHtml(current)}" /> </div> <div style="display:flex;gap:12px;margin-top:16px;"> <button class="btn-secondary" id="clearAssign" style="flex:1;">Désassigner</button> <button class="btn-primary" id="saveAssign" style="flex:2;">Assigner</button> </div>`);

document.getElementById(‘clearAssign’).addEventListener(‘click’, async () => {
await updateSubItem(state.user.uid, event.id, ‘contributions’, itemId, { assignedTo: null });
showToast(‘Désassigné’, ‘info’);
close();
});
document.getElementById(‘saveAssign’).addEventListener(‘click’, async () => {
const name = document.getElementById(‘assignName’).value.trim();
if (!name) { showToast(‘Nom requis’, ‘error’); return; }
await updateSubItem(state.user.uid, event.id, ‘contributions’, itemId, { assignedTo: name });
showToast(`Assigné à ${name}`, ‘success’);
close();
});
}

function escHtml(s) { if (!s) return ‘’; return s.replace(/&/g,’&’).replace(/</g,’<’).replace(/>/g,’>’).replace(/”/g,’"’); }
function noEventHtml() {
return `<div class="view-enter"><div class="empty-state"><div class="empty-icon">🛒</div><div class="empty-title">Aucune soirée active</div></div></div>`;
}