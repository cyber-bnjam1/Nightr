// ===== NIGHTR — app.js (router + auth + menu) =====
import { renderEvents } from ‘./page-events.js’;
import { renderGuests } from ‘./page-guests.js’;
import { renderInvitations } from ‘./page-invitations.js’;
import { renderContributions } from ‘./page-contributions.js’;
import { renderBudget } from ‘./page-budget.js’;
import { renderStats } from ‘./page-stats.js’;
import { renderAmbiance } from ‘./page-ambiance.js’;
import { renderSettings } from ‘./page-settings.js’;

const PAGES = {
events: { render: renderEvents, title: ‘Événements’ },
guests: { render: renderGuests, title: ‘Invités’ },
invitations: { render: renderInvitations, title: ‘Invitations’ },
contributions: { render: renderContributions, title: ‘Contributions’ },
budget: { render: renderBudget, title: ‘Budget’ },
stats: { render: renderStats, title: ‘Statistiques’ },
ambiance: { render: renderAmbiance, title: ‘Ambiance’ },
settings: { render: renderSettings, title: ‘Réglages’ },
};

let currentPage = ‘events’;

// ===== TOAST =====
export function showToast(msg, duration = 2500) {
const t = document.getElementById(‘toast’);
t.textContent = msg;
t.classList.add(‘show’);
setTimeout(() => t.classList.remove(‘show’), duration);
}

// ===== MODAL =====
export function openModal(html, onClose) {
const overlay = document.getElementById(‘modal-overlay’);
overlay.innerHTML = `<div class="modal"><div class="modal-handle"></div>${html}</div>`;
overlay.classList.add(‘active’);
overlay.onclick = (e) => {
if (e.target === overlay) { closeModal(); onClose && onClose(); }
};
}
export function closeModal() {
const overlay = document.getElementById(‘modal-overlay’);
overlay.classList.remove(‘active’);
overlay.innerHTML = ‘’;
}

// ===== ROUTER =====
export function navigateTo(page) {
if (!PAGES[page]) return;
document.querySelectorAll(’.page’).forEach(p => p.classList.remove(‘active’));
document.querySelectorAll(’.menu-list li[data-page]’).forEach(li => li.classList.remove(‘active’));
document.getElementById(`page-${page}`).classList.add(‘active’);
document.querySelector(`.menu-list li[data-page="${page}"]`)?.classList.add(‘active’);
document.getElementById(‘header-title’).textContent = PAGES[page].title;
currentPage = page;
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

// ===== DB HELPERS =====
// En mode démo : localStorage. En mode connecté : Firestore.

function demoKey(collection) {
return `nightr_demo_${collection}`;
}

export async function dbGet(collection) {
if (window.__demoMode) {
return JSON.parse(localStorage.getItem(demoKey(collection)) || ‘[]’);
}
const { getDocs, collection: col } = await import(“https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js”);
const uid = window.__currentUser?.uid;
if (!uid) return [];
const snap = await getDocs(col(window.__db, `users/${uid}/${collection}`));
return snap.docs.map(d => ({ id: d.id, …d.data() }));
}

export async function dbSet(collection, id, data) {
if (window.__demoMode) {
const all = JSON.parse(localStorage.getItem(demoKey(collection)) || ‘[]’);
const idx = all.findIndex(x => x.id === id);
if (idx >= 0) all[idx] = data; else all.push(data);
localStorage.setItem(demoKey(collection), JSON.stringify(all));
return;
}
const { doc, setDoc } = await import(“https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js”);
const uid = window.__currentUser?.uid;
if (!uid) return;
await setDoc(doc(window.__db, `users/${uid}/${collection}`, id), { …data, updatedAt: Date.now() });
}

export async function dbDelete(collection, id) {
if (window.__demoMode) {
const all = JSON.parse(localStorage.getItem(demoKey(collection)) || ‘[]’);
localStorage.setItem(demoKey(collection), JSON.stringify(all.filter(x => x.id !== id)));
return;
}
const { doc, deleteDoc } = await import(“https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js”);
const uid = window.__currentUser?.uid;
if (!uid) return;
await deleteDoc(doc(window.__db, `users/${uid}/${collection}`, id));
}

export function genId() {
return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ===== AUTH INIT =====
function initApp(user) {
// Avatar header
const av = document.getElementById(‘header-avatar’);
if (user.photoURL) av.innerHTML = `<img src="${user.photoURL}" />`;
else av.textContent = (user.displayName || user.email || ‘U’)[0].toUpperCase();

// Menu profile
document.getElementById(‘menu-profile’).innerHTML = `${user.photoURL ?`<img src="${user.photoURL}" />`:`<div class="list-avatar">${(user.displayName||‘U’)[0]}</div>`} <div class="menu-profile-info"> <span class="menu-profile-name">${user.displayName || 'Utilisateur'}</span> <span class="menu-profile-email">${user.email || ''}</span> </div> `;

// Menu navigation
document.querySelectorAll(’.menu-list li[data-page]’).forEach(li => {
li.addEventListener(‘click’, () => navigateTo(li.dataset.page));
});

// Logout
document.getElementById(‘menu-logout’).addEventListener(‘click’, async () => {
await window.__signOut(window.__auth);
});

// Burger
document.getElementById(‘burger-btn’).addEventListener(‘click’, () => {
if (document.getElementById(‘side-menu’).classList.contains(‘open’)) closeMenu();
else openMenu();
});
document.getElementById(‘menu-overlay’).addEventListener(‘click’, closeMenu);

// Show app
document.getElementById(‘auth-screen’).classList.remove(‘active’);
document.getElementById(‘app-screen’).classList.add(‘active’);

navigateTo(‘events’);
}

// ===== BOOTSTRAP =====
window.addEventListener(‘firebase-ready’, () => {
window.addEventListener(‘auth-changed’, (e) => {
const user = e.detail;
if (user) {
initApp(user);
} else {
document.getElementById(‘app-screen’).classList.remove(‘active’);
document.getElementById(‘auth-screen’).classList.add(‘active’);
}
});

// Connexion Google via redirect (fonctionne sur Koder + Vercel)
document.getElementById(‘btn-google-login’).addEventListener(‘click’, async () => {
try {
await window.__signInWithRedirect(window.__auth, window.__provider);
} catch (err) {
showToast(’Erreur : ’ + err.message);
}
});

// Mode démo — faux utilisateur local, données en localStorage
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
});

// ===== SERVICE WORKER =====
if (‘serviceWorker’ in navigator) {
navigator.serviceWorker.register(‘sw.js’).catch(() => {});
}
