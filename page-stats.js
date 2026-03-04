// ===== page-stats.js =====
import { dbGet } from ‘./utils.js’;

let events = [], guests = [], expenses = [];
let container;

export async function renderStats(el) {
container = el;
[events, guests, expenses] = await Promise.all([dbGet(‘events’), dbGet(‘guests’), dbGet(‘expenses’)]);
draw();
}

function draw() {
if (events.length === 0) {
container.innerHTML = `<h2 class="section-title">📊 Statistiques</h2> <div class="empty-state"><div class="empty-icon">📊</div><div class="empty-title">Pas encore de données</div><div class="empty-sub">Tes stats apparaîtront ici</div></div>`;
return;
}

const totalExpenses = expenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0);
const yesGuests = guests.filter(g => g.rsvp === ‘yes’).length;
const noGuests = guests.filter(g => g.rsvp === ‘no’).length;
const waitGuests = guests.filter(g => !g.rsvp || g.rsvp === ‘wait’).length;
const rsvpRate = guests.length > 0 ? Math.round((yesGuests / guests.length) * 100) : 0;
const avgExpPerEvent = events.length > 0 ? (totalExpenses / events.length) : 0;
const perPerson = yesGuests > 0 ? (totalExpenses / yesGuests) : 0;

// Most faithful guests (those invited to most events)
const guestMap = {};
guests.forEach(g => { guestMap[g.id] = (guestMap[g.id] || 0) + 1; });
const faithfulGuests = guests.sort((a, b) => (guestMap[b.id] || 0) - (guestMap[a.id] || 0)).slice(0, 5);

// Expenses by category
const catTotals = {};
expenses.forEach(e => { catTotals[e.category] = (catTotals[e.category] || 0) + parseFloat(e.amount || 0); });
const sortedCats = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
const maxCatVal = sortedCats[0]?.[1] || 1;

container.innerHTML = `
<h2 class="section-title">📊 Statistiques</h2>

```
<div class="stat-grid">
  <div class="stat-card">
    <div class="stat-value" style="background:linear-gradient(135deg,var(--accent),var(--accent2));-webkit-background-clip:text;-webkit-text-fill-color:transparent">${events.length}</div>
    <div class="stat-label">🎉 Soirées organisées</div>
  </div>
  <div class="stat-card">
    <div class="stat-value" style="color:#4ade80">${yesGuests}</div>
    <div class="stat-label">👥 Invités confirmés</div>
  </div>
  <div class="stat-card">
    <div class="stat-value" style="color:var(--accent2)">${rsvpRate}%</div>
    <div class="stat-label">📊 Taux de réponse</div>
  </div>
  <div class="stat-card">
    <div class="stat-value" style="color:#fbbf24">${totalExpenses.toFixed(0)} €</div>
    <div class="stat-label">💰 Dépenses totales</div>
  </div>
</div>

<div class="glass-card" style="margin-bottom:16px">
  <div style="font-size:16px;font-weight:700;margin-bottom:16px">📩 Réponses RSVP</div>
  <div style="display:flex;gap:0;border-radius:12px;overflow:hidden;height:24px;margin-bottom:10px">
    ${guests.length > 0 ? `
      <div style="width:${rsvpRate}%;background:linear-gradient(90deg,#22c55e,#16a34a)"></div>
      <div style="width:${Math.round((noGuests/guests.length)*100)}%;background:linear-gradient(90deg,#ef4444,#dc2626)"></div>
      <div style="flex:1;background:rgba(255,255,255,0.1)"></div>
    ` : '<div style="flex:1;background:rgba(255,255,255,0.1)"></div>'}
  </div>
  <div style="display:flex;gap:16px;font-size:13px">
    <span style="color:#4ade80">✅ ${yesGuests} oui</span>
    <span style="color:#f87171">❌ ${noGuests} non</span>
    <span style="color:#fbbf24">⏳ ${waitGuests} attente</span>
  </div>
</div>

${sortedCats.length > 0 ? `
<div class="glass-card" style="margin-bottom:16px">
  <div style="font-size:16px;font-weight:700;margin-bottom:16px">💸 Dépenses par catégorie</div>
  ${sortedCats.map(([cat, val]) => `
    <div style="margin-bottom:12px">
      <div class="flex-between" style="margin-bottom:4px;font-size:13px">
        <span>${cat}</span>
        <span style="font-weight:700">${val.toFixed(2)} €</span>
      </div>
      <div class="progress-bar"><div class="progress-fill" style="width:${Math.round((val/maxCatVal)*100)}%"></div></div>
    </div>`).join('')}
</div>` : ''}

<div class="glass-card" style="margin-bottom:16px">
  <div style="font-size:16px;font-weight:700;margin-bottom:16px">📈 Moyennes</div>
  <div class="flex-between" style="margin-bottom:10px">
    <span style="color:var(--text-muted)">Dépenses / soirée</span>
    <span style="font-weight:700">${avgExpPerEvent.toFixed(2)} €</span>
  </div>
  <div class="flex-between" style="margin-bottom:10px">
    <span style="color:var(--text-muted)">Coût / personne</span>
    <span style="font-weight:700">${perPerson.toFixed(2)} €</span>
  </div>
  <div class="flex-between">
    <span style="color:var(--text-muted)">Invités / soirée</span>
    <span style="font-weight:700">${events.length > 0 ? (guests.length / events.length).toFixed(1) : 0}</span>
  </div>
</div>

${faithfulGuests.length > 0 ? `
<div class="glass-card" style="margin-bottom:16px">
  <div style="font-size:16px;font-weight:700;margin-bottom:12px">⭐ Invités fidèles</div>
  ${faithfulGuests.map((g, i) => `
    <div class="flex-between" style="padding:8px 0;border-bottom:1px solid var(--glass-border)">
      <div class="flex-row">
        <span style="font-size:18px">${['🥇','🥈','🥉','4️⃣','5️⃣'][i]}</span>
        <span style="font-weight:600">${g.name}</span>
        ${g.vip ? '<span class="badge badge-vip" style="font-size:10px">VIP</span>' : ''}
      </div>
      <span class="badge badge-accent">${g.rsvp === 'yes' ? '✅ Confirmé' : g.rsvp === 'no' ? '❌ Absent' : '⏳ Attente'}</span>
    </div>`).join('')}
</div>` : ''}

<div style="height:20px"></div>
```

`;
}
