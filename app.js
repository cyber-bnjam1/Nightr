// ===== NIGHTR — app.js (pas d’imports circulaires) =====
import { renderEvents }        from ‘./page-events.js’;
import { renderGuests }        from ‘./page-guests.js’;
import { renderInvitations }   from ‘./page-invitations.js’;
import { renderContributions } from ‘./page-contributions.js’;
import { renderBudget }        from ‘./page-budget.js’;
import { renderStats }         from ‘./page-stats.js’;
import { renderAmbiance }      from ‘./page-ambiance.js’;
import { renderSettings }      from ‘./page-settings.js’;
// utils.js est importé par les pages, pas par app.js -> plus de circularité

const PAGES = {
events:        { render: renderEvents,        title: ‘Événements’ },
guests:        { render: renderGuests,         title: ‘Invités’ },
invitations:   { render: renderInvitations,    title: ‘Invitations’ },
contributions: { render: renderContributions,  title: ‘Contributions’ },
budget:        { render: renderBudget,         title: ‘Budget’ },
stats:         { render: renderStats,          title: ‘Statistiques’ },
ambiance:      { render: renderAmbiance,       title: ‘Ambiance’ },
settings:      { render: renderSettings,       title: ‘Réglages’ },
};

// ===== TOAST (local, pour app.js uniquement) =====
function showToast(msg, duration = 2500) {
const t = document.getElementById(‘toast’);
if (!t) return;
t.textContent = msg;
t.classList.add(‘show’);
setTimeout(() => t.classList.remove(‘show’), duration);
}

// ===== MODAL =====
function closeModal() {
const overlay = document.getElementById(‘modal-overlay’);
overlay.classList.remove(‘active’);
overlay.innerHTML = ‘’;
}

// ===== ROUTER =====
function navigateTo(page) {
if (!PAGES[page]) return;
document.querySelectorAll(’.page’).forEach(p => p.classList.remove(‘active’));
document.querySelectorAll(’.menu-list li[data-page]’).forEach(li => li.classList.remove(‘active’));
document.getElementById(`page-${page}`).classList.add(‘active’);
document.querySelector(`.menu-list li[data-page="${page}"]`)?.classList.add(‘active’);
document.getElementById(‘header-title’).textContent = PAGES[page].title;
PAGES[page].render(document.getElementById(`page-${page}`));
closeMenu();
}

// ===== MENU =====
function openMenu() {
document.getElementById(‘side-menu’).classList.add(‘open’);
document.getElementById(‘menu-overlay’).classList.add(‘active’);
document.getElementById(‘burger-btn’).classList.add(‘open’);
}
function closeMenu() {
document.getElementById(‘side-menu’).classList.remove(‘open’);
document.getElementById(‘menu-overlay’).classList.remove(‘active’);
document.getElementById(‘burger-btn’).classList.remove(‘open’);
}

// ===== AUTH INIT =====
function initApp(user) {
const av = document.getElementById(‘header-avatar’);
if (user.photoURL) av.innerHTML = `<img src="${user.photoURL}" />`;
else av.textContent = (user.displayName || user.email || ‘U’)[0].toUpperCase();

document.getElementById(‘menu-profile’).innerHTML = `${user.photoURL ?`<img src="${user.photoURL}" style="width:44px;height:44px;border-radius:50%;object-fit:cover" />`:`<div class="list-avatar">${(user.displayName || ‘U’)[0]}</div>`} <div class="menu-profile-info"> <span class="menu-profile-name">${user.displayName || 'Utilisateur'}</span> <span class="menu-profile-email">${user.isDemo ? '⚡ Mode démo' : (user.email || '')}</span> </div> `;

document.querySelectorAll(’.menu-list li[data-page]’).forEach(li => {
li.addEventListener(‘click’, () => navigateTo(li.dataset.page));
});

document.getElementById(‘menu-logout’).addEventListener(‘click’, async () => {
if (window.__demoMode) {
window.__demoMode = false;
window.__currentUser = null;
document.getElementById(‘app-screen’).classList.remove(‘active’);
document.getElementById(‘auth-screen’).classList.add(‘active’);
return;
}
await window.__signOut(window.__auth);
});

document.getElementById(‘burger-btn’).addEventListener(‘click’, () => {
if (document.getElementById(‘side-menu’).classList.contains(‘open’)) closeMenu();
else openMenu();
});
document.getElementById(‘menu-overlay’).addEventListener(‘click’, closeMenu);

document.getElementById(‘auth-screen’).classList.remove(‘active’);
document.getElementById(‘app-screen’).classList.add(‘active’);
navigateTo(‘events’);
}

// ===== BOOTSTRAP =====

// Bouton démo : pas besoin de Firebase
document.getElementById(‘btn-demo-login’).addEventListener(‘click’, () => {
window.__currentUser = {
uid: ‘demo-user’,
displayName: ‘Mode Démo’,
email: ‘demo@nightr.app’,
photoURL: null,
isDemo: true,
};
window.__demoMode = true;
initApp(window.__currentUser);
});

// Bouton Google
document.getElementById(‘btn-google-login’).addEventListener(‘click’, async () => {
if (!window.__signInWithRedirect) {
showToast(‘Chargement Firebase en cours…’);
return;
}
try {
await window.__signInWithRedirect(window.__auth, window.__provider);
} catch (err) {
showToast(’Erreur connexion : ’ + err.message);
}
});

// Auth state Firebase
window.addEventListener(‘auth-changed’, (e) => {
if (window.__demoMode) return;
const user = e.detail;
if (user) {
initApp(user);
} else {
document.getElementById(‘app-screen’).classList.remove(‘active’);
document.getElementById(‘auth-screen’).classList.add(‘active’);
}
});

// Service Worker
if (‘serviceWorker’ in navigator) {
navigator.serviceWorker.register(‘sw.js’).catch(() => {});
}
