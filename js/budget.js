// ============================================================
// NIGHTR — Budget & Statistiques
// ============================================================
import { showModal, showToast, getActiveEvent } from ‘./app.js’;
import { addSubItem, deleteSubItem, listenSubCollection, updateEvent } from ‘./firebase.js’;

let unsubExpenses = null;

const EXPENSE_CATS = [‘🍾 Boissons’,‘🍕 Traiteur’,‘🎈 Décoration’,‘🎵 Musique/DJ’,‘🏠 Location’,‘💡 Éclairage’,‘📷 Photo/Vidéo’,‘🎭 Animation’,‘📦 Autre’];

export function renderBudget(container, state) {
const event = getActiveEvent();
if (!event) { container.innerHTML = noEventHtml(); return; }

container.innerHTML = `
<div class="view-enter stagger">
<h2 class="view-title">Budget & Stats</h2>
<p class="view-subtitle">${escHtml(event.name)}</p>

```
  <!-- Budget overview -->
  <div class="glass-card-strong" style="padding:20px;margin-bottom:20px;border-radius:var(--radius-xl);">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
      <div>
        <div style="font-size:12px;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Budget total</div>
        <div style="font-family:var(--font-display);font-size:36px;font-weight:800;" id="budgetTotal">${event.budget || 0}€</div>
      </div>
      <button class="glass-btn" id="editBudgetBtn" style="width:auto;padding:0 14px;font-size:13px;">Modifier</button>
    </div>
    <div style="margin-bottom:8px;">
      <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px;">
        <span style="color:var(--text-secondary);">Dépensé</span>
        <span id="spentLabel" style="font-weight:600;">0€</span>
      </div>
      <div class="progress-bar" style="height:8px;">
        <div class="progress-fill" id="budgetProgress" style="width:0%;"></div>
      </div>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:13px;">
      <span style="color:var(--text-secondary);">Restant</span>
      <span id="remainingLabel" style="color:var(--green-accent);font-weight:600;">0€</span>
    </div>
  </div>

  <!-- Cost per person -->
  <div class="stats-grid" style="margin-bottom:20px;">
    <div class="stat-card">
      <div class="stat-value" id="statCostPP" style="color:var(--cyan-accent);">0€</div>
      <div class="stat-label">Coût / personne</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" id="statExpenses" style="color:var(--purple-light);">0</div>
      <div class="stat-label">Dépenses</div>
    </div>
  </div>

  <!-- Chart placeholder -->
  <div class="glass-card" style="padding:16px;margin-bottom:20px;min-height:160px;display:flex;flex-direction:column;gap:8px;" id="chartArea">
    <div style="font-family:var(--font-display);font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text-tertiary);">Répartition</div>
    <div id="categoryBars"></div>
  </div>

  <button class="btn-primary btn-full" id="addExpenseBtn" style="margin-bottom:16px;">+ Ajouter une dépense</button>

  <p class="section-title">Détail des dépenses</p>
  <div id="expensesList"></div>
  <div style="height:40px;"></div>
</div>
```

`;

if (unsubExpenses) unsubExpenses();
unsubExpenses = listenSubCollection(state.user.uid, event.id, ‘expenses’, expenses => {
renderExpensesUI(container, expenses, event, state);
});

container.querySelector(’#addExpenseBtn’).addEventListener(‘click’, () => showAddExpenseModal(state, event));
container.querySelector(’#editBudgetBtn’).addEventListener(‘click’, () => showEditBudgetModal(state, event));
}

function renderExpensesUI(container, expenses, event, state) {
const total = parseFloat(event.budget) || 0;
const spent = expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
const remaining = total - spent;
const pct = total > 0 ? Math.min(100, Math.round((spent / total) * 100)) : 0;
const guests = event.confirmedCount || event.guestCount || 1;

// Update totals
const q = (id) => container.querySelector(’#’ + id);
if (q(‘spentLabel’))     q(‘spentLabel’).textContent = spent.toFixed(2) + ‘€’;
if (q(‘remainingLabel’)) q(‘remainingLabel’).textContent = remaining.toFixed(2) + ‘€’;
if (q(‘remainingLabel’)) q(‘remainingLabel’).style.color = remaining < 0 ? ‘var(–red-accent)’ : ‘var(–green-accent)’;
if (q(‘budgetProgress’)) {
q(‘budgetProgress’).style.width = pct + ‘%’;
q(‘budgetProgress’).style.background = pct > 90 ? ‘linear-gradient(90deg,var(–amber-accent),var(–red-accent))’ : ‘’;
}
if (q(‘statCostPP’))   q(‘statCostPP’).textContent   = (spent / guests).toFixed(0) + ‘€’;
if (q(‘statExpenses’)) q(‘statExpenses’).textContent  = expenses.length;

// Category bars
const byCat = {};
expenses.forEach(e => {
const c = e.category || ‘📦 Autre’;
byCat[c] = (byCat[c] || 0) + (parseFloat(e.amount) || 0);
});
const bars = container.querySelector(’#categoryBars’);
if (bars) {
if (Object.keys(byCat).length === 0) {
bars.innerHTML = `<div style="color:var(--text-tertiary);font-size:13px;text-align:center;padding:24px 0;">Aucune dépense pour l'instant</div>`;
} else {
const max = Math.max(…Object.values(byCat));
bars.innerHTML = Object.entries(byCat).sort((a,b)=>b[1]-a[1]).map(([cat, amt]) => `<div style="margin-bottom:8px;"> <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px;"> <span style="color:var(--text-secondary);">${cat}</span> <span style="font-weight:600;">${amt.toFixed(0)}€</span> </div> <div class="progress-bar" style="height:5px;"> <div class="progress-fill" style="width:${(amt/max*100).toFixed(0)}%;"></div> </div> </div>`).join(’’);
}
}

// Expenses list
const list = container.querySelector(’#expensesList’);
if (!list) return;
if (expenses.length === 0) {
list.innerHTML = `<div class="empty-state"><div class="empty-icon">💸</div><div class="empty-title">Aucune dépense</div></div>`;
return;
}
list.innerHTML = expenses.map(exp => `<div class="list-item"> <div class="list-item-icon" style="background:var(--glass-bg-strong);">${exp.category?.charAt(0) || '💸'}</div> <div class="list-item-content"> <div class="list-item-title">${escHtml(exp.name)}</div> <div class="list-item-subtitle">${exp.category || ''} ${exp.paidBy ? '· Payé par ' + escHtml(exp.paidBy) : ''}</div> </div> <div style="display:flex;align-items:center;gap:8px;"> <div style="font-family:var(--font-display);font-size:16px;font-weight:700;color:var(--purple-light);">${parseFloat(exp.amount).toFixed(0)}€</div> <button class="del-expense glass-btn" data-id="${exp.id}" style="width:28px;height:28px;font-size:12px;color:var(--text-tertiary);">✕</button> </div> </div>`).join(’’);

list.querySelectorAll(’.del-expense’).forEach(btn => {
btn.addEventListener(‘click’, async () => {
if (confirm(‘Supprimer cette dépense ?’)) {
await deleteSubItem(state.user.uid, event.id, ‘expenses’, btn.dataset.id);
const newSpent = expenses.filter(e => e.id !== btn.dataset.id).reduce((s,e) => s + parseFloat(e.amount||0), 0);
await updateEvent(state.user.uid, event.id, { spent: newSpent });
}
});
});

// Persist spent
updateEvent(state.user.uid, event.id, { spent });
}

function showAddExpenseModal(state, event) {
const close = showModal(`<h3 class="modal-title">Ajouter une dépense</h3> <div class="input-group"> <label class="input-label">Description *</label> <input class="input-field" id="eName" type="text" placeholder="Catering, sono, …" /> </div> <div class="input-group"> <label class="input-label">Montant (€) *</label> <input class="input-field" id="eAmount" type="number" placeholder="0" min="0" step="0.01" /> </div> <div class="input-group"> <label class="input-label">Catégorie</label> <select class="input-field" id="eCategory"> ${EXPENSE_CATS.map(c =>`<option>${c}</option>`).join('')} </select> </div> <div class="input-group"> <label class="input-label">Payé par</label> <input class="input-field" id="ePaidBy" type="text" placeholder="Ton nom…" /> </div> <div style="display:flex;gap:12px;margin-top:16px;"> <button class="btn-secondary" id="cancelExp" style="flex:1;">Annuler</button> <button class="btn-primary" id="saveExp" style="flex:2;">Ajouter</button> </div> `);

document.getElementById(‘cancelExp’).addEventListener(‘click’, close);
document.getElementById(‘saveExp’).addEventListener(‘click’, async () => {
const name   = document.getElementById(‘eName’).value.trim();
const amount = parseFloat(document.getElementById(‘eAmount’).value);
if (!name || isNaN(amount) || amount <= 0) { showToast(‘Nom et montant requis’, ‘error’); return; }
await addSubItem(state.user.uid, event.id, ‘expenses’, {
name, amount,
category: document.getElementById(‘eCategory’).value,
paidBy: document.getElementById(‘ePaidBy’).value.trim() || null,
});
showToast(`${name} — ${amount}€ ajouté !`, ‘success’);
close();
});
}

function showEditBudgetModal(state, event) {
const close = showModal(`<h3 class="modal-title">Budget total</h3> <div class="input-group"> <label class="input-label">Montant (€)</label> <input class="input-field" id="budgetInput" type="number" value="${event.budget || 0}" min="0" step="10" /> </div> <div style="display:flex;gap:12px;margin-top:16px;"> <button class="btn-secondary" id="cancelBudget" style="flex:1;">Annuler</button> <button class="btn-primary" id="saveBudget" style="flex:2;">Enregistrer</button> </div>`);

document.getElementById(‘cancelBudget’).addEventListener(‘click’, close);
document.getElementById(‘saveBudget’).addEventListener(‘click’, async () => {
const val = parseFloat(document.getElementById(‘budgetInput’).value);
await updateEvent(state.user.uid, event.id, { budget: isNaN(val) ? 0 : val });
showToast(‘Budget mis à jour !’, ‘success’);
close();
});
}

function escHtml(s) { if (!s) return ‘’; return s.replace(/&/g,’&’).replace(/</g,’<’).replace(/>/g,’>’).replace(/”/g,’"’); }
function noEventHtml() {
return `<div class="view-enter"><div class="empty-state"><div class="empty-icon">💰</div><div class="empty-title">Aucune soirée active</div></div></div>`;
}