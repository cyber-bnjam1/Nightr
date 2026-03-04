// ============================================================
// NIGHTR — Firebase Helpers
// ============================================================
import {
collection, doc, getDocs, getDoc,
addDoc, setDoc, updateDoc, deleteDoc,
onSnapshot, query, orderBy, serverTimestamp,
where
} from “https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js”;

import {
signInWithPopup, GoogleAuthProvider,
signInAnonymously, onAuthStateChanged, signOut
} from “https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js”;

const db = () => window.__db;
const auth = () => window.__auth;

// ── Auth ──────────────────────────────────────────────
export function getCurrentUser() {
return auth().currentUser;
}

export function onAuthChange(callback) {
return onAuthStateChanged(auth(), callback);
}

export async function loginWithGoogle() {
const provider = new GoogleAuthProvider();
return signInWithPopup(auth(), provider);
}

export async function loginAnonymously() {
return signInAnonymously(auth());
}

export async function logout() {
return signOut(auth());
}

// ── User path helper ──────────────────────────────────
function userPath(uid) {
return `users/${uid}`;
}
function eventsPath(uid) {
return `users/${uid}/events`;
}
function eventPath(uid, eventId) {
return `users/${uid}/events/${eventId}`;
}

// ── Events CRUD ───────────────────────────────────────
export async function createEvent(uid, data) {
const ref = collection(db(), eventsPath(uid));
return addDoc(ref, {
…data,
createdAt: serverTimestamp(),
updatedAt: serverTimestamp(),
});
}

export async function updateEvent(uid, eventId, data) {
const ref = doc(db(), eventPath(uid, eventId));
return updateDoc(ref, { …data, updatedAt: serverTimestamp() });
}

export async function deleteEvent(uid, eventId) {
const ref = doc(db(), eventPath(uid, eventId));
return deleteDoc(ref);
}

export async function getEvents(uid) {
const ref = collection(db(), eventsPath(uid));
const q = query(ref, orderBy(“date”, “desc”));
const snap = await getDocs(q);
return snap.docs.map(d => ({ id: d.id, …d.data() }));
}

export async function getEvent(uid, eventId) {
const ref = doc(db(), eventPath(uid, eventId));
const snap = await getDoc(ref);
return snap.exists() ? { id: snap.id, …snap.data() } : null;
}

export function listenEvent(uid, eventId, callback) {
const ref = doc(db(), eventPath(uid, eventId));
return onSnapshot(ref, snap => {
if (snap.exists()) callback({ id: snap.id, …snap.data() });
else callback(null);
});
}

export function listenEvents(uid, callback) {
const ref = collection(db(), eventsPath(uid));
const q = query(ref, orderBy(“date”, “desc”));
return onSnapshot(q, snap => {
callback(snap.docs.map(d => ({ id: d.id, …d.data() })));
});
}

// ── Sub-collections helper ────────────────────────────
function subPath(uid, eventId, sub) {
return `users/${uid}/events/${eventId}/${sub}`;
}

export async function addSubItem(uid, eventId, sub, data) {
const ref = collection(db(), subPath(uid, eventId, sub));
return addDoc(ref, { …data, createdAt: serverTimestamp() });
}

export async function updateSubItem(uid, eventId, sub, itemId, data) {
const ref = doc(db(), `${subPath(uid, eventId, sub)}/${itemId}`);
return updateDoc(ref, { …data, updatedAt: serverTimestamp() });
}

export async function deleteSubItem(uid, eventId, sub, itemId) {
const ref = doc(db(), `${subPath(uid, eventId, sub)}/${itemId}`);
return deleteDoc(ref);
}

export function listenSubCollection(uid, eventId, sub, callback) {
const ref = collection(db(), subPath(uid, eventId, sub));
const q = query(ref, orderBy(“createdAt”, “asc”));
return onSnapshot(q, snap => {
callback(snap.docs.map(d => ({ id: d.id, …d.data() })));
});
}