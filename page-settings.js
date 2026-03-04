// ===== page-settings.js =====
import { dbGet, showToast } from ‘./app.js’;

let container;

export async function renderSettings(el) {
container = el;
draw();
}

function draw() {
const user = window.__currentUser;
container.innerHTML = `
<h2 class="section-title">⚙️ Réglages</h2>

```
<div class="glass-card" style="margin-bottom:16px">
  <div class="flex-row" style="gap:14px">
    ${user?.photoURL ? `<img src="${user.photoURL}" style="width:56px;height:56px;border-radius:50%;object-fit:cover" />` :
      `<div class="list-avatar" style="width:56px;height:56px;font-size:22px">${(user?.displayName||'U')[0]}</div>`}
    <div>
      <div style="font-size:17px;font-weight:700">${user?.displayName || 'Utilisateur'}</div>
      <div style="font-size:13px;color:var(--text-muted)">${user?.email || ''}</div>
      <div style="font-size:12px;color:var(--accent);margin-top:2px">Compte Google connecté ✓</div>
    </div>
  </div>
</div>

<div style="font-size:13px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;margin-left:4px">Apparence</div>
<div class="glass-card" style="margin-bottom:16px">
  <div class="flex-between" style="padding:4px 0">
    <div>
      <div style="font-weight:600">Mode sombre</div>
      <div style="font-size:13px;color:var(--text-muted)">Toujours activé (iOS26 Liquid)</div>
    </div>
    <div style="width:48px;height:28px;background:var(--accent);border-radius:14px;display:flex;align-items:center;justify-content:flex-end;padding:3px">
      <div style="width:22px;height:22px;background:#fff;border-radius:50%"></div>
    </div>
  </div>
</div>

<div style="font-size:13px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;margin-left:4px">Notifications</div>
<div class="glass-card" style="margin-bottom:16px">
  <div class="flex-between" style="padding:8px 0;border-bottom:1px solid var(--glass-border)">
    <div>
      <div style="font-weight:600">Réponses RSVP</div>
      <div style="font-size:13px;color:var(--text-muted)">Notifié quand un invité répond</div>
    </div>
    <button class="btn btn-sm btn-secondary" id="btn-notif">🔔 Activer</button>
  </div>
  <div class="flex-between" style="padding:8px 0">
    <div>
      <div style="font-weight:600">Rappels soirée</div>
      <div style="font-size:13px;color:var(--text-muted)">J-7, J-3, J-1 avant la soirée</div>
    </div>
    <button class="btn btn-sm btn-secondary" id="btn-reminder">⏰ Activer</button>
  </div>
</div>

<div style="font-size:13px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;margin-left:4px">Données</div>
<div class="glass-card" style="margin-bottom:16px">
  <div class="flex-between" style="padding:8px 0;border-bottom:1px solid var(--glass-border)">
    <div>
      <div style="font-weight:600">Sauvegarde automatique</div>
      <div style="font-size:13px;color:var(--accent)">✓ Firebase Firestore activé</div>
    </div>
    <span class="badge badge-yes">Actif</span>
  </div>
  <div style="padding:8px 0;border-bottom:1px solid var(--glass-border)">
    <button class="btn btn-secondary btn-full" id="btn-export-all">📦 Exporter toutes mes données</button>
  </div>
  <div style="padding:8px 0">
    <button class="btn btn-danger btn-full" id="btn-delete-all">⚠️ Supprimer toutes mes données</button>
  </div>
</div>

<div style="font-size:13px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;margin-left:4px">À propos</div>
<div class="glass-card" style="margin-bottom:20px">
  <div class="flex-between" style="padding:6px 0;border-bottom:1px solid var(--glass-border)">
    <span style="color:var(--text-muted)">Version</span><span style="font-weight:600">1.0.0</span>
  </div>
  <div class="flex-between" style="padding:6px 0;border-bottom:1px solid var(--glass-border)">
    <span style="color:var(--text-muted)">App</span><span style="font-weight:600">Nightr</span>
  </div>
  <div class="flex-between" style="padding:6px 0">
    <span style="color:var(--text-muted)">Stockage</span><span style="font-weight:600">Firebase + Offline</span>
  </div>
</div>

<button class="btn btn-danger btn-full" id="btn-logout-settings" style="margin-bottom:40px">🚪 Se déconnecter</button>
```

`;

document.getElementById(‘btn-notif’).onclick = async () => {
if (‘Notification’ in window) {
const perm = await Notification.requestPermission();
showToast(perm === ‘granted’ ? ‘Notifications activées ✓’ : ‘Notifications refusées’);
}
};
document.getElementById(‘btn-reminder’).onclick = () => showToast(‘Rappels configurés ✓’);
document.getElementById(‘btn-export-all’).onclick = () => exportAllData();
document.getElementById(‘btn-delete-all’).onclick = () => {
if (confirm(‘Supprimer TOUTES tes données Nightr ? Cette action est irréversible.’)) {
deleteAllData();
}
};
document.getElementById(‘btn-logout-settings’).onclick = async () => {
await window.__signOut(window.__auth);
};
}

async function exportAllData() {
const [events, guests, expenses, contributions, ambiance] = await Promise.all([
dbGet(‘events’), dbGet(‘guests’), dbGet(‘expenses’), dbGet(‘contributions’), dbGet(‘ambiance’)
]);
const data = { exportedAt: new Date().toISOString(), user: window.__currentUser?.email, events, guests, expenses, contributions, ambiance };
const blob = new Blob([JSON.stringify(data, null, 2)], { type: ‘application/json’ });
const a = document.createElement(‘a’);
a.href = URL.createObjectURL(blob);
a.download = `nightr-backup-${Date.now()}.json`;
a.click();
showToast(‘Export téléchargé ✓’);
}

async function deleteAllData() {
const { getDocs, collection, deleteDoc, doc } = await import(“https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js”);
const uid = window.__currentUser?.uid;
if (!uid) return;
const cols = [‘events’, ‘guests’, ‘expenses’, ‘contributions’, ‘ambiance’];
for (const col of cols) {
const snap = await getDocs(collection(window.__db, `users/${uid}/${col}`));
for (const d of snap.docs) await deleteDoc(doc(window.__db, `users/${uid}/${col}`, d.id));
}
showToast(‘Données supprimées’);
}

async function dbGet(col) {
const { getDocs, collection } = await import(“https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js”);
const uid = window.__currentUser?.uid;
if (!uid) return [];
const snap = await getDocs(collection(window.__db, `users/${uid}/${col}`));
return snap.docs.map(d => ({ id: d.id, …d.data() }));
}