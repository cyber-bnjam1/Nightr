// ===== page-settings.js =====
import { dbGet, dbSet, dbDelete, showToast } from ‘./utils.js’;

let container;

export async function renderSettings(el) {
container = el;
draw();
}

function draw() {
const user = window.__currentUser;
const isConnected = !!user;

container.innerHTML = `
<h2 class="section-title">⚙️ Réglages</h2>

```
<!-- COMPTE -->
<div class="settings-section-label">Compte</div>
<div class="glass-card" style="margin-bottom:16px">
  ${isConnected ? `
    <div class="flex-row" style="gap:14px;margin-bottom:16px">
      ${user.photoURL
        ? `<img src="${user.photoURL}" style="width:56px;height:56px;border-radius:50%;object-fit:cover"/>`
        : `<div class="list-avatar" style="width:56px;height:56px;font-size:22px">${user.displayName?.[0]||'👤'}</div>`}
      <div>
        <div style="font-size:17px;font-weight:700">${user.displayName || 'Utilisateur'}</div>
        <div style="font-size:13px;color:var(--text-muted)">${user.email}</div>
        <div style="font-size:12px;color:#4ade80;margin-top:3px">✓ Synchronisé avec Firebase</div>
      </div>
    </div>
    <button class="btn btn-danger btn-full" id="btn-logout">🚪 Se déconnecter</button>
  ` : `
    <div style="text-align:center;padding:8px 0 16px">
      <div style="font-size:40px;margin-bottom:8px">🔐</div>
      <div style="font-weight:700;font-size:17px;margin-bottom:6px">Connecte-toi pour synchroniser</div>
      <div style="font-size:13px;color:var(--text-muted);margin-bottom:20px">
        Tes soirées sauvegardées sur tous tes appareils
      </div>
      <button class="btn btn-primary btn-full" id="btn-google" style="margin-bottom:10px">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style="flex-shrink:0">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        Continuer avec Google
      </button>
    </div>
  `}
</div>

<!-- STOCKAGE -->
<div class="settings-section-label">Données</div>
<div class="glass-card" style="margin-bottom:16px">
  <div class="flex-between" style="padding:8px 0;border-bottom:1px solid var(--glass-border)">
    <div>
      <div style="font-weight:600">Sauvegarde</div>
      <div style="font-size:13px;color:${isConnected ? '#4ade80' : '#fbbf24'}">
        ${isConnected ? '☁️ Firebase (cloud)' : '📱 Locale (cet iPhone)'}
      </div>
    </div>
    <span class="badge ${isConnected ? 'badge-yes' : 'badge-wait'}">
      ${isConnected ? 'Cloud' : 'Local'}
    </span>
  </div>
  <div style="padding:8px 0;border-bottom:1px solid var(--glass-border)">
    <button class="btn btn-secondary btn-full" id="btn-export">📦 Exporter mes données (JSON)</button>
  </div>
  <div style="padding:8px 0">
    <button class="btn btn-danger btn-full" id="btn-delete">⚠️ Supprimer toutes mes données</button>
  </div>
</div>

<!-- NOTIFICATIONS -->
<div class="settings-section-label">Notifications</div>
<div class="glass-card" style="margin-bottom:16px">
  <div class="flex-between" style="padding:8px 0">
    <div>
      <div style="font-weight:600">Notifications push</div>
      <div style="font-size:13px;color:var(--text-muted)">RSVP, rappels soirée</div>
    </div>
    <button class="btn btn-sm btn-secondary" id="btn-notif">🔔 Activer</button>
  </div>
</div>

<!-- A PROPOS -->
<div class="settings-section-label">À propos</div>
<div class="glass-card" style="margin-bottom:40px">
  <div class="flex-between" style="padding:6px 0;border-bottom:1px solid var(--glass-border)">
    <span style="color:var(--text-muted)">Version</span><span style="font-weight:600">1.0.0</span>
  </div>
  <div class="flex-between" style="padding:6px 0">
    <span style="color:var(--text-muted)">App</span>
    <span style="font-weight:700;background:linear-gradient(135deg,#fff,#a855f7);-webkit-background-clip:text;-webkit-text-fill-color:transparent">nightr</span>
  </div>
</div>
```

`;

// Connexion Google
document.getElementById(‘btn-google’)?.addEventListener(‘click’, async () => {
if (!window.__signInWithRedirect) {
showToast(‘Firebase non disponible’);
return;
}
try {
showToast(‘Redirection vers Google…’);
await window.__signInWithRedirect(window.__auth, window.__provider);
} catch (err) {
showToast(’Erreur : ’ + err.message);
}
});

// Déconnexion
document.getElementById(‘btn-logout’)?.addEventListener(‘click’, async () => {
if (!window.__signOut) return;
await window.__signOut(window.__auth);
showToast(‘Déconnecté’);
draw();
});

// Export
document.getElementById(‘btn-export’).addEventListener(‘click’, exportData);

// Supprimer
document.getElementById(‘btn-delete’).addEventListener(‘click’, () => {
if (confirm(‘Supprimer TOUTES tes données ? Irréversible.’)) deleteData();
});

// Notifications
document.getElementById(‘btn-notif’).addEventListener(‘click’, async () => {
if (!(‘Notification’ in window)) { showToast(‘Non supporté’); return; }
const p = await Notification.requestPermission();
showToast(p === ‘granted’ ? ‘Notifications activées ✓’ : ‘Refusé’);
});
}

async function exportData() {
const cols = [‘events’, ‘guests’, ‘expenses’, ‘contributions’, ‘ambiance’];
const result = {};
for (const c of cols) result[c] = await dbGet(c);
result.exportedAt = new Date().toISOString();
result.user = window.__currentUser?.email || ‘local’;
const blob = new Blob([JSON.stringify(result, null, 2)], { type: ‘application/json’ });
const a = document.createElement(‘a’);
a.href = URL.createObjectURL(blob);
a.download = `nightr-backup-${Date.now()}.json`;
a.click();
showToast(‘Export téléchargé ✓’);
}

async function deleteData() {
const cols = [‘events’, ‘guests’, ‘expenses’, ‘contributions’, ‘ambiance’];
for (const c of cols) {
const items = await dbGet(c);
for (const item of items) await dbDelete(c, item.id);
}
showToast(‘Données supprimées’);
draw();
}
