// ============================================================
// NIGHTR — Ambiance & Extras
// ============================================================
import { showModal, showToast, getActiveEvent } from ‘./app.js’;
import { updateEvent } from ‘./firebase.js’;

export function renderVibes(container, state) {
const event = getActiveEvent();
if (!event) { container.innerHTML = noEventHtml(); return; }

const vibes = event.vibes || {};

container.innerHTML = `
<div class="view-enter stagger">
<h2 class="view-title">Ambiance</h2>
<p class="view-subtitle">${escHtml(event.name)}</p>

```
  <!-- Mood Board -->
  <p class="section-title">Thème & Mood</p>
  <div class="glass-card" style="padding:20px;margin-bottom:20px;">
    <div class="input-group">
      <label class="input-label">Thème de la soirée</label>
      <input class="input-field" id="vibeTheme" type="text" placeholder="Jungle, années 80, casino, cinéma…" value="${escHtml(vibes.theme || '')}" />
    </div>
    <div class="input-group">
      <label class="input-label">Dress code</label>
      <input class="input-field" id="vibeDress" type="text" placeholder="Élégant, costumé, tout blanc…" value="${escHtml(event.dressCode || '')}" />
    </div>
    <div class="input-group">
      <label class="input-label">Ambiance / mots clés</label>
      <input class="input-field" id="vibeKeywords" type="text" placeholder="Festif, intimiste, chill, énergique…" value="${escHtml(vibes.keywords || '')}" />
    </div>
    <div class="input-group" style="margin-bottom:0;">
      <label class="input-label">Couleurs dominantes</label>
      <div style="display:flex;gap:8px;flex-wrap:wrap;" id="colorPicker">
        ${['#7c3aed','#ec4899','#3b82f6','#10b981','#f59e0b','#ef4444','#06b6d4','#ffffff'].map(c => `
          <button class="color-btn" data-color="${c}" style="
            width:32px;height:32px;border-radius:50%;background:${c};
            border:3px solid ${(vibes.colors||[]).includes(c) ? 'white' : 'transparent'};
            cursor:pointer;transition:all 0.2s;flex-shrink:0;">
          </button>
        `).join('')}
      </div>
    </div>
  </div>

  <!-- Music -->
  <p class="section-title">Musique</p>
  <div class="glass-card" style="padding:20px;margin-bottom:20px;">
    <div class="input-group">
      <label class="input-label">Lien Spotify / Apple Music</label>
      <input class="input-field" id="vibeSpotify" type="url" placeholder="https://open.spotify.com/playlist/…" value="${escHtml(vibes.playlistUrl || '')}" />
    </div>
    ${vibes.playlistUrl ? `
      <a href="${escHtml(vibes.playlistUrl)}" target="_blank" class="btn-secondary btn-full" style="text-align:center;text-decoration:none;display:flex;">
        🎵 Ouvrir la playlist
      </a>
    ` : ''}
    <div class="input-group" style="margin-top:12px;margin-bottom:0;">
      <label class="input-label">Genres musicaux</label>
      <input class="input-field" id="vibeGenres" type="text" placeholder="House, Hip-hop, Funk, Pop…" value="${escHtml(vibes.genres || '')}" />
    </div>
  </div>

  <!-- Notes -->
  <p class="section-title">Notes organisateur</p>
  <div class="glass-card" style="padding:20px;margin-bottom:20px;">
    <textarea class="input-field" id="vibeNotes" rows="4" placeholder="Tes notes privées sur l'organisation, idées, contacts prestataires…" style="resize:none;">${escHtml(vibes.notes || '')}</textarea>
  </div>

  <!-- Post-event -->
  <p class="section-title">Compte-rendu post-soirée</p>
  <div class="glass-card" style="padding:20px;margin-bottom:20px;">
    <div class="input-group">
      <label class="input-label">Comment s'est passée la soirée ?</label>
      <textarea class="input-field" id="vibeReview" rows="3" placeholder="Points positifs, à améliorer, moments forts…" style="resize:none;">${escHtml(vibes.review || '')}</textarea>
    </div>
    <div class="input-group" style="margin-bottom:0;">
      <label class="input-label">Note globale</label>
      <div id="ratingStars" style="display:flex;gap:6px;">
        ${[1,2,3,4,5].map(n => `
          <button class="star-btn" data-val="${n}" style="
            font-size:28px;background:none;border:none;cursor:pointer;
            color:${(vibes.rating||0) >= n ? '#f59e0b' : 'rgba(255,255,255,0.15)'};
            transition:all 0.15s;">★</button>
        `).join('')}
      </div>
    </div>
  </div>

  <button class="btn-primary btn-full" id="saveVibes">💾 Sauvegarder</button>
  <div style="height:40px;"></div>
</div>
```

`;

// Color picker
let selectedColors = […(vibes.colors || [])];
container.querySelectorAll(’.color-btn’).forEach(btn => {
btn.addEventListener(‘click’, () => {
const c = btn.dataset.color;
if (selectedColors.includes(c)) {
selectedColors = selectedColors.filter(x => x !== c);
btn.style.borderColor = ‘transparent’;
} else {
selectedColors.push(c);
btn.style.borderColor = ‘white’;
}
});
});

// Stars
let selectedRating = vibes.rating || 0;
container.querySelectorAll(’.star-btn’).forEach(btn => {
btn.addEventListener(‘click’, () => {
selectedRating = parseInt(btn.dataset.val);
container.querySelectorAll(’.star-btn’).forEach(b => {
b.style.color = parseInt(b.dataset.val) <= selectedRating ? ‘#f59e0b’ : ‘rgba(255,255,255,0.15)’;
});
});
btn.addEventListener(‘mouseenter’, () => {
const val = parseInt(btn.dataset.val);
container.querySelectorAll(’.star-btn’).forEach(b => {
b.style.color = parseInt(b.dataset.val) <= val ? ‘#fbbf24’ : ‘rgba(255,255,255,0.15)’;
});
});
btn.addEventListener(‘mouseleave’, () => {
container.querySelectorAll(’.star-btn’).forEach(b => {
b.style.color = parseInt(b.dataset.val) <= selectedRating ? ‘#f59e0b’ : ‘rgba(255,255,255,0.15)’;
});
});
});

// Save
container.querySelector(’#saveVibes’).addEventListener(‘click’, async () => {
const data = {
vibes: {
theme:       document.getElementById(‘vibeTheme’).value.trim(),
keywords:    document.getElementById(‘vibeKeywords’).value.trim(),
colors:      selectedColors,
playlistUrl: document.getElementById(‘vibeSpotify’).value.trim(),
genres:      document.getElementById(‘vibeGenres’).value.trim(),
notes:       document.getElementById(‘vibeNotes’).value.trim(),
review:      document.getElementById(‘vibeReview’).value.trim(),
rating:      selectedRating,
},
dressCode: document.getElementById(‘vibeDress’).value.trim() || event.dressCode,
};
try {
await updateEvent(state.user.uid, event.id, data);
showToast(‘Ambiance sauvegardée ! 🎵’, ‘success’);
} catch(e) {
showToast(‘Erreur de sauvegarde’, ‘error’);
}
});
}

function escHtml(s) { if (!s) return ‘’; return s.replace(/&/g,’&’).replace(/</g,’<’).replace(/>/g,’>’).replace(/”/g,’"’); }
function noEventHtml() {
return `<div class="view-enter"><div class="empty-state"><div class="empty-icon">🎵</div><div class="empty-title">Aucune soirée active</div></div></div>`;
}