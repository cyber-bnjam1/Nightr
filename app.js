// =============================================
//  NIGHTR - app.js
//  Logique principale (sans import ES module)
//  Firebase est injecté via window.__db
// =============================================

// ---------- ÉTAT GLOBAL ----------
let db = null;
let currentEventId = null;
let events = {};       // { id: { ...eventData, invites:[], courses:[], budget:{}, checklist:[] } }

// Types d'événement → couleurs hero
const TYPE_COLORS = {
  soiree:       ['#f97316', '#a855f7'],
  anniversaire: ['#ec4899', '#f97316'],
  cremaillere:  ['#22d3ee', '#4ade80'],
  mariage:      ['#facc15', '#f9a8d4'],
  bbq:          ['#f97316', '#ef4444'],
  autre:        ['#a855f7', '#22d3ee'],
};

// Listes auto par type
const AUTO_COURSES = {
  soiree:       ['Boissons alcoolisées', 'Sodas / Jus', 'Chips / Apéro', 'Glace & glaçons', 'Verres / Gobelets', 'Serviettes'],
  anniversaire: ['Gâteau d\'anniversaire', 'Bougies', 'Boissons', 'Chips / Apéro', 'Assiettes', 'Décorations'],
  cremaillere:  ['Boissons', 'Fromages & charcuterie', 'Pain', 'Champagne', 'Verres', 'Fleurs'],
  mariage:      ['Champagne', 'Vin rouge/blanc', 'Eau minérale', 'Sodas', 'Canapés', 'Pièce montée'],
  bbq:          ['Viandes & saucisses', 'Légumes à griller', 'Pain', 'Sauces', 'Charbon', 'Assiettes'],
  autre:        ['Boissons', 'Grignotage', 'Vaisselle jetable', 'Serviettes'],
};

const AUTO_CHECKLIST = {
  soiree:       ['Préparer la playlist', 'Acheter les boissons', 'Ranger / Nettoyer', 'Préparer la déco', 'Prévenir les voisins', 'Sortir les poubelles après'],
  anniversaire: ['Commander / Préparer le gâteau', 'Acheter les bougies', 'Préparer la déco', 'Prévoir un cadeau', 'Envoyer les invitations', 'Prévoir une surprise'],
  cremaillere:  ['Acheter les boissons', 'Nettoyer le logement', 'Préparer l\'apéro', 'Prévoir stationnement', 'Allumer les bougies / Ambiance'],
  mariage:      ['Confirmer le traiteur', 'Vérifier la salle', 'Playlist cérémonie', 'Playlist soirée', 'Plan de table', 'Fleurs & déco'],
  bbq:          ['Allumer le barbecue', 'Mariner les viandes', 'Préparer les salades', 'Vérifier le gaz / charbon', 'Prévoir une zone ombre'],
  autre:        ['Envoyer les invitations', 'Préparer le lieu', 'Faire les courses', 'Décoration'],
};

// ---------- INIT ----------
// Démarre l'app dès que le DOM est prêt.
// Firebase est optionnel : si non configuré, on tourne en localStorage.
async function startApp() {
  db = window.__db || null;
  await loadEvents();
  init();
}

// Si Firebase a déjà dispatché avant que app.js soit évalué
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    // Attend firebase-ready max 1.5s, sinon démarre en local
    let started = false;
    const go = async () => { if (!started) { started = true; await startApp(); } };
    window.addEventListener('firebase-ready', go);
    setTimeout(go, 1500);
  });
} else {
  let started = false;
  const go = async () => { if (!started) { started = true; await startApp(); } };
  window.addEventListener('firebase-ready', go);
  setTimeout(go, 1500);
}

function init() {
  // Splash → app
  setTimeout(() => {
    document.getElementById('splash').style.display = 'none';
    document.getElementById('app').classList.remove('hidden');
    renderHome();
  }, 2100);

  // Type selector modal
  document.querySelectorAll('.type-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.type-opt').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Enter key on inputs
  document.getElementById('input-invite-name').addEventListener('keydown', e => e.key === 'Enter' && addInvite());
  document.getElementById('input-course-name').addEventListener('keydown', e => e.key === 'Enter' && addCourse());
  document.getElementById('input-check-item').addEventListener('keydown', e => e.key === 'Enter' && addCheckItem());
  document.getElementById('input-depense-label').addEventListener('keydown', e => e.key === 'Enter' && addDepense());
}

// ---------- FIREBASE HELPERS ----------
// Les fonctions Firestore sont exposées sur window.__fs par le module Firebase
// Si Firebase n'est pas configuré, on tombe automatiquement sur localStorage

async function saveEvent(id) {
  localSave(); // toujours sauvegarder en local comme backup
  if (!db || !window.__fs) return;
  try {
    const { collection, doc, setDoc } = window.__fs;
    await setDoc(doc(collection(db, 'events'), id), events[id]);
  } catch(e) { console.warn('Firebase save failed', e); }
}

async function deleteEventFromDB(id) {
  localSave();
  if (!db || !window.__fs) return;
  try {
    const { collection, doc, deleteDoc } = window.__fs;
    await deleteDoc(doc(collection(db, 'events'), id));
  } catch(e) { console.warn('Firebase delete failed', e); }
}

async function loadEvents() {
  if (db && window.__fs) {
    try {
      const { collection, getDocs } = window.__fs;
      const snap = await getDocs(collection(db, 'events'));
      events = {};
      snap.forEach(d => { events[d.id] = d.data(); });
      return;
    } catch(e) { console.warn('Firebase load failed, fallback local', e); }
  }
  localLoad();
}

function localSave() { try { localStorage.setItem('nightr_events', JSON.stringify(events)); } catch(e){} }
function localLoad() { try { const d = localStorage.getItem('nightr_events'); if (d) events = JSON.parse(d); } catch(e){} }

// ---------- NAVIGATION ----------
function navigate(page, eventId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const el = document.getElementById('page-' + page);
  el.classList.add('active');

  const backBtn = document.getElementById('btn-back');
  const addBtn = document.getElementById('btn-add-event');
  const bottomNav = document.getElementById('bottom-nav');
  const headerTitle = document.getElementById('header-title');

  if (page === 'home') {
    backBtn.classList.add('hidden');
    addBtn.classList.remove('hidden');
    bottomNav.classList.remove('hidden');
    headerTitle.textContent = 'nightr';
    currentEventId = null;
  } else {
    backBtn.classList.remove('hidden');
    addBtn.classList.add('hidden');
    bottomNav.classList.add('hidden');
    currentEventId = eventId;
    const ev = events[eventId];
    headerTitle.textContent = ev.name;
    renderEventDetail(eventId);
  }
}

document.getElementById('btn-back').addEventListener('click', () => navigate('home'));

// ---------- HOME ----------
function renderHome() {
  const list = document.getElementById('events-list');
  const empty = document.getElementById('empty-state');
  const ids = Object.keys(events);

  if (ids.length === 0) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  list.innerHTML = ids.map((id, i) => {
    const ev = events[id];
    const colors = TYPE_COLORS[ev.type] || TYPE_COLORS.autre;
    const confirmed = (ev.invites || []).filter(g => g.status === 'confirmed').length;
    const total = (ev.invites || []).length;
    const dateStr = ev.date ? new Date(ev.date).toLocaleDateString('fr-FR', { day:'numeric', month:'long', year:'numeric' }) : '';
    return `
    <div class="event-card" onclick="navigate('event','${id}')" style="animation-delay:${i*0.07}s">
      <div class="event-card-actions">
        <button class="btn-delete-card" onclick="event.stopPropagation(); confirmDeleteEvent('${id}')">🗑</button>
      </div>
      <div class="event-card-header">
        <span class="event-card-emoji">${ev.emoji}</span>
        <div class="event-card-info">
          <h3>${ev.name}</h3>
          <p>${dateStr}${ev.lieu ? ' · ' + ev.lieu : ''}</p>
        </div>
      </div>
      <div class="event-card-chips">
        ${total > 0 ? `<span class="chip green">👥 ${confirmed}/${total} confirmés</span>` : ''}
        ${ev.budget?.total ? `<span class="chip orange">💸 ${ev.budget.total}€ budget</span>` : ''}
      </div>
    </div>`;
  }).join('');
}

// ---------- CRÉER ÉVÉNEMENT ----------
function openCreateEvent() {
  document.getElementById('modal-create').classList.remove('hidden');
}

function createEvent() {
  const name = document.getElementById('input-event-name').value.trim();
  const date = document.getElementById('input-event-date').value;
  const lieu = document.getElementById('input-event-lieu').value.trim();
  const activeType = document.querySelector('.type-opt.active');
  const type = activeType?.dataset.type || 'soiree';
  const emoji = activeType?.dataset.emoji || '🎉';

  if (!name) { showToast('Donne un nom à ta soirée 🎉'); return; }

  const id = 'ev_' + Date.now();
  events[id] = {
    id, name, date, lieu, type, emoji,
    invites: [],
    courses: [],
    depenses: [],
    checklist: [],
    budget: { total: 0 },
    createdAt: Date.now()
  };

  saveEvent(id);
  closeModal('modal-create');
  document.getElementById('input-event-name').value = '';
  document.getElementById('input-event-date').value = '';
  document.getElementById('input-event-lieu').value = '';
  renderHome();
  showToast('Soirée créée ! 🥂');
  setTimeout(() => navigate('event', id), 300);
}

function confirmDeleteEvent(id) {
  if (confirm(`Supprimer "${events[id]?.name}" ?`)) {
    deleteEventFromDB(id);
    delete events[id];
    renderHome();
    showToast('Soirée supprimée');
  }
}

// ---------- DÉTAIL ÉVÉNEMENT ----------
function renderEventDetail(id) {
  const ev = events[id];
  const colors = TYPE_COLORS[ev.type] || TYPE_COLORS.autre;

  // Hero
  document.getElementById('event-hero').style.background = `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`;
  document.getElementById('event-type-badge').textContent = ev.emoji + ' ' + ev.type;
  document.getElementById('event-name-display').textContent = ev.name;
  document.getElementById('event-date-display').textContent = ev.date
    ? '📅 ' + new Date(ev.date).toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long', year:'numeric' })
    : '';
  document.getElementById('event-lieu-display').textContent = ev.lieu ? '📍 ' + ev.lieu : '';

  renderInvites();
  renderCourses();
  renderDepenses();
  renderChecklist();
  updateBudgetUI();

  // Reset to first tab
  switchTab('invites');
}

// ---------- TABS ----------
function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === 'tab-' + tab));
}

// ---------- INVITÉS ----------
function addInvite() {
  const input = document.getElementById('input-invite-name');
  const name = input.value.trim();
  if (!name || !currentEventId) return;
  const ev = events[currentEventId];
  ev.invites.push({ id: Date.now(), name, status: 'pending' });
  saveEvent(currentEventId);
  input.value = '';
  renderInvites();
  showToast(name + ' ajouté·e 👥');
}

function cycleStatus(inviteId) {
  const ev = events[currentEventId];
  const invite = ev.invites.find(i => i.id === inviteId);
  if (!invite) return;
  const cycle = ['pending', 'confirmed', 'declined'];
  invite.status = cycle[(cycle.indexOf(invite.status) + 1) % 3];
  saveEvent(currentEventId);
  renderInvites();
}

function deleteInvite(inviteId) {
  const ev = events[currentEventId];
  ev.invites = ev.invites.filter(i => i.id !== inviteId);
  saveEvent(currentEventId);
  renderInvites();
}

function renderInvites() {
  const ev = events[currentEventId];
  const list = ev.invites || [];
  const total = list.length;
  const confirmed = list.filter(i => i.status === 'confirmed').length;
  const declined = list.filter(i => i.status === 'declined').length;

  document.getElementById('stat-invites').textContent = total;
  document.getElementById('stat-confirmed').textContent = confirmed;
  document.getElementById('stat-declined').textContent = declined;

  const statusLabel = { pending: '⏳ En attente', confirmed: '✅ Confirmé', declined: '❌ Absent' };
  const statusClass = { pending: '', confirmed: 'confirmed', declined: 'declined' };

  document.getElementById('invites-list').innerHTML = list.map(inv => `
    <div class="item-row">
      <span class="item-row-label">${inv.name}</span>
      <button class="btn-status ${statusClass[inv.status]}" onclick="cycleStatus(${inv.id})">${statusLabel[inv.status]}</button>
      <button class="btn-delete" onclick="deleteInvite(${inv.id})">✕</button>
    </div>
  `).join('') || '<p style="color:var(--text-muted);font-size:14px;padding:10px 0">Aucun invité pour l\'instant</p>';
}

// ---------- COURSES ----------
function addCourse() {
  const nameEl = document.getElementById('input-course-name');
  const qtyEl = document.getElementById('input-course-qty');
  const name = nameEl.value.trim();
  if (!name || !currentEventId) return;
  const qty = qtyEl.value.trim();
  events[currentEventId].courses.push({ id: Date.now(), name, qty, done: false });
  saveEvent(currentEventId);
  nameEl.value = ''; qtyEl.value = '';
  renderCourses();
}

function toggleCourse(courseId) {
  const c = events[currentEventId].courses.find(c => c.id === courseId);
  if (c) { c.done = !c.done; saveEvent(currentEventId); renderCourses(); }
}

function deleteCourse(courseId) {
  events[currentEventId].courses = events[currentEventId].courses.filter(c => c.id !== courseId);
  saveEvent(currentEventId);
  renderCourses();
}

function generateCourses() {
  const ev = events[currentEventId];
  const items = AUTO_COURSES[ev.type] || AUTO_COURSES.autre;
  items.forEach(name => {
    if (!ev.courses.find(c => c.name === name))
      ev.courses.push({ id: Date.now() + Math.random(), name, qty: '', done: false });
  });
  saveEvent(currentEventId);
  renderCourses();
  showToast('Liste générée ✨');
}

function renderCourses() {
  const list = events[currentEventId].courses || [];
  document.getElementById('courses-list').innerHTML = list.map(c => `
    <div class="item-row ${c.done ? 'done' : ''}">
      <button class="check-box ${c.done ? 'done' : ''}" onclick="toggleCourse(${c.id})">${c.done ? '✓' : ''}</button>
      <div style="flex:1">
        <div class="item-row-label">${c.name}</div>
        ${c.qty ? `<div class="item-row-sub">${c.qty}</div>` : ''}
      </div>
      <button class="btn-delete" onclick="deleteCourse(${c.id})">✕</button>
    </div>
  `).join('') || '<p style="color:var(--text-muted);font-size:14px;padding:10px 0">Aucun article pour l\'instant</p>';
}

// ---------- BUDGET ----------
function updateBudgetTotal() {
  const val = parseFloat(document.getElementById('input-budget-total').value) || 0;
  events[currentEventId].budget.total = val;
  saveEvent(currentEventId);
  updateBudgetUI();
}

function addDepense() {
  const labelEl = document.getElementById('input-depense-label');
  const amountEl = document.getElementById('input-depense-amount');
  const label = labelEl.value.trim();
  const amount = parseFloat(amountEl.value) || 0;
  if (!label || !amount || !currentEventId) return;
  events[currentEventId].depenses = events[currentEventId].depenses || [];
  events[currentEventId].depenses.push({ id: Date.now(), label, amount });
  saveEvent(currentEventId);
  labelEl.value = ''; amountEl.value = '';
  renderDepenses();
  updateBudgetUI();
}

function deleteDepense(depId) {
  events[currentEventId].depenses = events[currentEventId].depenses.filter(d => d.id !== depId);
  saveEvent(currentEventId);
  renderDepenses();
  updateBudgetUI();
}

function renderDepenses() {
  const list = events[currentEventId].depenses || [];
  document.getElementById('depenses-list').innerHTML = list.map(d => `
    <div class="item-row">
      <span class="item-row-label">${d.label}</span>
      <span class="depense-amount">${d.amount.toFixed(2)}€</span>
      <button class="btn-delete" onclick="deleteDepense(${d.id})">✕</button>
    </div>
  `).join('') || '<p style="color:var(--text-muted);font-size:14px;padding:10px 0">Aucune dépense pour l\'instant</p>';
}

function updateBudgetUI() {
  const ev = events[currentEventId];
  const total = parseFloat(ev.budget?.total) || 0;
  const spent = (ev.depenses || []).reduce((s, d) => s + d.amount, 0);
  const pct = total > 0 ? Math.min(spent / total, 1) : 0;

  document.getElementById('budget-spent-display').textContent = spent.toFixed(0) + '€';
  document.getElementById('budget-total-display').textContent = total.toFixed(0) + '€';
  document.getElementById('input-budget-total').value = total || '';

  // Arc SVG: total arc length ~157 (semicircle at r50)
  const dashoffset = 157 - pct * 157;
  document.getElementById('budget-arc-fill').style.strokeDashoffset = dashoffset;

  // Couleur si dépassé
  const arcEl = document.getElementById('budget-arc-fill');
  if (pct >= 1) {
    arcEl.style.stroke = '#f87171';
  } else {
    arcEl.style.stroke = 'url(#arcGrad)';
  }
}

// ---------- CHECKLIST ----------
function addCheckItem() {
  const input = document.getElementById('input-check-item');
  const text = input.value.trim();
  if (!text || !currentEventId) return;
  events[currentEventId].checklist.push({ id: Date.now(), text, done: false });
  saveEvent(currentEventId);
  input.value = '';
  renderChecklist();
}

function toggleCheckItem(itemId) {
  const item = events[currentEventId].checklist.find(c => c.id === itemId);
  if (item) { item.done = !item.done; saveEvent(currentEventId); renderChecklist(); }
}

function deleteCheckItem(itemId) {
  events[currentEventId].checklist = events[currentEventId].checklist.filter(c => c.id !== itemId);
  saveEvent(currentEventId);
  renderChecklist();
}

function generateChecklist() {
  const ev = events[currentEventId];
  const items = AUTO_CHECKLIST[ev.type] || AUTO_CHECKLIST.autre;
  items.forEach(text => {
    if (!ev.checklist.find(c => c.text === text))
      ev.checklist.push({ id: Date.now() + Math.random(), text, done: false });
  });
  saveEvent(currentEventId);
  renderChecklist();
  showToast('Checklist générée ✨');
}

function renderChecklist() {
  const list = events[currentEventId].checklist || [];
  const done = list.filter(c => c.done).length;
  const pct = list.length > 0 ? Math.round(done / list.length * 100) : 0;

  document.getElementById('checklist-progress').style.width = pct + '%';
  document.getElementById('checklist-pct').textContent = pct + '%';

  document.getElementById('checklist-list').innerHTML = list.map(c => `
    <div class="item-row ${c.done ? 'done' : ''}">
      <button class="check-box ${c.done ? 'done' : ''}" onclick="toggleCheckItem(${c.id})">${c.done ? '✓' : ''}</button>
      <span class="item-row-label">${c.text}</span>
      <button class="btn-delete" onclick="deleteCheckItem(${c.id})">✕</button>
    </div>
  `).join('') || '<p style="color:var(--text-muted);font-size:14px;padding:10px 0">Aucune tâche pour l\'instant</p>';
}

// ---------- UTILS ----------
function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

// Close modal on overlay click
document.getElementById('modal-create').addEventListener('click', function(e) {
  if (e.target === this) closeModal('modal-create');
});
