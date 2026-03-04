// ============================================================
// NIGHTR — Dashboard
// ============================================================
import { showModal, showToast, navigateTo, setActiveEvent, getActiveEvent } from ‘./app.js’;
import { createEvent, deleteEvent } from ‘./firebase.js’;

// ── Render Dashboard ──────────────────────────────────
export function renderDashboard(container, state) {
const event = getActiveEvent();
const now = new Date();

container.innerHTML = `
<div class="view-enter stagger">
<div style="margin-bottom:8px;">
<h2 class="view-title">Bonsoir 🌙</h2>
<p class="view-subtitle">${greetingDate()}</p>
</div>

```
  ${event ? renderHeroEvent(event, now) : renderNoEvent()}

  ${state.events.length > 0 ? renderEventStats(event, state) : ''}

  <p class="section-title">Mes soirées</p>
  ${renderEventList(state.events, state.activeEventId)}

  <div style="height:80px;"></div>
</div>
```

`;

// FAB
const fab = document.createElement(‘button’);
fab.className = ‘fab’;
fab.setAttribute(‘aria-label’, ‘Nouvelle soirée’);
fab.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
fab.addEventListener(‘click’, () => showNewEventModal(state));
container.appendChild(fab);

// Event card clicks
container.querySelectorAll(’[data-event-id]’).forEach(card => {
card.addEventListener(‘click’, () => {
setActiveEvent(card.dataset.eventId);
showToast(`Soirée "${card.dataset.eventName}" activée`, ‘success’);
});
card.querySelector(’.event-delete-btn’)?.addEventListener(‘click’, async e => {
e.stopPropagation();
if (confirm(‘Supprimer cette soirée ?’)) {
await deleteEvent(state.user.uid, card.dataset.eventId);
showToast(‘Soirée supprimée’, ‘info’);
}
});
});

// Quick action buttons
container.querySelector(’#quickGuests’)?.addEventListener(‘click’, () => navigateTo(‘guests’));
container.querySelector(’#quickBudget’)?.addEventListener(‘click’, () => navigateTo(‘budget’));
container.querySelector(’#quickChecklist’)?.addEventListener(‘click’, () => navigateTo(‘checklist’));
container.querySelector(’#quickInvitations’)?.addEventListener(‘click’, () => navigateTo(‘invitations’));
}

// ── Hero Event Card ────────────────────────────────────
function renderHeroEvent(event, now) {
const date = event.date ? new Date(event.date) : null;
const countdown = date ? getCountdown(date, now) : null;
const isPast = date && date < now;
const guestCount = event.guestCount || 0;
const confirmedCount = event.confirmedCount || 0;

return `<div class="hero-card" style="margin-bottom:20px;"> <div class="hero-card-bg"></div> <div class="hero-noise"></div> <div class="hero-content"> ${isPast ?`<span class="pill pill-purple" style="margin-bottom:10px;">✓ Passée</span>`: countdown ?`<div style="margin-bottom:8px;"><span class="pill pill-green">● Dans ${countdown}</span></div>`: '' } <h3 style="font-family:var(--font-display);font-size:24px;font-weight:800;margin-bottom:4px;">${event.name}</h3> <p style="font-size:13px;opacity:0.75;margin-bottom:12px;"> ${date ? formatDate(date) : 'Date à définir'} ${event.location ?` · ${event.location}`: ''} </p> <div style="display:flex;gap:16px;flex-wrap:wrap;"> ${guestCount > 0 ?`<div style="font-size:13px;opacity:0.9;">👥 ${confirmedCount}/${guestCount} confirmés</div>`: ''} ${event.budget ?`<div style="font-size:13px;opacity:0.9;">💰 ${event.budget}€ budget</div>`: ''} </div> </div> </div> <div class="stats-grid" style="margin-bottom:20px;" id="quickActions"> <button id="quickGuests" class="glass-card" style="padding:16px;text-align:left;border:none;cursor:pointer;transition:all 0.2s;"> <div style="font-size:24px;margin-bottom:6px;">👥</div> <div style="font-size:13px;font-weight:600;">Invités</div> <div style="font-size:12px;color:var(--text-secondary);">${confirmedCount} confirmés</div> </button> <button id="quickInvitations" class="glass-card" style="padding:16px;text-align:left;border:none;cursor:pointer;transition:all 0.2s;"> <div style="font-size:24px;margin-bottom:6px;">📩</div> <div style="font-size:13px;font-weight:600;">Invitations</div> <div style="font-size:12px;color:var(--text-secondary);">Créer & partager</div> </button> <button id="quickBudget" class="glass-card" style="padding:16px;text-align:left;border:none;cursor:pointer;transition:all 0.2s;"> <div style="font-size:24px;margin-bottom:6px;">💰</div> <div style="font-size:13px;font-weight:600;">Budget</div> <div style="font-size:12px;color:var(--text-secondary);">${event.budget ? event.budget + '€' : 'À définir'}</div> </button> <button id="quickChecklist" class="glass-card" style="padding:16px;text-align:left;border:none;cursor:pointer;transition:all 0.2s;"> <div style="font-size:24px;margin-bottom:6px;">✅</div> <div style="font-size:13px;font-weight:600;">Checklist</div> <div style="font-size:12px;color:var(--text-secondary);">Prépare ta soirée</div> </button> </div>`;
}

function renderNoEvent() {
return `<div class="glass-card" style="padding:32px;text-align:center;margin-bottom:24px;"> <div style="font-size:48px;margin-bottom:12px;">🎉</div> <div style="font-family:var(--font-display);font-size:18px;font-weight:700;margin-bottom:8px;">Crée ta première soirée</div> <p style="font-size:14px;color:var(--text-secondary);margin-bottom:20px;line-height:1.6;">Invite tes amis, gère le budget,<br/>génère des invitations stylées.</p> <button class="btn-primary" onclick="document.getElementById('addEventBtn').click()"> ✦ Nouvelle soirée </button> </div>`;
}

function renderEventStats(event, state) {
const upcoming = state.events.filter(e => e.date && new Date(e.date) > new Date()).length;
const past = state.events.filter(e => e.date && new Date(e.date) <= new Date()).length;

return `<div class="stats-grid" style="margin-bottom:8px;"> <div class="stat-card"> <div class="stat-value" style="color:var(--purple-light);">${state.events.length}</div> <div class="stat-label">Soirées créées</div> </div> <div class="stat-card"> <div class="stat-value" style="color:var(--green-accent);">${upcoming}</div> <div class="stat-label">À venir</div> </div> </div>`;
}

function renderEventList(events, activeId) {
if (events.length === 0) return `<div class="empty-state"><div class="empty-desc">Aucune soirée pour l'instant</div></div>`;

return events.map(event => {
const isActive = event.id === activeId;
const date = event.date ? new Date(event.date) : null;
const isPast = date && date < new Date();

```
return `
  <div class="list-item" data-event-id="${event.id}" data-event-name="${escHtml(event.name)}"
    style="${isActive ? 'border-color:rgba(168,85,247,0.4);background:rgba(124,58,237,0.12);' : ''}cursor:pointer;">
    <div class="list-item-icon" style="background:${isActive ? 'rgba(124,58,237,0.25)' : 'var(--glass-bg-strong)'};">
      ${event.emoji || '🎉'}
    </div>
    <div class="list-item-content">
      <div class="list-item-title">${escHtml(event.name)}</div>
      <div class="list-item-subtitle">
        ${date ? formatDate(date) : 'Date non définie'}
        ${event.location ? ' · ' + escHtml(event.location) : ''}
      </div>
    </div>
    <div class="list-item-action" style="display:flex;align-items:center;gap:8px;">
      ${isPast ? '<span class="pill pill-purple" style="font-size:10px;">Passée</span>' : ''}
      ${isActive ? '<span style="color:var(--purple-light);font-size:18px;">✦</span>' : ''}
      <button class="event-delete-btn" style="background:none;border:none;color:var(--text-tertiary);font-size:16px;padding:4px;cursor:pointer;border-radius:8px;">✕</button>
    </div>
  </div>
`;
```

}).join(’’);
}

// ── New Event Modal ────────────────────────────────────
export function showNewEventModal(state) {
const close = showModal(`
<h3 class="modal-title">Nouvelle soirée ✦</h3>
<p class="modal-subtitle">Crée une nouvelle soirée</p>

```
<div class="input-group">
  <label class="input-label">Emoji</label>
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;" id="emojiPicker">
    ${['🎉','🎂','🍾','🕺','🎸','🌙','🔥','🎭','🌊','🎪'].map(e =>
      `<button class="emoji-opt glass-btn" data-emoji="${e}" style="font-size:22px;width:44px;height:44px;">${e}</button>`
    ).join('')}
  </div>
</div>

<div class="input-group">
  <label class="input-label" for="eventName">Nom de la soirée *</label>
  <input class="input-field" id="eventName" type="text" placeholder="Soirée anniversaire de Lucas…" />
</div>
<div class="input-group">
  <label class="input-label" for="eventDate">Date & heure *</label>
  <input class="input-field" id="eventDate" type="datetime-local" />
</div>
<div class="input-group">
  <label class="input-label" for="eventLocation">Lieu</label>
  <input class="input-field" id="eventLocation" type="text" placeholder="12 rue des Fêtes, Paris…" />
</div>
<div class="input-group">
  <label class="input-label" for="eventBudget">Budget total (€)</label>
  <input class="input-field" id="eventBudget" type="number" placeholder="0" min="0" />
</div>
<div class="input-group">
  <label class="input-label" for="eventDressCode">Dress code</label>
  <input class="input-field" id="eventDressCode" type="text" placeholder="Tenue élégante…" />
</div>

<div style="display:flex;gap:12px;margin-top:8px;">
  <button class="btn-secondary" id="cancelNewEvent" style="flex:1;">Annuler</button>
  <button class="btn-primary" id="saveNewEvent" style="flex:2;">Créer la soirée</button>
</div>
```

`);

// Emoji picker
let selectedEmoji = ‘🎉’;
const highlightEmoji = (e) => {
document.querySelectorAll(’.emoji-opt’).forEach(b => {
b.style.background = b.dataset.emoji === e ? ‘rgba(124,58,237,0.3)’ : ‘’;
b.style.borderColor = b.dataset.emoji === e ? ‘rgba(168,85,247,0.5)’ : ‘’;
});
};
highlightEmoji(selectedEmoji);

document.querySelectorAll(’.emoji-opt’).forEach(btn => {
btn.addEventListener(‘click’, () => {
selectedEmoji = btn.dataset.emoji;
highlightEmoji(selectedEmoji);
});
});

document.getElementById(‘cancelNewEvent’).addEventListener(‘click’, close);

document.getElementById(‘saveNewEvent’).addEventListener(‘click’, async () => {
const name = document.getElementById(‘eventName’).value.trim();
if (!name) { showToast(‘Le nom est requis’, ‘error’); return; }

```
const data = {
  emoji: selectedEmoji,
  name,
  date: document.getElementById('eventDate').value || null,
  location: document.getElementById('eventLocation').value.trim() || null,
  budget: parseFloat(document.getElementById('eventBudget').value) || 0,
  dressCode: document.getElementById('eventDressCode').value.trim() || null,
  guestCount: 0,
  confirmedCount: 0,
  spent: 0,
};

try {
  const ref = await createEvent(state.user.uid, data);
  setActiveEvent(ref.id);
  showToast(`"${name}" créée ! 🎉`, 'success');
  close();
} catch(e) {
  console.error(e);
  showToast('Erreur lors de la création', 'error');
}
```

});
}

// ── Event Switcher ────────────────────────────────────
export function showEventSwitcher(state) {
const close = showModal(`<h3 class="modal-title">Changer de soirée</h3> <p class="modal-subtitle">${state.events.length} soirée(s)</p> <div id="switcherList"> ${state.events.length === 0 ?`<div class="empty-state"><div class="empty-desc">Aucune soirée créée</div></div>`: state.events.map(e =>`
<div class="list-item" data-switch-id="${e.id}" style="cursor:pointer;${e.id === state.activeEventId ? 'border-color:rgba(168,85,247,0.4);' : ''}">
<div class="list-item-icon">${e.emoji || ‘🎉’}</div>
<div class="list-item-content">
<div class="list-item-title">${escHtml(e.name)}</div>
<div class="list-item-subtitle">${e.date ? formatDate(new Date(e.date)) : ‘Date non définie’}</div>
</div>
${e.id === state.activeEventId ? ‘<span style="color:var(--purple-light);">✦</span>’ : ‘’}
</div>
`).join('') } </div> <button class="btn-primary btn-full" style="margin-top:16px;" id="newEventFromSwitcher">+ Nouvelle soirée</button> `);

document.querySelectorAll(’[data-switch-id]’).forEach(el => {
el.addEventListener(‘click’, () => {
setActiveEvent(el.dataset.switchId);
close();
});
});

document.getElementById(‘newEventFromSwitcher’)?.addEventListener(‘click’, () => {
close();
setTimeout(() => showNewEventModal(state), 450);
});
}

// ── Helpers ───────────────────────────────────────────
function greetingDate() {
const h = new Date().getHours();
if (h < 12) return ‘Bonne matinée ☀️’;
if (h < 18) return ‘Bonne après-midi 🌤️’;
if (h < 21) return ‘Bonne soirée 🌆’;
return ‘Bonne nuit 🌙’;
}

function formatDate(date) {
return date.toLocaleDateString(‘fr-FR’, { weekday: ‘short’, day: ‘numeric’, month: ‘short’, year: ‘numeric’, hour: ‘2-digit’, minute: ‘2-digit’ });
}

function getCountdown(date, now) {
const diff = date - now;
if (diff < 0) return null;
const days = Math.floor(diff / 86400000);
if (days > 0) return `${days}j`;
const hours = Math.floor(diff / 3600000);
if (hours > 0) return `${hours}h`;
return `${Math.floor(diff / 60000)}min`;
}

function escHtml(str) {
if (!str) return ‘’;
return str.replace(/&/g,’&’).replace(/</g,’<’).replace(/>/g,’>’).replace(/”/g,’"’);
}