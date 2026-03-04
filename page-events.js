// ===== page-events.js =====
import { dbGet, dbSet, dbDelete, genId, showToast, openModal, closeModal } from ‘./app.js’;

let events = [];
let container;

export async function renderEvents(el) {
container = el;
events = await dbGet(‘events’);
draw();
}

function draw() {
const sorted = […events].sort((a, b) => (a.date || ‘’) < (b.date || ‘’) ? -1 : 1);
container.innerHTML = `<h2 class="section-title">🎉 Mes Soirées</h2> ${sorted.length === 0 ? emptyState() : sorted.map(eventCard).join('')} <div style="height:80px"></div> <button class="fab" id="fab-add-event">+</button>`;
container.querySelector(’#fab-add-event’).onclick = () => openEventForm();
sorted.forEach(ev => {
container.querySelector(`[data-id="${ev.id}"]`)?.addEventListener(‘click’, () => openEventDetail(ev));
});
}

function emptyState() {
return `<div class="empty-state">
<div class="empty-icon">🎉</div>
<div class="empty-title">Aucune soirée</div>
<div class="empty-sub">Crée ta première soirée !</div>

  </div>`;
}

function eventCard(ev) {
const countdown = getCountdown(ev.date);
const statusClass = { draft: ‘status-draft’, confirmed: ‘status-confirmed’, upcoming: ‘status-upcoming’, done: ‘status-done’ }[ev.status] || ‘status-draft’;
const statusLabel = { draft: ‘Brouillon’, confirmed: ‘Confirmé’, upcoming: ‘En cours’, done: ‘Terminé’ }[ev.status] || ‘Brouillon’;
return `<div class="event-card" data-id="${ev.id}"> <div class="event-card-bg" style="${ev.color ?`background:linear-gradient(135deg,${ev.color}33,${ev.color}11)`: ''}"></div> <div class="event-card-content"> <div class="event-card-status ${statusClass}">${statusLabel}</div> <div class="event-card-name">${ev.name}</div> <div class="event-card-meta"> ${ev.date ?`<span>📅 ${formatDate(ev.date)}</span>`: ''} ${ev.location ?`<span>📍 ${ev.location}</span>`: ''} ${ev.guestCount ?`<span>👥 ${ev.guestCount} invités</span>`: ''} </div> ${countdown ?`<div class="event-card-countdown">⏳ ${countdown}</div>` : ''} </div> </div>`;
}

function openEventDetail(ev) {
openModal(`<div class="modal-title">${ev.name}</div> <div class="glass-card" style="margin-bottom:12px"> ${ev.date ?`<div class="flex-row"><span>📅</span><span>${formatDate(ev.date)} ${ev.time || ‘’}</span></div>`: ''} ${ev.location ?`<div class="flex-row mt8"><span>📍</span><span>${ev.location}</span></div>`: ''} ${ev.theme ?`<div class="flex-row mt8"><span>🎨</span><span>Thème : ${ev.theme}</span></div>`: ''} ${ev.maxGuests ?`<div class="flex-row mt8"><span>👥</span><span>Max ${ev.maxGuests} invités</span></div>`: ''} ${ev.description ?`<div class="mt8" style="color:var(--text-muted);font-size:14px">${ev.description}</div>`: ''} </div> <div class="modal-actions"> <button class="btn btn-secondary" id="btn-edit-ev">✏️ Modifier</button> <button class="btn btn-danger" id="btn-del-ev">🗑️ Supprimer</button> </div>`);
document.getElementById(‘btn-edit-ev’).onclick = () => { closeModal(); openEventForm(ev); };
document.getElementById(‘btn-del-ev’).onclick = async () => {
if (!confirm(‘Supprimer cette soirée ?’)) return;
await dbDelete(‘events’, ev.id);
events = events.filter(e => e.id !== ev.id);
closeModal(); draw(); showToast(‘Soirée supprimée’);
};
}

function openEventForm(ev = null) {
const isEdit = !!ev;
const colors = [’#a855f7’, ‘#ec4899’, ‘#06b6d4’, ‘#f59e0b’, ‘#10b981’, ‘#ef4444’];
openModal(`<div class="modal-title">${isEdit ? 'Modifier' : 'Nouvelle'} Soirée</div> <div class="input-group"><label class="input-label">Nom de la soirée *</label> <input class="input-field" id="ev-name" placeholder="Ex: Rave Garden Party" value="${ev?.name || ''}" /></div> <div class="input-group"><label class="input-label">Date</label> <input class="input-field" id="ev-date" type="date" value="${ev?.date || ''}" /></div> <div class="input-group"><label class="input-label">Heure</label> <input class="input-field" id="ev-time" type="time" value="${ev?.time || ''}" /></div> <div class="input-group"><label class="input-label">Lieu</label> <input class="input-field" id="ev-location" placeholder="Adresse ou lieu" value="${ev?.location || ''}" /></div> <div class="input-group"><label class="input-label">Thème</label> <input class="input-field" id="ev-theme" placeholder="Ex: Tropical, Rave, Chic…" value="${ev?.theme || ''}" /></div> <div class="input-group"><label class="input-label">Max invités</label> <input class="input-field" id="ev-max" type="number" placeholder="Illimité" value="${ev?.maxGuests || ''}" /></div> <div class="input-group"><label class="input-label">Statut</label> <select class="select-field" id="ev-status"> ${['draft','confirmed','upcoming','done'].map(s =>`<option value=”${s}” ${ev?.status===s?‘selected’:’’}>${{draft:‘Brouillon’,confirmed:‘Confirmé’,upcoming:‘En cours’,done:‘Terminé’}[s]}</option>`).join('')} </select></div> <div class="input-group"><label class="input-label">Couleur</label> <div style="display:flex;gap:8px;flex-wrap:wrap" id="color-picker"> ${colors.map(c =>`<div data-color="${c}" style="width:32px;height:32px;border-radius:50%;background:${c};cursor:pointer;border:3px solid ${ev?.color===c?'#fff':'transparent'};transition:all .2s"></div>`).join('')} </div></div> <div class="input-group"><label class="input-label">Description</label> <textarea class="textarea-field" id="ev-desc" placeholder="Notes, infos…">${ev?.description || ''}</textarea></div> <div class="modal-actions"> <button class="btn btn-primary btn-full" id="btn-save-ev">💾 ${isEdit ? 'Enregistrer' : 'Créer'}</button> </div> `);

let selectedColor = ev?.color || colors[0];
document.getElementById(‘color-picker’).addEventListener(‘click’, e => {
const t = e.target.closest(’[data-color]’);
if (!t) return;
selectedColor = t.dataset.color;
document.querySelectorAll(’#color-picker [data-color]’).forEach(d => d.style.borderColor = ‘transparent’);
t.style.borderColor = ‘#fff’;
});

document.getElementById(‘btn-save-ev’).onclick = async () => {
const name = document.getElementById(‘ev-name’).value.trim();
if (!name) { showToast(‘Nom requis’); return; }
const data = {
name,
date: document.getElementById(‘ev-date’).value,
time: document.getElementById(‘ev-time’).value,
location: document.getElementById(‘ev-location’).value,
theme: document.getElementById(‘ev-theme’).value,
maxGuests: document.getElementById(‘ev-max’).value,
status: document.getElementById(‘ev-status’).value,
color: selectedColor,
description: document.getElementById(‘ev-desc’).value,
id: ev?.id || genId(),
};
await dbSet(‘events’, data.id, data);
if (isEdit) events = events.map(e => e.id === data.id ? data : e);
else events.push(data);
closeModal(); draw(); showToast(isEdit ? ‘Soirée modifiée ✓’ : ‘Soirée créée ✓’);
};
}

function formatDate(dateStr) {
if (!dateStr) return ‘’;
const d = new Date(dateStr + ‘T00:00:00’);
return d.toLocaleDateString(‘fr-FR’, { weekday: ‘short’, day: ‘numeric’, month: ‘short’, year: ‘numeric’ });
}

function getCountdown(dateStr) {
if (!dateStr) return null;
const now = new Date(); now.setHours(0,0,0,0);
const ev = new Date(dateStr + ‘T00:00:00’);
const diff = Math.round((ev - now) / 86400000);
if (diff < 0) return null;
if (diff === 0) return “C’est aujourd’hui ! 🎊”;
if (diff === 1) return ‘Demain !’;
return `Dans ${diff} jours`;
}