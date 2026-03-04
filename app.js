// ===== NIGHTR — app.js =====
import { renderEvents }        from ‘./page-events.js’;
import { renderGuests }        from ‘./page-guests.js’;
import { renderInvitations }   from ‘./page-invitations.js’;
import { renderContributions } from ‘./page-contributions.js’;
import { renderBudget }        from ‘./page-budget.js’;
import { renderStats }         from ‘./page-stats.js’;
import { renderAmbiance }      from ‘./page-ambiance.js’;
import { renderSettings }      from ‘./page-settings.js’;

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

// ===== ROUTER =====
export function navigateTo(page) {
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

// ===== UPDATE HEADER PROFILE =====
export function updateProfile() {
const user = window.__currentUser;
const av = document.getElementById(‘header-avatar’);
const mp = document.getElementById(‘menu-profile’);

if (user) {
av.innerHTML = user.photoURL ? `<img src="${user.photoURL}" />` : user.displayName?.[0] || ‘👤’;
mp.innerHTML = `${user.photoURL ?`<img src="${user.photoURL}" style="width:44px;height:44px;border-radius:50%;object-fit:cover"/>`:`<div class="list-avatar">${user.displayName?.[0] || ‘👤’}</div>`} <div class="menu-profile-info"> <span class="menu-profile-name">${user.displayName || 'Utilisateur'}</span> <span class="menu-profile-email">${user.email || ''}</span> </div>`;
} else {
av.textContent = ‘🎉’;
mp.innerHTML = ` <div class="list-avatar">🎉</div> <div class="menu-profile-info"> <span class="menu-profile-name">Nightr</span> <span class="menu-profile-email">Non connecté · données locales</span> </div>`;
}
}

// ===== INIT =====
document.getElementById(‘burger-btn’).addEventListener(‘click’, () => {
document.getElementById(‘side-menu’).classList.contains(‘open’) ? closeMenu() : openMenu();
});
document.getElementById(‘menu-overlay’).addEventListener(‘click’, closeMenu);
document.querySelectorAll(’.menu-list li[data-page]’).forEach(li => {
li.addEventListener(‘click’, () => navigateTo(li.dataset.page));
});

// Auth change -> refresh profile + re-render current page
window.addEventListener(‘auth-changed’, () => {
updateProfile();
const active = document.querySelector(’.menu-list li.active’)?.dataset.page || ‘events’;
PAGES[active]?.render(document.getElementById(`page-${active}`));
});

// Service Worker
if (‘serviceWorker’ in navigator) {
navigator.serviceWorker.register(‘sw.js’).catch(() => {});
}

// Premier rendu
navigateTo(‘events’);
