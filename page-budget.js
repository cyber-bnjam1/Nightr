// ===== page-budget.js =====
import { dbGet, dbSet, dbDelete, genId, showToast, openModal, closeModal } from ‘./utils.js’;

let expenses = [];
let events = [];
let guests = [];
let container;
let selectedEventId = null;

export async function renderBudget(el) {
container = el;
[expenses, events, guests] = await Promise.all([dbGet(‘expenses’), dbGet(‘events’), dbGet(‘guests’)]);
if (!selectedEventId && events.length) selectedEventId = events[0].id;
draw();
}

const CATS = [‘🏠 Lieu’, ‘🍕 Nourriture’, ‘🍺 Boissons’, ‘🎵 Musique / DJ’, ‘🎉 Déco’, ‘📸 Photo/Vidéo’, ‘🎁 Divers’];

function draw() {
const evExpenses = expenses.filter(e => !selectedEventId || e.eventId === selectedEventId);
const ev = events.find(e => e.id === selectedEventId);
const total = evExpenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
const budget = parseFloat(ev?.budget || 0);
const remaining = budget - total;
const pct = budget > 0 ? Math.min(100, (total / budget) * 100) : 0;
const guestCount = guests.filter(g => g.rsvp === ‘yes’).length || guests.length || 1;
const perPerson = total / guestCount;

const byCat = {};
CATS.forEach(c => { byCat[c] = evExpenses.filter(e => e.category === c); });

container.innerHTML = `<h2 class="section-title">💰 Budget</h2> ${events.length > 1 ?`<select class="select-field" id="ev-select" style="margin-bottom:16px">
${events.map(e => `<option value="${e.id}" ${e.id===selectedEventId?'selected':''}>${e.name}</option>`).join(’’)}
</select>`: ''} ${events.length === 0 ?`<div class="empty-state"><div class="empty-icon">💰</div><div class="empty-title">Aucune soirée</div></div>`:`
<div class="glass-card" style="margin-bottom:16px">
<div class="flex-between">
<div>
<div style="font-size:13px;color:var(--text-muted);margin-bottom:2px">DÉPENSES TOTALES</div>
<div style="font-size:36px;font-weight:700">${total.toFixed(2)} €</div>
</div>
<button class="btn btn-sm btn-secondary" id="btn-set-budget">🎯 Budget</button>
</div>
${budget > 0 ? ` <div class="progress-bar" style="margin-top:12px"> <div class="progress-fill" style="width:${pct}%;background:${pct>90?'linear-gradient(90deg,#ef4444,#dc2626)':'linear-gradient(90deg,var(--accent),var(--accent2))'}"></div> </div> <div class="flex-between" style="margin-top:6px;font-size:13px;color:var(--text-muted)"> <span>Objectif : ${budget.toFixed(2)} €</span> <span style="color:${remaining<0?'#f87171':'#4ade80'}">${remaining>=0?'Reste':'Dépassé'} ${Math.abs(remaining).toFixed(2)} €</span> </div>` : ‘’}
</div>
<div class="stat-grid" style="margin-bottom:20px">
<div class="stat-card">
<div class="stat-value">${evExpenses.length}</div>
<div class="stat-label">Dépenses</div>
</div>
<div class="stat-card">
<div class="stat-value">${perPerson.toFixed(0)} €</div>
<div class="stat-label">Par personne</div>
</div>
</div>
${CATS.map(cat => {
const catExp = byCat[cat];
if (!catExp.length) return ‘’;
const catTotal = catExp.reduce((s, e) => s + parseFloat(e.amount||0), 0);
return ` <div style="margin-bottom:20px"> <div class="flex-between" style="margin-bottom:8px"> <div style="font-size:15px;font-weight:700">${cat}</div> <span style="font-weight:700;color:var(--accent)">${catTotal.toFixed(2)} €</span> </div> ${catExp.map(expenseItem).join('')} </div>`;
}).join(’’)}
${evExpenses.length === 0 ? `<div class="empty-state"><div class="empty-icon">💸</div><div class="empty-title">Aucune dépense</div><div class="empty-sub">Ajoute tes premières dépenses</div></div>` : ‘’}
<button class="btn btn-secondary btn-full mt16" id="btn-export">📄 Exporter PDF récap</button>
<div style="height:80px"></div>
<button class="fab" id="fab-add-expense">+</button>
`} `;

document.getElementById(‘ev-select’)?.addEventListener(‘change’, e => { selectedEventId = e.target.value; draw(); });
document.getElementById(‘btn-set-budget’)?.addEventListener(‘click’, openBudgetGoal);
document.getElementById(‘fab-add-expense’)?.addEventListener(‘click’, () => openExpenseForm());
document.getElementById(‘btn-export’)?.addEventListener(‘click’, () => exportSummary(evExpenses, ev, total, perPerson));

evExpenses.forEach(exp => {
container.querySelector(`[data-eid="${exp.id}"]`)?.addEventListener(‘click’, () => openExpenseDetail(exp));
});
}

function expenseItem(exp) {
return ` <div class="list-item" data-eid="${exp.id}"> <div class="list-info"> <div class="list-name">${exp.name}</div> <div class="list-sub">${exp.paidBy || 'Non défini'} ${exp.note ? '· ' + exp.note : ''}</div> </div> <div style="font-size:17px;font-weight:700;color:var(--accent2)">${parseFloat(exp.amount||0).toFixed(2)} €</div> </div>`;
}

function openExpenseDetail(exp) {
openModal(`<div class="modal-title">${exp.name}</div> <div class="glass-card" style="margin-bottom:14px"> <div class="flex-between"><span>Montant</span><span style="font-size:22px;font-weight:700;color:var(--accent)">${parseFloat(exp.amount||0).toFixed(2)} €</span></div> <div class="sep"></div> <div class="flex-row"><span>📦</span><span>${exp.category}</span></div> ${exp.paidBy ?`<div class="flex-row mt8"><span>👤</span><span>Payé par ${exp.paidBy}</span></div>`: ''} ${exp.note ?`<div class="mt8" style="color:var(--text-muted)">${exp.note}</div>`: ''} </div> <div class="modal-actions"> <button class="btn btn-secondary" id="btn-edit-e">✏️ Modifier</button> <button class="btn btn-danger" id="btn-del-e">🗑️ Supprimer</button> </div>`);
document.getElementById(‘btn-edit-e’).onclick = () => { closeModal(); openExpenseForm(exp); };
document.getElementById(‘btn-del-e’).onclick = async () => {
await dbDelete(‘expenses’, exp.id);
expenses = expenses.filter(x => x.id !== exp.id);
closeModal(); draw(); showToast(‘Dépense supprimée’);
};
}

function openExpenseForm(exp = null) {
const isEdit = !!exp;
openModal(`<div class="modal-title">${isEdit ? 'Modifier' : 'Ajouter'} une dépense</div> <div class="input-group"><label class="input-label">Libellé *</label> <input class="input-field" id="e-name" placeholder="Ex: Location salle, Vins…" value="${exp?.name||''}" /></div> <div class="input-group"><label class="input-label">Montant (€) *</label> <input class="input-field" id="e-amount" type="number" step="0.01" placeholder="0.00" value="${exp?.amount||''}" /></div> <div class="input-group"><label class="input-label">Catégorie</label> <select class="select-field" id="e-cat"> ${CATS.map(c =>`<option value=”${c}” ${exp?.category===c?‘selected’:’’}>${c}</option>`).join('')} </select></div> <div class="input-group"><label class="input-label">Payé par</label> <input class="input-field" id="e-paidby" placeholder="Ton prénom" value="${exp?.paidBy||''}" /></div> <div class="input-group"><label class="input-label">Note</label> <input class="input-field" id="e-note" placeholder="Précision…" value="${exp?.note||''}" /></div> <div class="modal-actions"> <button class="btn btn-primary btn-full" id="btn-save-e">💾 ${isEdit?'Enregistrer':'Ajouter'}</button> </div> `);
document.getElementById(‘btn-save-e’).onclick = async () => {
const name = document.getElementById(‘e-name’).value.trim();
const amount = document.getElementById(‘e-amount’).value;
if (!name || !amount) { showToast(‘Libellé et montant requis’); return; }
const data = {
name, amount: parseFloat(amount),
category: document.getElementById(‘e-cat’).value,
paidBy: document.getElementById(‘e-paidby’).value,
note: document.getElementById(‘e-note’).value,
eventId: selectedEventId,
id: exp?.id || genId(),
};
await dbSet(‘expenses’, data.id, data);
if (isEdit) expenses = expenses.map(x => x.id === data.id ? data : x);
else expenses.push(data);
closeModal(); draw(); showToast(isEdit ? ‘Modifié ✓’ : ‘Ajouté ✓’);
};
}

function openBudgetGoal() {
const ev = events.find(e => e.id === selectedEventId);
openModal(`<div class="modal-title">🎯 Budget objectif</div> <div class="input-group"><label class="input-label">Montant total (€)</label> <input class="input-field" id="budget-goal" type="number" step="0.01" placeholder="Ex: 500" value="${ev?.budget||''}" /></div> <button class="btn btn-primary btn-full" id="btn-save-budget">💾 Enregistrer</button>`);
document.getElementById(‘btn-save-budget’).onclick = async () => {
const { dbSet: ds } = await import(’./app.js’);
const val = document.getElementById(‘budget-goal’).value;
if (!ev) return;
ev.budget = parseFloat(val) || 0;
await dbSet(‘events’, ev.id, ev);
events = events.map(e => e.id === ev.id ? ev : e);
closeModal(); draw(); showToast(‘Budget mis à jour ✓’);
};
}

function exportSummary(evExpenses, ev, total, perPerson) {
let txt = `RÉCAP BUDGET — ${ev?.name || 'Soirée'}\n${'='.repeat(40)}\n\n`;
txt += `Total dépenses : ${total.toFixed(2)} €\n`;
if (ev?.budget) txt += `Budget objectif : ${parseFloat(ev.budget).toFixed(2)} €\n`;
txt += `Coût par personne : ${perPerson.toFixed(2)} €\n\n`;
CATS.forEach(cat => {
const catExp = evExpenses.filter(e => e.category === cat);
if (!catExp.length) return;
const catTotal = catExp.reduce((s, e) => s + parseFloat(e.amount||0), 0);
txt += `${cat} — ${catTotal.toFixed(2)} €\n`;
catExp.forEach(e => txt += `  · ${e.name} : ${parseFloat(e.amount||0).toFixed(2)} €${e.paidBy?' ('+e.paidBy+')':''}\n`);
txt += ‘\n’;
});
const blob = new Blob([txt], { type: ‘text/plain’ });
const a = document.createElement(‘a’);
a.href = URL.createObjectURL(blob);
a.download = `budget-${ev?.name || 'soiree'}.txt`;
a.click();
showToast(‘Export téléchargé ✓’);
}
