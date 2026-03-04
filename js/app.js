// ============================================================
// NIGHTR — App Router & Core
// ============================================================
import { onAuthChange, loginWithGoogle, loginAnonymously } from ‘./firebase.js’;
import { listenEvents } from ‘./firebase.js’;
import { renderDashboard } from ‘./dashboard.js’;
import { renderGuests } from ‘./guests.js’;
import { renderInvitations } from ‘./invitations.js’;
import { renderContributions } from ‘./contributions.js’;
import { renderBudget } from ‘./budget.js’;
import { renderChecklist } from ‘./checklist.js’;
import { renderVibes } from ‘./vibes.js’;

// ── App State ─────────────────────────────────────────
export const state = {
user: null,
events: [],
activeEventId: localStorage.getItem(‘nightr_activeEvent’) || null,
currentView: ‘dashboard’,
unsubListeners: [],
};

export function getActiveEvent() {
return state.events.find(e => e.id === state.activeEventId) || null;
}

export function setActiveEvent(id) {
state.activeEventId = id;
localStorage.setItem(‘nightr_activeEvent’, id || ‘’);
updateActiveEventUI();
navigateTo(state.currentView);
}

// ── Init ──────────────────────────────────────────────
export function initApp() {
setupMenuBurger();
setupNavigation();

onAuthChange(user => {
state.user = user;
updateUserUI(user);
if (user) {
startEventListener(user.uid);
} else {
showAuthScreen();
}
});
}

// ── Auth Screen ───────────────────────────────────────
function showAuthScreen() {
const container = document.getElementById(‘viewContainer’);
container.innerHTML = `<div class="view-enter" style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:70vh;gap:24px;text-align:center;"> <div style="font-size:64px;">🌙</div> <div> <h2 class="view-title">Bienvenue sur Nightr</h2> <p class="view-subtitle">Gère tes soirées comme un pro</p> </div> <button id="loginGoogle" class="btn-primary btn-full" style="max-width:280px;"> <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"> <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/> <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/> <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/> <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/> </svg> Continuer avec Google </button> <button id="loginAnon" class="btn-secondary" style="max-width:280px;"> Essayer sans compte </button> <p style="font-size:12px;color:var(--text-tertiary);max-width:260px;line-height:1.5;"> Avec Google, tes soirées sont synchronisées sur tous tes appareils. </p> </div>`;

document.getElementById(‘loginGoogle’).addEventListener(‘click’, async () => {
try {
await loginWithGoogle();
} catch(e) {
showToast(‘Connexion annulée’, ‘error’);
}
});

document.getElementById(‘loginAnon’).addEventListener(‘click’, async () => {
try {
await loginAnonymously();
showToast(‘Mode invité activé’, ‘info’);
} catch(e) {
showToast(‘Erreur de connexion’, ‘error’);
}
});
}

// ── Event Listener ────────────────────────────────────
function startEventListener(uid) {
// Clear old
state.unsubListeners.forEach(fn => fn());
state.unsubListeners = [];

const unsub = listenEvents(uid, events => {
state.events = events;
// Validate active event still exists
if (state.activeEventId && !events.find(e => e.id === state.activeEventId)) {
state.activeEventId = events[0]?.id || null;
localStorage.setItem(‘nightr_activeEvent’, state.activeEventId || ‘’);
} else if (!state.activeEventId && events.length > 0) {
state.activeEventId = events[0].id;
localStorage.setItem(‘nightr_activeEvent’, state.activeEventId);
}
updateActiveEventUI();
navigateTo(state.currentView);
});
state.unsubListeners.push(unsub);
}

// ── Navigation ────────────────────────────────────────
const VIEWS = {
dashboard: renderDashboard,
guests: renderGuests,
invitations: renderInvitations,
contributions: renderContributions,
budget: renderBudget,
checklist: renderChecklist,
vibes: renderVibes,
};

export function navigateTo(view) {
state.currentView = view;
closeMenu();

// Update active menu item
document.querySelectorAll(’.menu-item[data-view]’).forEach(btn => {
btn.classList.toggle(‘active’, btn.dataset.view === view);
});

const container = document.getElementById(‘viewContainer’);
const render = VIEWS[view];
if (render) {
container.innerHTML = ‘’;
render(container, state);
}
}

// ── Menu ──────────────────────────────────────────────
function setupMenuBurger() {
const burgerBtn = document.getElementById(‘burgerBtn’);
const closeBtn  = document.getElementById(‘closeMenuBtn’);
const overlay   = document.getElementById(‘menuOverlay’);

burgerBtn.addEventListener(‘click’, openMenu);
closeBtn.addEventListener(‘click’, closeMenu);
overlay.addEventListener(‘click’, closeMenu);

// Swipe to close
let startX = 0;
const panel = document.getElementById(‘menuPanel’);
panel.addEventListener(‘touchstart’, e => { startX = e.touches[0].clientX; }, { passive: true });
panel.addEventListener(‘touchend’, e => {
if (startX - e.changedTouches[0].clientX > 60) closeMenu();
}, { passive: true });
}

export function openMenu() {
document.getElementById(‘menuPanel’).classList.add(‘open’);
document.getElementById(‘menuOverlay’).classList.add(‘visible’);
document.getElementById(‘burgerBtn’).classList.add(‘open’);
}

export function closeMenu() {
document.getElementById(‘menuPanel’).classList.remove(‘open’);
document.getElementById(‘menuOverlay’).classList.remove(‘visible’);
document.getElementById(‘burgerBtn’).classList.remove(‘open’);
}

// ── Nav links ─────────────────────────────────────────
function setupNavigation() {
document.querySelectorAll(’.menu-item[data-view]’).forEach(btn => {
btn.addEventListener(‘click’, () => navigateTo(btn.dataset.view));
});

document.getElementById(‘addEventBtn’).addEventListener(‘click’, () => {
import(’./dashboard.js’).then(m => m.showNewEventModal(state));
});

document.getElementById(‘menuEventSelector’).addEventListener(‘click’, () => {
import(’./dashboard.js’).then(m => m.showEventSwitcher(state));
closeMenu();
});
}

// ── UI Updates ────────────────────────────────────────
function updateUserUI(user) {
const avatar = document.getElementById(‘userAvatar’);
const nameEl = document.getElementById(‘userName’);
const emailEl = document.getElementById(‘userEmail’);

if (user && !user.isAnonymous) {
const name = user.displayName || ‘Utilisateur’;
avatar.textContent = name.charAt(0).toUpperCase();
nameEl.textContent = name;
emailEl.textContent = user.email || ‘’;
} else if (user?.isAnonymous) {
avatar.textContent = ‘👤’;
nameEl.textContent = ‘Mode invité’;
emailEl.textContent = ‘Données locales uniquement’;
} else {
avatar.textContent = ‘?’;
nameEl.textContent = ‘Non connecté’;
emailEl.textContent = ‘—’;
}
}

function updateActiveEventUI() {
const event = getActiveEvent();
const nameEl = document.getElementById(‘activeEventName’);
if (nameEl) {
nameEl.textContent = event ? event.name : ‘Aucune soirée’;
}
}

// ── Toast Notifications ───────────────────────────────
export function showToast(message, type = ‘info’, duration = 3000) {
const container = document.getElementById(‘toastContainer’);
const icons = { success: ‘✓’, error: ‘✕’, info: ‘•’ };
const toast = document.createElement(‘div’);
toast.className = `toast ${type}`;
toast.innerHTML = `<span class="toast-icon">${icons[type]}</span><span>${message}</span>`;
container.appendChild(toast);
setTimeout(() => {
toast.classList.add(‘fade-out’);
toast.addEventListener(‘animationend’, () => toast.remove());
}, duration);
}

// ── Modal Helper ──────────────────────────────────────
export function showModal(htmlContent, onClose) {
const overlay = document.getElementById(‘modalOverlay’);
const container = document.getElementById(‘modalContainer’);

container.innerHTML = `<div class="modal-sheet"> <div class="modal-handle"></div> ${htmlContent} </div>`;

overlay.classList.add(‘visible’);
container.classList.add(‘visible’);

const close = () => {
overlay.classList.remove(‘visible’);
container.classList.remove(‘visible’);
setTimeout(() => { container.innerHTML = ‘’; if (onClose) onClose(); }, 400);
};

overlay.addEventListener(‘click’, close, { once: true });
return close;
}

// ── Start ─────────────────────────────────────────────
initApp();