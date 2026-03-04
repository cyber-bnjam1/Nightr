// ===== utils.js — partagé par toutes les pages, pas de circular import =====

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
overlay.onclick = (e) => { if (e.target === overlay) { closeModal(); onClose?.(); } };
}
export function closeModal() {
const overlay = document.getElementById(‘modal-overlay’);
overlay.classList.remove(‘active’);
overlay.innerHTML = ‘’;
}

// ===== ID =====
export function genId() {
return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ===== DB HELPERS =====
function demoKey(col) { return `nightr_demo_${col}`; }

export async function dbGet(col) {
if (window.__demoMode) {
return JSON.parse(localStorage.getItem(demoKey(col)) || ‘[]’);
}
const { getDocs, collection } = await import(“https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js”);
const uid = window.__currentUser?.uid;
if (!uid) return [];
const snap = await getDocs(collection(window.__db, `users/${uid}/${col}`));
return snap.docs.map(d => ({ id: d.id, …d.data() }));
}

export async function dbSet(col, id, data) {
if (window.__demoMode) {
const all = JSON.parse(localStorage.getItem(demoKey(col)) || ‘[]’);
const idx = all.findIndex(x => x.id === id);
if (idx >= 0) all[idx] = data; else all.push(data);
localStorage.setItem(demoKey(col), JSON.stringify(all));
return;
}
const { doc, setDoc } = await import(“https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js”);
const uid = window.__currentUser?.uid;
if (!uid) return;
await setDoc(doc(window.__db, `users/${uid}/${col}`, id), { …data, updatedAt: Date.now() });
}

export async function dbDelete(col, id) {
if (window.__demoMode) {
const all = JSON.parse(localStorage.getItem(demoKey(col)) || ‘[]’);
localStorage.setItem(demoKey(col), JSON.stringify(all.filter(x => x.id !== id)));
return;
}
const { doc, deleteDoc } = await import(“https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js”);
const uid = window.__currentUser?.uid;
if (!uid) return;
await deleteDoc(doc(window.__db, `users/${uid}/${col}`, id));
}
