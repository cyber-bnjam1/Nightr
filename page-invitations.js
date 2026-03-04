// ===== page-invitations.js =====
import { dbGet, showToast, openModal, closeModal } from ‘./app.js’;

let events = [];
let guests = [];
let container;

export async function renderInvitations(el) {
container = el;
[events, guests] = await Promise.all([dbGet(‘events’), dbGet(‘guests’)]);
draw();
}

function draw() {
container.innerHTML = `<h2 class="section-title">💌 Invitations</h2> <p class="section-sub">Génère et partage les invitations de tes soirées</p> ${events.length === 0  ?`<div class="empty-state"><div class="empty-icon">💌</div><div class="empty-title">Aucune soirée</div><div class="empty-sub">Crée d’abord une soirée</div></div>`: events.map(invitationCard).join('')} <div style="height:20px"></div>`;
events.forEach(ev => {
container.querySelector(`[data-evid="${ev.id}"]`)?.addEventListener(‘click’, () => openInvitation(ev));
});
}

function invitationCard(ev) {
const evGuests = guests.filter(g => g.rsvp === ‘yes’);
return ` <div class="glass-card" data-evid="${ev.id}" style="margin-bottom:12px;cursor:pointer"> <div class="flex-between"> <div> <div style="font-size:17px;font-weight:700">${ev.name}</div> <div style="font-size:13px;color:var(--text-muted)">${ev.date ? formatDate(ev.date) : 'Date à définir'} ${ev.location ? '· '+ev.location : ''}</div> </div> <div style="font-size:28px">💌</div> </div> <div class="sep"></div> <div style="display:flex;gap:12px"> <button class="btn btn-sm btn-primary" data-action="qr" data-evid="${ev.id}">📱 QR Code</button> <button class="btn btn-sm btn-secondary" data-action="preview" data-evid="${ev.id}">👁️ Aperçu</button> <button class="btn btn-sm btn-secondary" data-action="share" data-evid="${ev.id}">📤 Partager</button> </div> </div>`;
}

function openInvitation(ev) {
openModal(`<div class="modal-title">💌 ${ev.name}</div> <div style="display:flex;flex-direction:column;gap:10px"> <button class="btn btn-primary btn-full" id="btn-qr">📱 Générer le QR Code</button> <button class="btn btn-secondary btn-full" id="btn-preview">👁️ Aperçu invitation</button> <button class="btn btn-secondary btn-full" id="btn-share-wa">💬 Partager WhatsApp</button> <button class="btn btn-secondary btn-full" id="btn-share-sms">📱 Partager SMS</button> <button class="btn btn-secondary btn-full" id="btn-share-link">🔗 Copier le lien</button> </div>`);
document.getElementById(‘btn-qr’).onclick = () => { closeModal(); showQR(ev); };
document.getElementById(‘btn-preview’).onclick = () => { closeModal(); showPreview(ev); };
document.getElementById(‘btn-share-wa’).onclick = () => shareWhatsApp(ev);
document.getElementById(‘btn-share-sms’).onclick = () => shareSMS(ev);
document.getElementById(‘btn-share-link’).onclick = () => copyLink(ev);
}

function showQR(ev) {
const url = generateRSVPLink(ev);
openModal(`<div class="modal-title">📱 QR Code</div> <div class="qr-container"> <div class="qr-wrapper" id="qr-box"></div> <div style="text-align:center"> <div style="font-size:17px;font-weight:700">${ev.name}</div> <div style="font-size:13px;color:var(--text-muted)">${ev.date ? formatDate(ev.date) : ''}</div> </div> <button class="btn btn-primary" id="btn-dl-qr">⬇️ Télécharger</button> </div>`);
loadQRCode(url);
document.getElementById(‘btn-dl-qr’).onclick = () => downloadQR(ev.name);
}

function loadQRCode(url) {
const script = document.createElement(‘script’);
script.src = ‘https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js’;
script.onload = () => {
const box = document.getElementById(‘qr-box’);
if (!box) return;
new QRCode(box, {
text: url,
width: 200, height: 200,
colorDark: ‘#7c3aed’, colorLight: ‘#ffffff’,
correctLevel: QRCode.CorrectLevel.H,
});
};
document.head.appendChild(script);
}

function downloadQR(name) {
const canvas = document.querySelector(’#qr-box canvas’);
if (!canvas) { showToast(‘QR non disponible’); return; }
const a = document.createElement(‘a’);
a.download = `invitation-${name}.png`;
a.href = canvas.toDataURL();
a.click();
showToast(‘QR Code téléchargé ✓’);
}

function showPreview(ev) {
const invText = buildInvitationText(ev);
openModal(`<div class="modal-title">👁️ Aperçu</div> <div style="background:linear-gradient(135deg,rgba(168,85,247,0.15),rgba(236,72,153,0.1)); border:1px solid rgba(168,85,247,0.3);border-radius:20px;padding:24px;margin-bottom:16px; font-family:inherit;line-height:1.7;white-space:pre-line;font-size:15px"> ${invText.replace(/\n/g,'<br>')} </div> <button class="btn btn-primary btn-full" id="btn-copy-inv">📋 Copier le texte</button>`);
document.getElementById(‘btn-copy-inv’).onclick = () => {
navigator.clipboard.writeText(invText).then(() => showToast(‘Texte copié ✓’));
};
}

function buildInvitationText(ev) {
let txt = `🎉 Tu es invité(e) à ${ev.name} !\n\n`;
if (ev.date) txt += `📅 ${formatDate(ev.date)}${ev.time ? ' à ' + ev.time : ''}\n`;
if (ev.location) txt += `📍 ${ev.location}\n`;
if (ev.theme) txt += `🎨 Thème : ${ev.theme}\n`;
if (ev.description) txt += `\n${ev.description}\n`;
txt += `\n✅ Confirme ta présence :\n${generateRSVPLink(ev)}`;
return txt;
}

function generateRSVPLink(ev) {
const uid = window.__currentUser?.uid || ‘demo’;
return `https://nightr.app/rsvp/${uid}/${ev.id}`;
}

function shareWhatsApp(ev) {
const text = encodeURIComponent(buildInvitationText(ev));
window.open(`https://wa.me/?text=${text}`, ‘_blank’);
}

function shareSMS(ev) {
const text = encodeURIComponent(buildInvitationText(ev));
window.open(`sms:?body=${text}`, ‘_blank’);
}

function copyLink(ev) {
navigator.clipboard.writeText(generateRSVPLink(ev)).then(() => showToast(‘Lien copié ✓’));
closeModal();
}

function formatDate(dateStr) {
if (!dateStr) return ‘’;
const d = new Date(dateStr + ‘T00:00:00’);
return d.toLocaleDateString(‘fr-FR’, { weekday: ‘long’, day: ‘numeric’, month: ‘long’, year: ‘numeric’ });
}

// Handle button clicks inside cards
document.addEventListener(‘click’, (e) => {
const btn = e.target.closest(’[data-action]’);
if (!btn) return;
const ev = events.find(x => x.id === btn.dataset.evid);
if (!ev) return;
e.stopPropagation();
if (btn.dataset.action === ‘qr’) showQR(ev);
if (btn.dataset.action === ‘preview’) showPreview(ev);
if (btn.dataset.action === ‘share’) {
if (navigator.share) {
navigator.share({ title: ev.name, text: buildInvitationText(ev), url: generateRSVPLink(ev) });
} else shareWhatsApp(ev);
}
});