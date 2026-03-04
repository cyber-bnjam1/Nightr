// ===== page-ambiance.js =====
import { dbGet, dbSet, dbDelete, genId, showToast, openModal, closeModal } from ‘./utils.js’;

let items = [];
let events = [];
let container;
let selectedEventId = null;
let activeTab = ‘music’;

export async function renderAmbiance(el) {
container = el;
[items, events] = await Promise.all([dbGet(‘ambiance’), dbGet(‘events’)]);
if (!selectedEventId && events.length) selectedEventId = events[0].id;
draw();
}

const TABS = { music: ‘🎵 Musique’, checklist: ‘✅ Checklist’, timeline: ‘⏱️ Timeline’, plan: ‘🗺️ Plan’ };

function draw() {
const evItems = items.filter(i => !selectedEventId || i.eventId === selectedEventId);
container.innerHTML = `<h2 class="section-title">🎵 Ambiance</h2> ${events.length > 1 ?`<select class="select-field" id="ev-select" style="margin-bottom:16px">
${events.map(e => `<option value="${e.id}" ${e.id===selectedEventId?'selected':''}>${e.name}</option>`).join(’’)}
</select>`: ''} ${events.length === 0 ?`<div class="empty-state"><div class="empty-icon">🎵</div><div class="empty-title">Aucune soirée</div></div>`:`
<div style="display:flex;gap:6px;margin-bottom:20px;overflow-x:auto;padding-bottom:4px">
${Object.entries(TABS).map(([k,v]) => `<button class="btn btn-sm ${activeTab===k?'btn-primary':'btn-secondary'}" data-tab="${k}" style="white-space:nowrap">${v}</button>`).join(’’)}
</div>
<div id="tab-content"></div>
<div style="height:80px"></div>
`} `;

document.getElementById(‘ev-select’)?.addEventListener(‘change’, e => { selectedEventId = e.target.value; draw(); });
document.querySelectorAll(’[data-tab]’).forEach(btn => btn.addEventListener(‘click’, () => { activeTab = btn.dataset.tab; draw(); }));

if (events.length) {
const tc = document.getElementById(‘tab-content’);
const filtered = evItems.filter(i => i.type === activeTab);
if (activeTab === ‘music’) drawMusic(tc, filtered);
if (activeTab === ‘checklist’) drawChecklist(tc, filtered);
if (activeTab === ‘timeline’) drawTimeline(tc, filtered);
if (activeTab === ‘plan’) drawPlan(tc, filtered);
}
}

// ===== MUSIC =====
function drawMusic(tc, filtered) {
tc.innerHTML = `<div style="margin-bottom:16px"> ${filtered.map(m =>`
<div class="list-item" data-amid="${m.id}">
<div style="font-size:28px">${m.platform === ‘spotify’ ? ‘💚’ : m.platform === ‘apple’ ? ‘🍎’ : ‘🎵’}</div>
<div class="list-info">
<div class="list-name">${m.name}</div>
<div class="list-sub">${m.platform || ‘Lien’} ${m.url ? `· <a href="${m.url}" target="_blank" style="color:var(--accent)">Ouvrir</a>` : ‘’}</div>
</div>
<button class="btn-del btn btn-sm btn-danger" data-amid="${m.id}">🗑️</button>
</div>`).join('')} ${filtered.length === 0 ? `<div class="empty-state"><div class="empty-icon">🎵</div><div class="empty-title">Aucune playlist</div></div>`: ''} </div> <button class="btn btn-primary btn-full" id="btn-add-music">➕ Ajouter une playlist</button>`;
tc.querySelectorAll(’.btn-del’).forEach(btn => btn.addEventListener(‘click’, async () => {
await dbDelete(‘ambiance’, btn.dataset.amid);
items = items.filter(i => i.id !== btn.dataset.amid);
draw();
}));
tc.querySelector(’#btn-add-music’).onclick = () => {
openModal(`<div class="modal-title">🎵 Ajouter une playlist</div> <div class="input-group"><label class="input-label">Nom</label><input class="input-field" id="m-name" placeholder="Playlist soirée" /></div> <div class="input-group"><label class="input-label">Plateforme</label> <select class="select-field" id="m-platform"> <option value="spotify">Spotify</option><option value="apple">Apple Music</option><option value="youtube">YouTube</option><option value="other">Autre</option> </select></div> <div class="input-group"><label class="input-label">Lien</label><input class="input-field" id="m-url" type="url" placeholder="https://…" /></div> <button class="btn btn-primary btn-full" id="btn-save-m">💾 Ajouter</button>`);
document.getElementById(‘btn-save-m’).onclick = async () => {
const name = document.getElementById(‘m-name’).value.trim() || ‘Playlist’;
const data = { name, platform: document.getElementById(‘m-platform’).value, url: document.getElementById(‘m-url’).value, type: ‘music’, eventId: selectedEventId, id: genId() };
await dbSet(‘ambiance’, data.id, data);
items.push(data); closeModal(); draw(); showToast(‘Playlist ajoutée ✓’);
};
};
}

// ===== CHECKLIST =====
const DEFAULT_CHECKLIST = [‘🧊 Glacons’, ‘🔊 Enceinte + câble’, ‘🔌 Multiprise’, ‘🕯️ Bougies / lumières’, ‘🗑️ Sacs poubelles’, ‘🧻 Papier toilette’, ‘🥄 Couverts / assiettes’, ‘🍾 Décapsuleur / tire-bouchon’];
function drawChecklist(tc, filtered) {
tc.innerHTML = `${filtered.map(item =>`
<div class="checklist-item">
<div class="check-box ${item.done?'checked':''}" data-amid="${item.id}"></div>
<div class="check-text ${item.done?'done':''}">${item.name}</div>
<button class="btn btn-sm btn-danger btn-del-cl" data-amid="${item.id}" style="padding:4px 8px;font-size:12px">🗑️</button>
</div>`).join('')} ${filtered.length === 0 ? `<div style="color:var(--text-muted);text-align:center;padding:20px 0">Aucun élément — ajoute depuis les suggestions !</div>`: ''} <div class="sep"></div> <button class="btn btn-secondary btn-full" id="btn-suggestions-cl">💡 Suggestions</button> <div class="input-group mt16"><label class="input-label">Ajouter manuellement</label> <div class="flex-row"><input class="input-field" id="cl-new" placeholder="Nom de l'élément" /> <button class="btn btn-primary" id="btn-add-cl">+</button></div> </div>`;
tc.querySelectorAll(’.check-box[data-amid]’).forEach(box => box.addEventListener(‘click’, async () => {
const item = items.find(i => i.id === box.dataset.amid);
if (!item) return;
item.done = !item.done;
await dbSet(‘ambiance’, item.id, item);
items = items.map(x => x.id === item.id ? x : x);
draw();
}));
tc.querySelectorAll(’.btn-del-cl’).forEach(btn => btn.addEventListener(‘click’, async () => {
await dbDelete(‘ambiance’, btn.dataset.amid);
items = items.filter(i => i.id !== btn.dataset.amid);
draw();
}));
tc.querySelector(’#btn-add-cl’).onclick = async () => {
const name = tc.querySelector(’#cl-new’).value.trim();
if (!name) return;
const data = { name, done: false, type: ‘checklist’, eventId: selectedEventId, id: genId() };
await dbSet(‘ambiance’, data.id, data);
items.push(data); draw(); showToast(‘Ajouté ✓’);
};
tc.querySelector(’#btn-suggestions-cl’).onclick = async () => {
for (const name of DEFAULT_CHECKLIST) {
const data = { name, done: false, type: ‘checklist’, eventId: selectedEventId, id: genId() };
await dbSet(‘ambiance’, data.id, data);
items.push(data);
}
draw(); showToast(‘Checklist importée ✓’);
};
}

// ===== TIMELINE =====
function drawTimeline(tc, filtered) {
const sorted = […filtered].sort((a, b) => (a.time || ‘’) < (b.time || ‘’) ? -1 : 1);
tc.innerHTML = `<div style="position:relative;padding-left:24px"> <div style="position:absolute;left:10px;top:0;bottom:0;width:2px;background:linear-gradient(180deg,var(--accent),var(--accent2))"></div> ${sorted.map(item =>`
<div style="position:relative;margin-bottom:16px">
<div style="position:absolute;left:-19px;top:4px;width:12px;height:12px;border-radius:50%;background:var(--accent);border:2px solid var(--bg)"></div>
<div class="glass-card" style="padding:12px">
<div class="flex-between">
<div style="font-weight:700">${item.name}</div>
<div class="flex-row">
<span style="font-size:13px;color:var(--accent)">${item.time || ‘–:–’}</span>
<button class="btn btn-sm btn-danger btn-del-tl" data-amid="${item.id}" style="padding:4px 8px;font-size:12px">🗑️</button>
</div>
</div>
${item.note ? `<div style="font-size:13px;color:var(--text-muted);margin-top:4px">${item.note}</div>` : ‘’}
</div>
</div>`).join('')} ${sorted.length === 0 ? `<div class="empty-state"><div class="empty-icon">⏱️</div><div class="empty-title">Aucune étape</div></div>`: ''} </div> <button class="btn btn-primary btn-full mt16" id="btn-add-tl">➕ Ajouter une étape</button>`;
tc.querySelectorAll(’.btn-del-tl’).forEach(btn => btn.addEventListener(‘click’, async () => {
await dbDelete(‘ambiance’, btn.dataset.amid);
items = items.filter(i => i.id !== btn.dataset.amid); draw();
}));
tc.querySelector(’#btn-add-tl’).onclick = () => {
openModal(`<div class="modal-title">⏱️ Ajouter une étape</div> <div class="input-group"><label class="input-label">Étape *</label><input class="input-field" id="tl-name" placeholder="Ex: Arrivée des invités" /></div> <div class="input-group"><label class="input-label">Heure</label><input class="input-field" id="tl-time" type="time" /></div> <div class="input-group"><label class="input-label">Note</label><input class="input-field" id="tl-note" placeholder="Détails…" /></div> <button class="btn btn-primary btn-full" id="btn-save-tl">💾 Ajouter</button>`);
document.getElementById(‘btn-save-tl’).onclick = async () => {
const name = document.getElementById(‘tl-name’).value.trim();
if (!name) { showToast(‘Nom requis’); return; }
const data = { name, time: document.getElementById(‘tl-time’).value, note: document.getElementById(‘tl-note’).value, type: ‘timeline’, eventId: selectedEventId, id: genId() };
await dbSet(‘ambiance’, data.id, data); items.push(data); closeModal(); draw(); showToast(‘Ajouté ✓’);
};
};
}

// ===== PLAN =====
function drawPlan(tc, filtered) {
const zones = filtered.filter(i => i.subtype === ‘zone’);
tc.innerHTML = `<div class="glass-card" style="margin-bottom:16px"> <div style="font-size:15px;font-weight:700;margin-bottom:12px">🗺️ Zones de la soirée</div> ${zones.map(z =>`
<div class="flex-between" style="padding:10px 0;border-bottom:1px solid var(--glass-border)">
<div class="flex-row"><span style="font-size:20px">${z.emoji||‘📍’}</span><span style="font-weight:600">${z.name}</span></div>
<div class="flex-row">
${z.capacity ? `<span class="badge badge-accent">${z.capacity} pers.</span>` : ‘’}
<button class="btn btn-sm btn-danger btn-del-zone" data-amid="${z.id}" style="padding:4px 8px">🗑️</button>
</div>
</div>`).join('')} ${zones.length === 0 ? `<div style="color:var(--text-muted);text-align:center;padding:16px">Aucune zone définie</div>`: ''} </div> <button class="btn btn-primary btn-full" id="btn-add-zone">➕ Ajouter une zone</button>`;
tc.querySelectorAll(’.btn-del-zone’).forEach(btn => btn.addEventListener(‘click’, async () => {
await dbDelete(‘ambiance’, btn.dataset.amid);
items = items.filter(i => i.id !== btn.dataset.amid); draw();
}));
tc.querySelector(’#btn-add-zone’).onclick = () => {
const emojis = [‘🕺’,‘🎵’,‘🛋️’,‘🍕’,‘🍸’,‘💃’,‘🪑’,‘🚪’];
openModal(`<div class="modal-title">🗺️ Ajouter une zone</div> <div class="input-group"><label class="input-label">Nom *</label><input class="input-field" id="z-name" placeholder="Ex: Dancefloor, Chill, Bar…" /></div> <div class="input-group"><label class="input-label">Emoji</label> <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px" id="emoji-picker"> ${emojis.map(e =>`<button style="font-size:24px;background:none;border:none;cursor:pointer;padding:4px" data-emoji="${e}">${e}</button>`).join('')} </div> </div> <div class="input-group"><label class="input-label">Capacité</label><input class="input-field" id="z-cap" type="number" placeholder="Nb personnes" /></div> <button class="btn btn-primary btn-full" id="btn-save-zone">💾 Ajouter</button> `);
let selectedEmoji = ‘📍’;
document.querySelectorAll(’[data-emoji]’).forEach(btn => btn.addEventListener(‘click’, () => {
selectedEmoji = btn.dataset.emoji;
document.querySelectorAll(’[data-emoji]’).forEach(b => b.style.opacity = ‘0.4’);
btn.style.opacity = ‘1’;
}));
document.getElementById(‘btn-save-zone’).onclick = async () => {
const name = document.getElementById(‘z-name’).value.trim();
if (!name) { showToast(‘Nom requis’); return; }
const data = { name, emoji: selectedEmoji, capacity: document.getElementById(‘z-cap’).value, type: ‘plan’, subtype: ‘zone’, eventId: selectedEventId, id: genId() };
await dbSet(‘ambiance’, data.id, data); items.push(data); closeModal(); draw(); showToast(‘Zone ajoutée ✓’);
};
};
}
