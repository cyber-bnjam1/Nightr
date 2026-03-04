// ============================================================
// NIGHTR — Checklist & Planning
// ============================================================
import { showModal, showToast, getActiveEvent } from ‘./app.js’;
import { addSubItem, updateSubItem, deleteSubItem, listenSubCollection } from ‘./firebase.js’;

let unsubChecklist = null;

const TEMPLATES = {
‘Standard’: [
{ name: ‘Définir la date et le lieu’, category: ‘📋 Planification’, dueOffset: -30 },
{ name: ‘Créer la liste d'invités’, category: ‘📋 Planification’, dueOffset: -21 },
{ name: ‘Envoyer les invitations’, category: ‘📩 Invitations’, dueOffset: -14 },
{ name: ‘Confirmer le traiteur / catering’, category: ‘🍕 Nourriture’, dueOffset: -10 },
{ name: ‘Commander les boissons’, category: ‘🍾 Boissons’, dueOffset: -7 },
{ name: ‘Préparer la playlist’, category: ‘🎵 Musique’, dueOffset: -5 },
{ name: ‘Acheter la décoration’, category: ‘🎈 Décoration’, dueOffset: -3 },
{ name: ‘Relancer les invités sans réponse’, category: ‘📩 Invitations’, dueOffset: -3 },
{ name: ‘Préparer le lieu’, category: ‘🏠 Logistique’, dueOffset: -1 },
{ name: ‘Confirmer les contributions des invités’, category: ‘🛒 Contributions’, dueOffset: -1 },
{ name: ‘Préparer la playlist de secours’, category: ‘🎵 Musique’, dueOffset: 0 },
{ name: ‘Accueillir les invités 🎉’, category: ‘🎉 Jour J’, dueOffset: 0 },
],
};

export function renderChecklist(container, state) {
const event = getActiveEvent();
if (!event) { container.innerHTML = noEventHtml(); return; }

container.innerHTML = `
<div class="view-enter stagger">
<h2 class="view-title">Checklist</h2>
<p class="view-subtitle">${escHtml(event.name)}</p>

```
  <div class="stats-grid" style="margin-bottom:16px;">
    <div class="stat-card">
      <div class="stat-value" id="checkDone" style="color:var(--green-accent);">0</div>
      <div class="stat-label">Terminés ✅</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" id="checkRemain">0</div>
      <div class="stat-label">Restants</div>
    </div>
  </div>

  <div style="margin-bottom:16px;">
    <div class="progress-bar" style="height:8px;"><div class="progress-fill" id="checkProgress" style="width:0%;"></div></div>
    <div style="font-size:12px;color:var(--text-tertiary);margin-top:5px;text-align:right;" id="checkPct">0%</div>
  </div>

  <div style="display:flex;gap:8px;margin-bottom:20px;">
    <button class="btn-primary" id="addCheckBtn" style="flex:2;">+ Ajouter une tâche</button>
    <button class="btn-secondary" id="loadTemplateBtn" style="flex:1;font-size:13px;">📋 Template</button>
  </div>

  <div id="checklistByCategory"></div>
  <div style="height:40px;"></div>
</div>
```

`;

window.__nightrCheckState = state;
window.__nightrCheckEvent = event;

if (unsubChecklist) unsubChecklist();
unsubChecklist = listenSubCollection(state.user.uid, event.id, ‘checklist’, items => {
renderChecklistUI(container, items, state, event);
});

container.querySelector(’#addCheckBtn’).addEventListener(‘click’, () => showAddTaskModal(state, event));
container.querySelector(’#loadTemplateBtn’).addEventListener(‘click’, () => showTemplateModal(state, event));
}

function renderChecklistUI(container, items, state, event) {
const done   = items.filter(i => i.done).length;
const remain = items.length - done;
const pct    = items.length > 0 ? Math.round((done / items.length) * 100) : 0;

const q = (id) => container.querySelector(’#’ + id);
if (q(‘checkDone’))     q(‘checkDone’).textContent   = done;
if (q(‘checkRemain’))   q(‘checkRemain’).textContent  = remain;
if (q(‘checkProgress’)) q(‘checkProgress’).style.width = pct + ‘%’;
if (q(‘checkPct’))      q(‘checkPct’).textContent     = pct + ‘% terminés’;

// Update badge
const badge = document.getElementById(‘badgeChecklist’);
if (badge) badge.textContent = remain > 0 ? remain : ‘’;

// Group by category
const byCat = {};
items.forEach(item => {
const cat = item.category || ‘📦 Autre’;
if (!byCat[cat]) byCat[cat] = [];
byCat[cat].push(item);
});

const el = container.querySelector(’#checklistByCategory’);
if (!el) return;

if (items.length === 0) {
el.innerHTML = `<div class="empty-state"> <div class="empty-icon">✅</div> <div class="empty-title">Liste vide</div> <div class="empty-desc">Ajoute des tâches ou charge un template pour commencer.</div> </div>`;
return;
}

el.innerHTML = Object.entries(byCat).map(([cat, catItems]) => `<div style="margin-bottom:20px;"> <p class="section-title">${cat}</p> ${catItems.map(item =>`
<div class="list-item" data-task-id="${item.id}" style="${item.done ? 'opacity:0.55;' : ''}">
<button class="check-toggle" data-id="${item.id}" data-done="${item.done}" style="
width:28px;height:28px;border-radius:50%;flex-shrink:0;cursor:pointer;
background:${item.done ? 'rgba(16,185,129,0.3)' : 'var(--glass-bg)'};
border:2px solid ${item.done ? 'rgba(16,185,129,0.5)' : 'var(--glass-border)'};
color:${item.done ? '#34d399' : 'transparent'};font-size:14px;
display:flex;align-items:center;justify-content:center;
transition:all 0.2s;">✓</button>
<div class="list-item-content">
<div class="list-item-title" style="${item.done ? 'text-decoration:line-through;color:var(--text-tertiary);' : ''}">${escHtml(item.name)}</div>
${item.dueDate ? `<div class="list-item-subtitle">📅 ${item.dueDate}</div>` : ‘’}
${item.notes ? `<div class="list-item-subtitle">${escHtml(item.notes)}</div>` : ‘’}
</div>
<button class="del-task glass-btn" data-id="${item.id}" style="width:28px;height:28px;font-size:11px;color:var(--text-tertiary);">✕</button>
</div>
`).join('')} </div> `).join(’’);

// Toggle done
el.querySelectorAll(’.check-toggle’).forEach(btn => {
btn.addEventListener(‘click’, async () => {
const isDone = btn.dataset.done === ‘true’;
await updateSubItem(state.user.uid, event.id, ‘checklist’, btn.dataset.id, { done: !isDone });
});
});

// Delete
el.querySelectorAll(’.del-task’).forEach(btn => {
btn.addEventListener(‘click’, async () => {
await deleteSubItem(state.user.uid, event.id, ‘checklist’, btn.dataset.id);
});
});
}

function showAddTaskModal(state, event) {
const close = showModal(`<h3 class="modal-title">Nouvelle tâche</h3> <div class="input-group"> <label class="input-label">Tâche *</label> <input class="input-field" id="tName" type="text" placeholder="Confirmer le traiteur…" /> </div> <div class="input-group"> <label class="input-label">Catégorie</label> <input class="input-field" id="tCat" type="text" placeholder="🍕 Nourriture…" /> </div> <div class="input-group"> <label class="input-label">Date limite</label> <input class="input-field" id="tDue" type="date" /> </div> <div class="input-group"> <label class="input-label">Notes</label> <input class="input-field" id="tNotes" type="text" placeholder="Optionnel…" /> </div> <div style="display:flex;gap:12px;margin-top:16px;"> <button class="btn-secondary" id="cancelTask" style="flex:1;">Annuler</button> <button class="btn-primary" id="saveTask" style="flex:2;">Ajouter</button> </div>`);

document.getElementById(‘cancelTask’).addEventListener(‘click’, close);
document.getElementById(‘saveTask’).addEventListener(‘click’, async () => {
const name = document.getElementById(‘tName’).value.trim();
if (!name) { showToast(‘La tâche est requise’, ‘error’); return; }
await addSubItem(state.user.uid, event.id, ‘checklist’, {
name,
category: document.getElementById(‘tCat’).value.trim() || ‘📦 Autre’,
dueDate: document.getElementById(‘tDue’).value || null,
notes: document.getElementById(‘tNotes’).value.trim() || null,
done: false,
});
showToast(‘Tâche ajoutée !’, ‘success’);
close();
});
}

function showTemplateModal(state, event) {
const close = showModal(`<h3 class="modal-title">Charger un template</h3> <p class="modal-subtitle">Ça ajoutera des tâches pré-définies à ta checklist</p> ${Object.keys(TEMPLATES).map(name =>`
<button class="list-item template-load" data-template="${name}" style="width:100%;cursor:pointer;background:var(--glass-bg);border:1px solid var(--glass-border);border-radius:var(--radius-md);margin-bottom:8px;">
<div class="list-item-icon">📋</div>
<div class="list-item-content">
<div class="list-item-title">${name}</div>
<div class="list-item-subtitle">${TEMPLATES[name].length} tâches</div>
</div>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
</button>
`).join('')} <button class="btn-secondary btn-full" id="cancelTemplate" style="margin-top:8px;">Annuler</button> `);

document.getElementById(‘cancelTemplate’).addEventListener(‘click’, close);
document.querySelectorAll(’.template-load’).forEach(btn => {
btn.addEventListener(‘click’, async () => {
const tpl = TEMPLATES[btn.dataset.template];
const eventDate = event.date ? new Date(event.date) : new Date();
for (const task of tpl) {
const due = new Date(eventDate);
due.setDate(due.getDate() + task.dueOffset);
await addSubItem(state.user.uid, event.id, ‘checklist’, {
name: task.name,
category: task.category,
dueDate: due.toISOString().split(‘T’)[0],
done: false,
notes: null,
});
}
showToast(`${tpl.length} tâches ajoutées !`, ‘success’);
close();
});
});
}

function escHtml(s) { if (!s) return ‘’; return s.replace(/&/g,’&’).replace(/</g,’<’).replace(/>/g,’>’).replace(/”/g,’"’); }
function noEventHtml() {
return `<div class="view-enter"><div class="empty-state"><div class="empty-icon">✅</div><div class="empty-title">Aucune soirée active</div></div></div>`;
}