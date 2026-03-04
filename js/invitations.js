// ============================================================
// NIGHTR — Invitations & QR Code
// ============================================================
import { showModal, showToast, getActiveEvent } from ‘./app.js’;

// QR Code via qrcode.js CDN (loaded dynamically)
async function loadQRLib() {
if (window.QRCode) return;
return new Promise((res, rej) => {
const s = document.createElement(‘script’);
s.src = ‘https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js’;
s.onload = res; s.onerror = rej;
document.head.appendChild(s);
});
}

// html2canvas for PNG export
async function loadHtml2Canvas() {
if (window.html2canvas) return;
return new Promise((res, rej) => {
const s = document.createElement(‘script’);
s.src = ‘https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js’;
s.onload = res; s.onerror = rej;
document.head.appendChild(s);
});
}

export function renderInvitations(container, state) {
const event = getActiveEvent();
if (!event) { container.innerHTML = noEventHtml(); return; }

const rsvpUrl = `${location.origin}/rsvp.html?event=${event.id}`;

container.innerHTML = `
<div class="view-enter stagger">
<h2 class="view-title">Invitations & QR</h2>
<p class="view-subtitle">${event.name}</p>

```
  <!-- Invitation Card Preview -->
  <p class="section-title">Aperçu de l'invitation</p>
  <div id="invitationCard" class="invitation-card glass-card-strong" style="
    padding:28px 24px;margin-bottom:20px;position:relative;overflow:hidden;
    border-radius:var(--radius-xl);min-height:280px;">
    <div style="position:absolute;inset:0;background:linear-gradient(135deg,rgba(124,58,237,0.3),rgba(236,72,153,0.2),rgba(6,182,212,0.15));z-index:0;"></div>
    <div style="position:relative;z-index:1;">
      <div style="font-size:42px;margin-bottom:12px;">${event.emoji || '🎉'}</div>
      <p style="font-size:11px;text-transform:uppercase;letter-spacing:2px;color:rgba(255,255,255,0.5);margin-bottom:4px;">Tu es invité(e) à</p>
      <h3 style="font-family:var(--font-display);font-size:26px;font-weight:800;margin-bottom:12px;line-height:1.1;">${escHtml(event.name)}</h3>
      <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:16px;">
        ${event.date ? `<div style="font-size:14px;opacity:0.85;">📅 ${formatDate(new Date(event.date))}</div>` : ''}
        ${event.location ? `<div style="font-size:14px;opacity:0.85;">📍 ${escHtml(event.location)}</div>` : ''}
        ${event.dressCode ? `<div style="font-size:14px;opacity:0.85;">👗 ${escHtml(event.dressCode)}</div>` : ''}
      </div>
      <div id="qrCodePreview" style="background:white;border-radius:12px;padding:10px;display:inline-block;"></div>
    </div>
  </div>

  <!-- Theme selector -->
  <p class="section-title">Thème visuel</p>
  <div style="display:flex;gap:10px;margin-bottom:20px;overflow-x:auto;padding-bottom:4px;">
    ${themes.map((t, i) => `
      <button class="theme-btn" data-theme="${i}" style="
        width:60px;height:60px;border-radius:var(--radius-md);
        background:${t.bg};border:2px solid ${i===0?'rgba(255,255,255,0.5)':'transparent'};
        flex-shrink:0;cursor:pointer;transition:all 0.2s;">
      </button>
    `).join('')}
  </div>

  <!-- Message perso -->
  <div class="input-group">
    <label class="input-label">Message personnalisé</label>
    <textarea class="input-field" id="inviteMsg" rows="3" placeholder="Viens fêter ça avec nous ! 🥂 Ambiance au top garantie…" style="resize:none;">${event.customMessage || ''}</textarea>
  </div>

  <!-- Actions -->
  <div style="display:flex;flex-direction:column;gap:10px;">
    <button class="btn-primary" id="downloadPng">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      Télécharger en image PNG
    </button>
    <button class="btn-secondary" id="shareLinkBtn">
      🔗 Copier le lien d'invitation
    </button>
    <button class="btn-secondary" id="shareWhatsApp">
      💬 Partager sur WhatsApp
    </button>
    <button class="btn-secondary" id="downloadQR">
      ⬇️ Télécharger le QR Code seul
    </button>
  </div>
  <div style="height:40px;"></div>
</div>
```

`;

// Generate QR
loadQRLib().then(() => {
const el = document.getElementById(‘qrCodePreview’);
if (!el) return;
try {
new window.QRCode(el, {
text: rsvpUrl,
width: 100, height: 100,
colorDark: ‘#1a0a2e’,
colorLight: ‘#ffffff’,
correctLevel: window.QRCode.CorrectLevel.H,
});
} catch(e) { el.textContent = ‘QR non disponible’; }
});

// Theme switcher
let activeTheme = 0;
container.querySelectorAll(’.theme-btn’).forEach(btn => {
btn.addEventListener(‘click’, () => {
activeTheme = parseInt(btn.dataset.theme);
container.querySelectorAll(’.theme-btn’).forEach(b => {
b.style.borderColor = b.dataset.theme == activeTheme ? ‘rgba(255,255,255,0.5)’ : ‘transparent’;
});
const card = document.getElementById(‘invitationCard’);
if (card) {
card.querySelector(‘div’).style.background = themes[activeTheme].bg;
}
});
});

// Download PNG
document.getElementById(‘downloadPng’).addEventListener(‘click’, async () => {
try {
await loadHtml2Canvas();
const card = document.getElementById(‘invitationCard’);
const canvas = await window.html2canvas(card, { backgroundColor: null, scale: 2 });
const link = document.createElement(‘a’);
link.download = `invitation-${event.name.replace(/\s+/g, '-')}.png`;
link.href = canvas.toDataURL(‘image/png’);
link.click();
showToast(‘Image téléchargée !’, ‘success’);
} catch(e) {
showToast(‘Erreur lors de l'export’, ‘error’);
}
});

// Copy link
document.getElementById(‘shareLinkBtn’).addEventListener(‘click’, () => {
navigator.clipboard.writeText(rsvpUrl).then(() => {
showToast(‘Lien copié !’, ‘success’);
}).catch(() => {
showToast(rsvpUrl, ‘info’, 6000);
});
});

// WhatsApp
document.getElementById(‘shareWhatsApp’).addEventListener(‘click’, () => {
const msg = document.getElementById(‘inviteMsg’)?.value || ‘’;
const text = encodeURIComponent(
`🎉 *${event.name}*\n` +
(event.date ? `📅 ${formatDate(new Date(event.date))}\n` : ‘’) +
(event.location ? `📍 ${event.location}\n` : ‘’) +
(msg ? `\n${msg}\n` : ‘’) +
`\n➡️ RSVP : ${rsvpUrl}`
);
window.open(`https://wa.me/?text=${text}`, ‘_blank’);
});

// Download QR only
document.getElementById(‘downloadQR’).addEventListener(‘click’, () => {
const canvas = document.querySelector(’#qrCodePreview canvas’);
if (!canvas) { showToast(‘Génère d'abord le QR’, ‘error’); return; }
const link = document.createElement(‘a’);
link.download = `qr-${event.name.replace(/\s+/g, '-')}.png`;
link.href = canvas.toDataURL();
link.click();
showToast(‘QR téléchargé !’, ‘success’);
});
}

// ── Themes ────────────────────────────────────────────
const themes = [
{ bg: ‘linear-gradient(135deg,rgba(124,58,237,0.3),rgba(236,72,153,0.2),rgba(6,182,212,0.15))’ },
{ bg: ‘linear-gradient(135deg,rgba(16,185,129,0.3),rgba(6,182,212,0.25))’ },
{ bg: ‘linear-gradient(135deg,rgba(245,158,11,0.3),rgba(239,68,68,0.25))’ },
{ bg: ‘linear-gradient(135deg,rgba(59,130,246,0.3),rgba(124,58,237,0.25))’ },
{ bg: ‘linear-gradient(135deg,rgba(236,72,153,0.35),rgba(245,158,11,0.2))’ },
];

function formatDate(date) {
return date.toLocaleDateString(‘fr-FR’, { weekday: ‘long’, day: ‘numeric’, month: ‘long’, hour: ‘2-digit’, minute: ‘2-digit’ });
}

function escHtml(s) {
if (!s) return ‘’;
return s.replace(/&/g,’&’).replace(/</g,’<’).replace(/>/g,’>’).replace(/”/g,’"’);
}

function noEventHtml() {
return `<div class="view-enter"><div class="empty-state">
<div class="empty-icon">📩</div>
<div class="empty-title">Aucune soirée active</div>
<div class="empty-desc">Sélectionne une soirée pour générer ses invitations.</div>

  </div></div>`;
}