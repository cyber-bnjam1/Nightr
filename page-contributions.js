// ===== page-contributions.js =====
import { dbGet, dbSet, dbDelete, genId, showToast, openModal, closeModal } from ‘./utils.js’;

let items = [];
let guests = [];
let events = [];
let container;
let selectedEventId = null;

export async function renderContributions(el) {
container = el;
[items, guests, events] = await Promise.all([dbGet(‘contributions’), dbGet(‘guests’), dbGet(‘events’)]);
if (!selectedEventId && events.length) selectedEventId = events[0].id;
draw();
}

function draw() {
const evItems = items.filter(i => !selectedEventId || i.eventId === selectedEventId);
const cats = [‘🍺 Boissons alcoolisées’, ‘🥤 Softs’, ‘🍕 Nourriture’, ‘🎉 Déco’, ‘🔊 Matériel’, ‘🎁 Autre’];
const byCat = {};
cats.forEach(c => { byCat[c] = evItems.filter(i => i.category === c); });

container.innerHTML = `<h2 class="section-title">🛒 Contributions</h2> ${events.length > 1 ?`<select class="select-field" id="ev-select" style="margin-bottom:16px">
${events.map(ev => `<option value="${ev.id}" ${ev.id===selectedEventId?'selected':''}>${ev.name}</option>`).join(’’)}
</select>`: events.length === 1 ?`<div class="glass-card" style="margin-bottom:16px;font-weight:600">${events[0].name}</div>`: ''} ${events.length === 0 ?`<div class="empty-state"><div class="empty-icon">🛒</div><div class="empty-title">Aucune soirée</div><div class="empty-sub">Crée d’abord une soirée</div></div>`: cats.map(cat => { const catItems = byCat[cat]; if (catItems.length === 0) return ''; return`
<div style="margin-bottom:20px">
<div class="flex-between" style="margin-bottom:8px">
<div style="font-size:16px;font-weight:700">${cat}</div>
<span class="badge badge-accent">${catItems.length}</span>
</div>
${catItems.map(contribItem).join(’’)}
</div>`; }).join('')} <div style="height:80px"></div> <button class="fab" id="fab-add-contrib">+</button> `;

document.getElementById(‘ev-select’)?.addEventListener(‘change’, e => { selectedEventId = e.target.value; draw(); });
container.querySelector(’#fab-add-contrib’).onclick = () => openContribForm();
evItems.forEach(item => {
const el = container.querySelector(`[data-cid="${item.id}"]`);
el?.querySelector(’.check-box’)?.addEventListener(‘click’, (e) => { e.stopPropagation(); toggleDone(item); });
el?.querySelector(’.btn-del-contrib’)?.addEventListener(‘click’, (e) => { e.stopPropagation(); deleteContrib(item); });
el?.addEventListener(‘click’, () => openContribDetail(item));
});
container.querySelector(’#btn-suggest’)?.addEventListener(‘click’, suggestContribs);
}

function contribItem(item) {
const assigneeName = item.assigneeId ? (guests.find(g => g.id === item.assigneeId)?.name || ‘?’) : ‘Libre’;
return ` <div class="list-item" data-cid="${item.id}" style="${item.done?'opacity:0.6':''}"> <div class="check-box ${item.done?'checked':[]}"></div> <div class="list-info"> <div class="list-name ${item.done?'done':''}">${item.name}</div> <div class="list-sub">${item.quantity ? item.quantity + ' · ' : ''}${assigneeName}</div> </div> <button class="btn btn-sm btn-danger btn-del-contrib" style="padding:6px 10px">🗑️</button> </div>`;
}

async function toggleDone(item) {
item.done = !item.done;
await dbSet(‘contributions’, item.id, item);
items = items.map(x => x.id === item.id ? item : x);
draw();
}

async function deleteContrib(item) {
await dbDelete(‘contributions’, item.id);
items = items.filter(x => x.id !== item.id);
draw(); showToast(‘Supprimé’);
}

function openContribDetail(item) {
openModal(`<div class="modal-title">${item.name}</div> <div class="glass-card"> <div class="flex-row"><span>📦</span><span>${item.category}</span></div> ${item.quantity ?`<div class="flex-row mt8"><span>🔢</span><span>${item.quantity}</span></div>`: ''} ${item.assigneeId ?`<div class="flex-row mt8"><span>👤</span><span>${guests.find(g=>g.id===item.assigneeId)?.name||’?’}</span></div>`: ''} ${item.note ?`<div class="mt8" style="color:var(--text-muted)">${item.note}</div>`: ''} </div> <div class="modal-actions"> <button class="btn btn-secondary" id="btn-edit-c">✏️ Modifier</button> <button class="btn btn-danger" id="btn-del-c">🗑️ Supprimer</button> </div>`);
document.getElementById(‘btn-edit-c’).onclick = () => { closeModal(); openContribForm(item); };
document.getElementById(‘btn-del-c’).onclick = async () => {
await dbDelete(‘contributions’, item.id);
items = items.filter(x => x.id !== item.id);
closeModal(); draw(); showToast(‘Supprimé’);
};
}

function openContribForm(item = null) {
const cats = [‘🍺 Boissons alcoolisées’, ‘🥤 Softs’, ‘🍕 Nourriture’, ‘🎉 Déco’, ‘🔊 Matériel’, ‘🎁 Autre’];
const isEdit = !!item;
openModal(`<div class="modal-title">${isEdit ? 'Modifier' : 'Ajouter'} une contribution</div> <div class="input-group"><label class="input-label">Quoi *</label> <input class="input-field" id="c-name" placeholder="Ex: Vin rouge, Chips, Enceinte…" value="${item?.name||''}" /></div> <div class="input-group"><label class="input-label">Catégorie</label> <select class="select-field" id="c-cat"> ${cats.map(c =>`<option value=”${c}” ${item?.category===c?‘selected’:’’}>${c}</option>`).join('')} </select></div> <div class="input-group"><label class="input-label">Quantité</label> <input class="input-field" id="c-qty" placeholder="Ex: 2 bouteilles, 3 packs…" value="${item?.quantity||''}" /></div> <div class="input-group"><label class="input-label">Assigné à</label> <select class="select-field" id="c-assignee"> <option value="">Libre (non assigné)</option> ${guests.map(g => `<option value=”${g.id}” ${item?.assigneeId===g.id?‘selected’:’’}>${g.name}</option>`).join('')} </select></div> <div class="input-group"><label class="input-label">Note</label> <input class="input-field" id="c-note" placeholder="Précisions…" value="${item?.note||''}" /></div> <div class="modal-actions"> <button class="btn btn-primary btn-full" id="btn-save-c">💾 ${isEdit?'Enregistrer':'Ajouter'}</button> </div> `);
document.getElementById(‘btn-save-c’).onclick = async () => {
const name = document.getElementById(‘c-name’).value.trim();
if (!name) { showToast(‘Nom requis’); return; }
const data = {
name, category: document.getElementById(‘c-cat’).value,
quantity: document.getElementById(‘c-qty’).value,
assigneeId: document.getElementById(‘c-assignee’).value,
note: document.getElementById(‘c-note’).value,
done: item?.done || false,
eventId: selectedEventId,
id: item?.id || genId(),
};
await dbSet(‘contributions’, data.id, data);
if (isEdit) items = items.map(x => x.id === data.id ? data : x);
else items.push(data);
closeModal(); draw(); showToast(isEdit ? ‘Modifié ✓’ : ‘Ajouté ✓’);
};
}

function suggestContribs() {
const guestCount = guests.filter(g => g.rsvp === ‘yes’).length || guests.length;
const suggestions = [];
if (guestCount > 0) {
const bottles = Math.ceil(guestCount / 3);
suggestions.push({ name: `Vin (${bottles} bouteilles)`, category: ‘🍺 Boissons alcoolisées’, quantity: `${bottles} bouteilles` });
suggestions.push({ name: `Bières (${Math.ceil(guestCount/2)} packs)`, category: ‘🍺 Boissons alcoolisées’, quantity: `${Math.ceil(guestCount/2)} packs` });
suggestions.push({ name: ‘Jus de fruits’, category: ‘🥤 Softs’, quantity: ‘3 litres’ });
suggestions.push({ name: ‘Eau plate/gazeuse’, category: ‘🥤 Softs’, quantity: ‘6L’ });
suggestions.push({ name: ‘Apéritifs / Chips’, category: ‘🍕 Nourriture’, quantity: ‘5 paquets’ });
suggestions.push({ name: ‘Glacons’, category: ‘🎉 Déco’, quantity: ‘5 kg’ });
}
openModal(`<div class="modal-title">💡 Suggestions</div> <p style="color:var(--text-muted);margin-bottom:16px;font-size:14px">Basé sur ${guestCount} invités. Sélectionne ce à ajouter :</p> ${suggestions.map((s, i) =>`
<div class="checklist-item">
<div class="check-box" data-si="${i}"></div>
<div class="check-text">${s.name} <span style="color:var(--text-muted);font-size:12px">· ${s.quantity}</span></div>
</div>`).join('')} <button class="btn btn-primary btn-full mt16" id="btn-add-suggestions">➕ Ajouter la sélection</button> `);
const selected = new Set();
document.querySelectorAll(’[data-si]’).forEach(box => {
box.addEventListener(‘click’, () => {
const i = parseInt(box.dataset.si);
if (selected.has(i)) { selected.delete(i); box.classList.remove(‘checked’); }
else { selected.add(i); box.classList.add(‘checked’); }
});
});
document.getElementById(‘btn-add-suggestions’).onclick = async () => {
for (const i of selected) {
const s = suggestions[i];
const data = { …s, done: false, eventId: selectedEventId, id: genId() };
await dbSet(‘contributions’, data.id, data);
items.push(data);
}
closeModal(); draw(); showToast(`${selected.size} élément(s) ajouté(s) ✓`);
};
}
