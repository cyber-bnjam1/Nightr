/* ============================================================
   NIGHTR — nightr.js  (vanilla JS, aucun module ES)
   ============================================================ */

// ══════════════════════════════════════════════════════════════
// ⚠️  REMPLACE CES VALEURS PAR TA CONFIG FIREBASE
// ══════════════════════════════════════════════════════════════
var FIREBASE_CONFIG = {
  apiKey:            "AIzaSyCR3A1Rfd08MdnSAVKcMFZh1mApCnt_dL0",
  authDomain:        "nightr-48fd7.firebaseapp.com",
  projectId:         "nightr-48fd7",
  storageBucket:     "nightr-48fd7.firebasestorage.app",
  messagingSenderId: "781987170518",
  appId:             "1:781987170518:web:5b49f4958b0ac313e1a177"
};
// ══════════════════════════════════════════════════════════════

// ── Détection config valide ───────────────────────────────────
var FIREBASE_OK = (
  FIREBASE_CONFIG.apiKey &&
  FIREBASE_CONFIG.apiKey !== "VOTRE_API_KEY" &&
  FIREBASE_CONFIG.projectId &&
  FIREBASE_CONFIG.projectId !== "VOTRE_PROJECT_ID"
);

// ── STATE ─────────────────────────────────────────────────────
var APP = {
  user:     null,
  events:   [],
  activeId: null,
  view:     'dashboard',
  unsubs:   [],
  localMode: !FIREBASE_OK   // true = stockage localStorage uniquement
};

// Charge les events depuis localStorage si mode local
function _loadLocal() {
  try {
    var raw = localStorage.getItem('nightr_events');
    APP.events = raw ? JSON.parse(raw) : [];
  } catch(e) { APP.events = []; }
  APP.activeId = localStorage.getItem('nightr_ev') || (APP.events[0] ? APP.events[0].id : null);
}
function _saveLocal() {
  try { localStorage.setItem('nightr_events', JSON.stringify(APP.events)); } catch(e) {}
}
function _genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

function activeEvent() {
  return APP.events.find(function(e){ return e.id === APP.activeId; }) || null;
}
function setActive(id) {
  APP.activeId = id;
  localStorage.setItem('nightr_ev', id || '');
  var el = document.getElementById('activeEventName');
  if (el) el.textContent = (activeEvent() || {name:'Aucune soirée'}).name;
  navTo(APP.view);
}

// ── FIREBASE INIT (seulement si config valide) ────────────────
var db, auth;
if (FIREBASE_OK) {
  try {
    firebase.initializeApp(FIREBASE_CONFIG);
    db   = firebase.firestore();
    auth = firebase.auth();
  } catch(e) {
    console.warn('Firebase init failed:', e.message);
    APP.localMode = true;
  }
}

// ── DOM READY ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  setupMenu();
  setupNav();

  // Capture le retour de la redirection Google Auth
  if (!APP.localMode && auth) {
    auth.getRedirectResult().then(function(result) {
      if (result && result.user) {
        toast('Connecté avec Google ! Bienvenue ' + (result.user.displayName || '') + ' 🎉', 'ok', 4000);
      }
    }).catch(function(e) {
      // credential-already-in-use : un compte Google existe déjà, on s'y connecte
      if (e.code === 'auth/credential-already-in-use' && e.credential) {
        auth.signInWithCredential(e.credential)
          .then(function(r){ toast('Compte Google lié !','ok'); })
          .catch(function(){ toast('Erreur de connexion Google','err'); });
      } else if (e.code && e.code !== 'auth/no-auth-event') {
        console.warn('Redirect result error:', e.code, e.message);
      }
    });
  }

  if (APP.localMode) {
    // Mode local : pas de Firebase, on démarre directement
    _loadLocal();
    APP.user = { uid: 'local', displayName: 'Utilisateur local', isAnonymous: true };
    updateUserUI(APP.user);
    // Fake user chip
    var nm = document.getElementById('userName');
    var em = document.getElementById('userEmail');
    if (nm) nm.textContent = 'Mode local';
    if (em) em.textContent = '⚠️ Firebase non configuré';
    navTo('dashboard');
    // Warn banner
    toast('Mode local actif — configure Firebase pour sauvegarder dans le cloud', 'inf', 6000);
  } else {
    auth.onAuthStateChanged(function(user) {
      if (user) {
        APP.user = user;
        updateUserUI(user);
        startEventListener(user.uid);
      } else {
        // Connexion anonyme automatique — pas de blocage sur un écran de login
        auth.signInAnonymously().catch(function(e) {
          console.warn('Auto sign-in failed:', e.message);
          // Fallback : mode local si Firebase Auth échoue
          APP.localMode = true;
          _loadLocal();
          APP.user = { uid: 'local', isAnonymous: true };
          updateUserUI(APP.user);
          navTo('dashboard');
          toast('Mode local activé (Firebase Auth indisponible)', 'inf', 5000);
        });
      }
    });
  }
});

// ── FIREBASE HELPERS ──────────────────────────────────────────
function eventsCol(uid)        { return db.collection('users').doc(uid).collection('events'); }
function eventDoc(uid, eid)    { return eventsCol(uid).doc(eid); }
function subCol(uid, eid, sub) { return eventDoc(uid, eid).collection(sub); }

function createEvent(data, cb) {
  if (APP.localMode) {
    var ev = Object.assign({}, data, { id: _genId(), createdAt: Date.now() });
    APP.events.unshift(ev);
    _saveLocal();
    if (cb) cb({ id: ev.id });
    return;
  }
  eventsCol(APP.user.uid)
    .add(Object.assign({}, data, { createdAt: firebase.firestore.FieldValue.serverTimestamp() }))
    .then(cb)
    .catch(function(e){ toast('Erreur: ' + e.message, 'err'); });
}
function updateEvent(eid, data) {
  if (APP.localMode) {
    var idx = APP.events.findIndex(function(e){ return e.id === eid; });
    if (idx > -1) { Object.assign(APP.events[idx], data); _saveLocal(); }
    // Re-render si c'est l'event actif
    var el = document.getElementById('activeEventName');
    if (el && APP.activeId === eid) el.textContent = (activeEvent()||{name:''}).name;
    return;
  }
  eventDoc(APP.user.uid, eid)
    .update(Object.assign({}, data, { updatedAt: firebase.firestore.FieldValue.serverTimestamp() }))
    .catch(function(e){ toast(e.message,'err'); });
}
function deleteEventDoc(eid) {
  if (APP.localMode) {
    APP.events = APP.events.filter(function(e){ return e.id !== eid; });
    _saveLocal();
    if (APP.activeId === eid) setActive(APP.events[0] ? APP.events[0].id : null);
    navTo(APP.view);
    return;
  }
  eventDoc(APP.user.uid, eid).delete();
}
function startEventListener(uid) {
  APP.unsubs.forEach(function(fn){ fn(); });
  APP.unsubs = [];
  var unsub = eventsCol(uid).orderBy('createdAt','desc').onSnapshot(function(snap) {
    APP.events = snap.docs.map(function(d){ return Object.assign({ id: d.id }, d.data()); });
    if (APP.activeId && !APP.events.find(function(e){ return e.id === APP.activeId; })) {
      APP.activeId = APP.events[0] ? APP.events[0].id : null;
    } else if (!APP.activeId && APP.events.length) {
      APP.activeId = APP.events[0].id;
    }
    localStorage.setItem('nightr_ev', APP.activeId || '');
    var el = document.getElementById('activeEventName');
    if (el) el.textContent = activeEvent() ? activeEvent().name : 'Aucune soirée';
    navTo(APP.view);
  });
  APP.unsubs.push(unsub);
}

// ── SUB-COLLECTIONS (localStorage en mode local) ──────────────
function _subKey(sub) { return 'nightr_sub_' + APP.activeId + '_' + sub; }
function _loadSub(sub) {
  try { return JSON.parse(localStorage.getItem(_subKey(sub)) || '[]'); } catch(e){ return []; }
}
function _saveSub(sub, arr) {
  try { localStorage.setItem(_subKey(sub), JSON.stringify(arr)); } catch(e){}
}

function addSub(sub, data, cb) {
  if (APP.localMode) {
    var arr = _loadSub(sub);
    var item = Object.assign({}, data, { id: _genId(), createdAt: Date.now() });
    arr.push(item);
    _saveSub(sub, arr);
    if (cb) cb({ id: item.id });
    // Trigger re-render via fake snapshot
    if (_subListeners[sub]) _subListeners[sub](arr);
    return;
  }
  subCol(APP.user.uid, APP.activeId, sub)
    .add(Object.assign({}, data, { createdAt: firebase.firestore.FieldValue.serverTimestamp() }))
    .then(cb || function(){})
    .catch(function(e){ toast(e.message,'err'); });
}
function updateSub(sub, id, data) {
  if (APP.localMode) {
    var arr = _loadSub(sub);
    var idx = arr.findIndex(function(i){ return i.id === id; });
    if (idx > -1) { Object.assign(arr[idx], data); _saveSub(sub, arr); }
    if (_subListeners[sub]) _subListeners[sub](arr);
    return;
  }
  subCol(APP.user.uid, APP.activeId, sub).doc(id)
    .update(Object.assign({}, data, { updatedAt: firebase.firestore.FieldValue.serverTimestamp() }))
    .catch(function(e){ toast(e.message,'err'); });
}
function deleteSub(sub, id) {
  if (APP.localMode) {
    var arr = _loadSub(sub).filter(function(i){ return i.id !== id; });
    _saveSub(sub, arr);
    if (_subListeners[sub]) _subListeners[sub](arr);
    return;
  }
  subCol(APP.user.uid, APP.activeId, sub).doc(id).delete();
}
var _subListeners = {};
function listenSub(sub, cb) {
  if (APP.localMode) {
    _subListeners[sub] = cb;
    cb(_loadSub(sub));   // appel immédiat avec données existantes
    return function(){ delete _subListeners[sub]; };
  }
  return subCol(APP.user.uid, APP.activeId, sub)
    .orderBy('createdAt','asc')
    .onSnapshot(function(snap){
      cb(snap.docs.map(function(d){ return Object.assign({ id: d.id }, d.data()); }));
    });
}

// ── MENU ──────────────────────────────────────────────────────
function setupMenu() {
  document.getElementById('burgerBtn').addEventListener('click', openMenu);
  document.getElementById('closeMenuBtn').addEventListener('click', closeMenu);
  document.getElementById('menuOverlay').addEventListener('click', closeMenu);
  document.getElementById('addBtn').addEventListener('click', function(){ showNewEventModal(); });
  document.getElementById('eventChip').addEventListener('click', function(){ closeMenu(); showSwitcherModal(); });

  // Swipe left to close
  var panel = document.getElementById('menuPanel');
  var sx = 0;
  panel.addEventListener('touchstart', function(e){ sx = e.touches[0].clientX; }, { passive: true });
  panel.addEventListener('touchend', function(e){ if (sx - e.changedTouches[0].clientX > 55) closeMenu(); }, { passive: true });
}
function openMenu() {
  document.getElementById('menuPanel').classList.add('open');
  document.getElementById('menuOverlay').classList.add('on');
  document.getElementById('burgerBtn').classList.add('open');
}
function closeMenu() {
  document.getElementById('menuPanel').classList.remove('open');
  document.getElementById('menuOverlay').classList.remove('on');
  document.getElementById('burgerBtn').classList.remove('open');
}

// ── NAV ───────────────────────────────────────────────────────
function setupNav() {
  document.querySelectorAll('.nav-btn[data-view]').forEach(function(btn) {
    btn.addEventListener('click', function(){ navTo(btn.dataset.view); });
  });
}
function navTo(view) {
  APP.view = view;
  closeMenu();
  document.querySelectorAll('.nav-btn[data-view]').forEach(function(b){
    b.classList.toggle('active', b.dataset.view === view);
  });
  var container = document.getElementById('view');
  container.innerHTML = '';
  var renders = {
    dashboard:     renderDashboard,
    guests:        renderGuests,
    invitations:   renderInvitations,
    contributions: renderContributions,
    budget:        renderBudget,
    checklist:     renderChecklist,
    vibes:         renderVibes
  };
  if (renders[view]) renders[view](container);
}

// ── AUTH SCREEN ───────────────────────────────────────────────
function showAuthScreen() {
  // Cette fonction n'est plus utilisée comme écran bloquant.
  // Garde pour compatibilité — la connexion se fait automatiquement.
}

// Connexion Google — utilise linkWithRedirect pour conserver les données anonymes
function showLoginModal() {
  var close = showModal(
    '<h3 class="modal-title">🌙 Connexion Google</h3>' +
    '<p class="modal-sub">Tes soirées seront synchronisées sur tous tes appareils. Les données existantes sont conservées.</p>' +
    '<button class="btn btn-p btn-full" id="lg-google">' +
    '  <svg width="18" height="18" viewBox="0 0 24 24" style="flex-shrink:0"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>' +
    '  Continuer avec Google' +
    '</button>' +
    '<div style="height:10px;"></div>' +
    '<button class="btn btn-s btn-full" id="lg-cancel">Pas maintenant</button>'
  );
  on('lg-google','click', function() {
    var provider = new firebase.auth.GoogleAuthProvider();
    var currentUser = auth.currentUser;
    // Si connecté en anonyme → on lie le compte Google (conserve toutes les données)
    if (currentUser && currentUser.isAnonymous) {
      currentUser.linkWithRedirect(provider);
    } else {
      auth.signInWithRedirect(provider);
    }
  });
  on('lg-cancel','click', close);
}

// ── USER UI ───────────────────────────────────────────────────
function updateUserUI(user) {
  var av = document.getElementById('userAv');
  var nm = document.getElementById('userName');
  var em = document.getElementById('userEmail');
  if (!user) { av.textContent='?'; nm.textContent='Non connecté'; em.textContent='—'; return; }
  if (user.isAnonymous) {
    av.textContent='👤'; nm.textContent='Mode invité'; em.textContent='Tap pour se connecter';
    var chip = document.getElementById('userChip');
    if (chip) {
      chip.style.cursor='pointer';
      chip.onclick = function(){ if(!APP.localMode && auth) showLoginModal(); };
    }
    return;
  }
  var n = user.displayName || 'Utilisateur';
  av.textContent = n.charAt(0).toUpperCase();
  nm.textContent = n;
  em.textContent = user.email || '';
}

// ── TOAST ──────────────────────────────────────────────────────
function toast(msg, type, dur) {
  type = type || 'inf'; dur = dur || 3000;
  var icons = { ok:'✓', err:'✕', inf:'●' };
  var cls   = { ok:'ti-ok', err:'ti-err', inf:'ti-inf' };
  var c = document.getElementById('toasts');
  var t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = '<span class="' + (cls[type]||'ti-inf') + '">' + (icons[type]||'●') + '</span><span>' + esc(msg) + '</span>';
  c.appendChild(t);
  setTimeout(function(){
    t.classList.add('out');
    t.addEventListener('animationend', function(){ t.remove(); }, { once: true });
  }, dur);
}

// ── MODAL ──────────────────────────────────────────────────────
var _modalClose = null;
function showModal(html, onClose) {
  var bg   = document.getElementById('modalBg');
  var wrap = document.getElementById('modalWrap');
  wrap.innerHTML = '<div class="modal-sheet"><div class="modal-handle"></div>' + html + '</div>';
  bg.classList.add('on');
  wrap.classList.add('on');
  function close() {
    bg.classList.remove('on');
    wrap.classList.remove('on');
    setTimeout(function(){ wrap.innerHTML = ''; if (onClose) onClose(); }, 420);
  }
  // Ferme seulement si clic direct sur le fond (pas sur le contenu)
  bg.onclick = function(e) { if (e.target === bg) close(); };
  _modalClose = close;
  return close;
}

// ── HELPERS ───────────────────────────────────────────────────
function esc(s) { return s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') : ''; }
function fmtDate(d) { return d.toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}); }
function fmtDateLong(d) { return d.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'}); }
function countdown(d, now) {
  var ms = d - now; if (ms <= 0) return null;
  var days = Math.floor(ms/86400000); if (days > 0) return days + 'j';
  var h = Math.floor(ms/3600000); if (h > 0) return h + 'h';
  return Math.floor(ms/60000) + 'min';
}
function greeting() {
  var h = new Date().getHours();
  return h < 12 ? 'Bonne matinée ☀️' : h < 18 ? 'Bonne après-midi 🌤️' : h < 21 ? 'Bonne soirée 🌆' : 'Bonne nuit 🌙';
}
function on(id, ev, fn) { var el = document.getElementById(id); if (el) el.addEventListener(ev, fn); }
function val(id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; }
function pbar(id, pct, danger) {
  var el = document.getElementById(id);
  if (!el) return;
  el.style.width = pct + '%';
  if (danger && pct > 90) el.style.background = 'linear-gradient(90deg,var(--amber),var(--red))';
}

// ══════════════════════════════════════════════════════════════
// VIEWS
// ══════════════════════════════════════════════════════════════

// ── DASHBOARD ────────────────────────────────────────────────
function renderDashboard(container) {
  var ev  = activeEvent();
  var now = new Date();
  var evHtml = '';
  if (ev) {
    var date   = ev.date ? new Date(ev.date) : null;
    var isPast = date && date < now;
    var cd     = date && !isPast ? countdown(date, now) : null;
    var conf   = ev.confirmedCount || 0;
    var total  = ev.guestCount || 0;
    evHtml =
      '<div class="hero">' +
        '<div class="hero-bg" style="background:linear-gradient(135deg,rgba(124,58,237,.5),rgba(236,72,153,.4),rgba(6,182,212,.25));"></div>' +
        '<div class="hero-ov"></div>' +
        '<div class="hero-c">' +
          (isPast ? '<span class="pill pill-p" style="margin-bottom:10px;">✓ Passée</span>' :
                    cd ? '<span class="pill pill-g" style="margin-bottom:10px;">● Dans ' + cd + '</span>' : '') +
          '<h3 style="font-family:var(--fd);font-size:23px;font-weight:800;margin-bottom:6px;">' + esc(ev.name) + '</h3>' +
          '<p style="font-size:13px;opacity:.75;margin-bottom:12px;">' +
            (date ? fmtDate(date) : 'Date à définir') +
            (ev.location ? ' · ' + esc(ev.location) : '') +
          '</p>' +
          '<div style="display:flex;gap:14px;flex-wrap:wrap;font-size:13px;opacity:.9;">' +
            (total > 0 ? '<span>👥 ' + conf + '/' + total + ' confirmés</span>' : '') +
            (ev.budget ? '<span>💰 ' + ev.budget + '€</span>' : '') +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="sgrid">' +
        _qaBtn('qa-g','👥','Invités', conf + ' confirmés') +
        _qaBtn('qa-i','📩','Invitations','Créer & partager') +
        _qaBtn('qa-b','💰','Budget', ev.budget ? ev.budget+'€' : 'À définir') +
        _qaBtn('qa-c','✅','Checklist','Prépare ta soirée') +
      '</div>';
  } else {
    evHtml =
      '<div class="glass-card" style="padding:34px 22px;text-align:center;margin-bottom:22px;">' +
        '<div style="font-size:52px;margin-bottom:14px;">🎉</div>' +
        '<div style="font-family:var(--fd);font-size:19px;font-weight:700;margin-bottom:8px;">Crée ta première soirée</div>' +
        '<p style="font-size:14px;color:var(--txt2);margin-bottom:20px;line-height:1.6;">Invite tes amis, gère le budget,<br>génère des invitations stylées.</p>' +
        '<button class="btn btn-p" id="heroCreate">✦ Nouvelle soirée</button>' +
      '</div>';
  }

  var evList = APP.events.length ? APP.events.map(function(e) {
    var isAct = e.id === APP.activeId;
    var d = e.date ? new Date(e.date) : null;
    var past = d && d < now;
    return '<div class="li" style="cursor:pointer;' + (isAct?'border-color:rgba(168,85,247,.4);background:rgba(124,58,237,.1);':'') + '" data-eid="' + esc(e.id) + '">' +
      '<div class="li-icon" style="background:' + (isAct?'rgba(124,58,237,.25)':'var(--gb2)') + ';">' + (e.emoji||'🎉') + '</div>' +
      '<div class="li-c"><div class="li-t">' + esc(e.name) + '</div>' +
        '<div class="li-s">' + (d?fmtDate(d):'Date non définie') + (e.location?' · '+esc(e.location):'') + '</div></div>' +
      '<div style="display:flex;align-items:center;gap:6px;">' +
        (past ? '<span class="pill pill-p" style="font-size:10px;">Passée</span>' : '') +
        (isAct ? '<span style="color:#c084fc;font-size:17px;">✦</span>' : '') +
        '<button class="glass-btn ev-del" data-eid="' + esc(e.id) + '" style="width:28px;height:28px;font-size:11px;color:var(--txt3);">✕</button>' +
      '</div></div>';
  }).join('') : '<div class="empty"><div class="empty-d">Aucune soirée pour l\'instant</div></div>';

  var statsHtml = APP.events.length ?
    '<div class="sgrid">' +
      '<div class="scard"><div class="sval" style="color:#c084fc;">' + APP.events.length + '</div><div class="slbl">Total soirées</div></div>' +
      '<div class="scard"><div class="sval" style="color:var(--green);">' + APP.events.filter(function(e){ return e.date && new Date(e.date) > now; }).length + '</div><div class="slbl">À venir</div></div>' +
    '</div>' : '';

  container.innerHTML =
    '<div class="stagger">' +
      '<h2 class="vtitle">' + greeting() + '</h2>' +
      '<p class="vsub">' + new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'}) + '</p>' +
      evHtml +
      statsHtml +
      '<p class="stitle">Mes soirées</p>' +
      evList +
      '<div style="height:80px;"></div>' +
    '</div>';

  // FAB
  var fab = document.createElement('button');
  fab.className = 'fab';
  fab.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
  fab.addEventListener('click', showNewEventModal);
  container.appendChild(fab);

  // Events
  if (document.getElementById('heroCreate')) document.getElementById('heroCreate').onclick = showNewEventModal;
  if (document.getElementById('qa-g')) document.getElementById('qa-g').onclick = function(){ navTo('guests'); };
  if (document.getElementById('qa-i')) document.getElementById('qa-i').onclick = function(){ navTo('invitations'); };
  if (document.getElementById('qa-b')) document.getElementById('qa-b').onclick = function(){ navTo('budget'); };
  if (document.getElementById('qa-c')) document.getElementById('qa-c').onclick = function(){ navTo('checklist'); };

  container.querySelectorAll('[data-eid]').forEach(function(el) {
    el.addEventListener('click', function(e) {
      if (e.target.closest('.ev-del')) return;
      setActive(el.dataset.eid);
      toast('"' + (activeEvent()||{name:''}).name + '" activée', 'ok');
    });
  });
  container.querySelectorAll('.ev-del').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      if (!confirm('Supprimer cette soirée ?')) return;
      deleteEventDoc(btn.dataset.eid);
      toast('Soirée supprimée','inf');
    });
  });
}
function _qaBtn(id, ico, title, sub) {
  return '<button class="glass-card" id="' + id + '" style="padding:15px;text-align:left;border:none;cursor:pointer;width:100%;border-radius:var(--r2);">' +
    '<div style="font-size:21px;margin-bottom:5px;">' + ico + '</div>' +
    '<div style="font-size:13px;font-weight:600;color:var(--txt);">' + title + '</div>' +
    '<div style="font-size:11px;color:var(--txt2);">' + sub + '</div></button>';
}

// New event modal
function showNewEventModal() {
  var emojis = ['🎉','🎂','🍾','🕺','🎸','🌙','🔥','🎭','🌊','🎪'];
  var selEmoji = '🎉';
  var close = showModal(
    '<h3 class="modal-title">Nouvelle soirée ✦</h3>' +
    '<div class="ig"><label class="lbl">Emoji</label><div style="display:flex;gap:7px;flex-wrap:wrap;" id="epicker">' +
      emojis.map(function(e){ return '<button class="ep glass-btn" data-e="' + e + '" style="font-size:19px;width:40px;height:40px;' + (e===selEmoji?'background:rgba(124,58,237,.3);border-color:rgba(168,85,247,.5);':'') + '">' + e + '</button>'; }).join('') +
    '</div></div>' +
    '<div class="ig"><label class="lbl">Nom *</label><input class="inp" id="ne-name" type="text" placeholder="Soirée anniversaire de Lucas…"/></div>' +
    '<div class="ig"><label class="lbl">Date & heure</label><input class="inp" id="ne-date" type="datetime-local"/></div>' +
    '<div class="ig"><label class="lbl">Lieu</label><input class="inp" id="ne-loc" type="text" placeholder="12 rue des Fêtes, Paris…"/></div>' +
    '<div class="ig"><label class="lbl">Budget (€)</label><input class="inp" id="ne-budget" type="number" placeholder="0" min="0"/></div>' +
    '<div class="ig"><label class="lbl">Dress code</label><input class="inp" id="ne-dress" type="text" placeholder="Tenue élégante…"/></div>' +
    '<div style="display:flex;gap:11px;margin-top:8px;">' +
      '<button class="btn btn-s" id="ne-cancel" style="flex:1;">Annuler</button>' +
      '<button class="btn btn-p" id="ne-save" style="flex:2;">Créer ✦</button>' +
    '</div>'
  );
  document.querySelectorAll('.ep').forEach(function(btn) {
    btn.addEventListener('click', function() {
      selEmoji = btn.dataset.e;
      document.querySelectorAll('.ep').forEach(function(b) {
        b.style.background = b.dataset.e === selEmoji ? 'rgba(124,58,237,.3)' : '';
        b.style.borderColor = b.dataset.e === selEmoji ? 'rgba(168,85,247,.5)' : '';
      });
    });
  });
  on('ne-cancel','click', close);
  on('ne-save','click', function() {
    var name = val('ne-name');
    if (!name) { toast('Le nom est requis','err'); return; }
    createEvent({
      emoji: selEmoji, name: name,
      date: val('ne-date') || null,
      location: val('ne-loc') || null,
      budget: parseFloat(val('ne-budget')) || 0,
      dressCode: val('ne-dress') || null,
      guestCount: 0, confirmedCount: 0, spent: 0
    }, function(ref) {
      setActive(ref.id);
      toast('"' + name + '" créée ! 🎉','ok');
      close();
    });
  });
}

// Switcher modal
function showSwitcherModal() {
  var rows = APP.events.length ? APP.events.map(function(e) {
    var isAct = e.id === APP.activeId;
    return '<div class="li sw-row" data-sid="' + esc(e.id) + '" style="cursor:pointer;' + (isAct?'border-color:rgba(168,85,247,.4);':'') + '">' +
      '<div class="li-icon">' + (e.emoji||'🎉') + '</div>' +
      '<div class="li-c"><div class="li-t">' + esc(e.name) + '</div><div class="li-s">' + (e.date?fmtDate(new Date(e.date)):'Date non définie') + '</div></div>' +
      (isAct ? '<span style="color:#c084fc;">✦</span>' : '') +
    '</div>';
  }).join('') : '<div class="empty"><div class="empty-d">Aucune soirée</div></div>';

  var close = showModal(
    '<h3 class="modal-title">Changer de soirée</h3>' +
    '<p class="modal-sub">' + APP.events.length + ' soirée(s)</p>' +
    rows +
    '<button class="btn btn-p btn-full" id="sw-new" style="margin-top:14px;">+ Nouvelle soirée</button>'
  );
  document.querySelectorAll('.sw-row').forEach(function(el) {
    el.addEventListener('click', function() { setActive(el.dataset.sid); close(); });
  });
  on('sw-new','click', function(){ close(); setTimeout(showNewEventModal, 430); });
}

// ── GUESTS ────────────────────────────────────────────────────
var _gUnsub = null;
function renderGuests(container) {
  var ev = activeEvent();
  if (!ev) { container.innerHTML = _noEv(); return; }

  container.innerHTML =
    '<div class="vin">' +
    '<h2 class="vtitle">Invités & RSVP</h2><p class="vsub">' + esc(ev.name) + '</p>' +
    '<div class="sgrid">' +
      '<div class="scard"><div class="sval" style="color:var(--green);" id="gs-ok">0</div><div class="slbl">Confirmés ✅</div></div>' +
      '<div class="scard"><div class="sval" style="color:var(--amber);" id="gs-wait">0</div><div class="slbl">En attente ⏳</div></div>' +
      '<div class="scard"><div class="sval" style="color:var(--red);" id="gs-no">0</div><div class="slbl">Déclinés ❌</div></div>' +
      '<div class="scard"><div class="sval" id="gs-tot">0</div><div class="slbl">Total</div></div>' +
    '</div>' +
    '<div style="margin-bottom:18px;"><div class="pbar" style="height:7px;"><div class="pfill" id="gs-prog" style="width:0%;"></div></div>' +
      '<div style="font-size:11px;color:var(--txt3);margin-top:4px;text-align:right;" id="gs-pct">0% de réponses</div></div>' +
    '<div style="display:flex;gap:8px;margin-bottom:14px;">' +
      '<button class="btn btn-p" id="ga-add" style="flex:1;">+ Ajouter</button>' +
      '<button class="btn btn-s" id="ga-imp">📱 Contacts</button>' +
    '</div>' +
    '<div style="display:flex;gap:5px;margin-bottom:14px;">' +
      ['all','confirmed','pending','declined'].map(function(f,i){
        return '<button class="gfilt" data-f="' + f + '" style="flex:1;padding:8px 2px;border-radius:var(--rnd);font-size:11px;font-weight:600;cursor:pointer;border:1px solid ' + (i===0?'rgba(168,85,247,.3)':'var(--gbd)') + ';background:' + (i===0?'rgba(124,58,237,.25)':'var(--gb)') + ';color:' + (i===0?'#c084fc':'var(--txt2)') + ';">' + ['Tous','✅','⏳','❌'][i] + '</button>';
      }).join('') +
    '</div>' +
    '<div id="g-list" class="stagger"></div>' +
    '<div style="height:40px;"></div></div>';

  var filter = 'all';
  var allG   = [];

  container.querySelectorAll('.gfilt').forEach(function(btn) {
    btn.addEventListener('click', function() {
      filter = btn.dataset.f;
      container.querySelectorAll('.gfilt').forEach(function(b) {
        b.style.background = b.dataset.f===filter?'rgba(124,58,237,.25)':'var(--gb)';
        b.style.borderColor= b.dataset.f===filter?'rgba(168,85,247,.3)':'var(--gbd)';
        b.style.color      = b.dataset.f===filter?'#c084fc':'var(--txt2)';
      });
      _renderGList(container, allG, filter, ev);
    });
  });

  if (_gUnsub) _gUnsub();
  _gUnsub = listenSub('guests', function(guests) {
    allG = guests;
    var conf = guests.filter(function(g){ return g.status==='confirmed'; }).length;
    var wait = guests.filter(function(g){ return g.status==='pending'; }).length;
    var no   = guests.filter(function(g){ return g.status==='declined'; }).length;
    var tot  = guests.length;
    var pct  = tot > 0 ? Math.round((conf+no)/tot*100) : 0;
    var q = function(id){ return container.querySelector('#'+id); };
    if(q('gs-ok'))   q('gs-ok').textContent   = conf;
    if(q('gs-wait')) q('gs-wait').textContent  = wait;
    if(q('gs-no'))   q('gs-no').textContent    = no;
    if(q('gs-tot'))  q('gs-tot').textContent   = tot;
    if(q('gs-prog')) q('gs-prog').style.width  = pct + '%';
    if(q('gs-pct'))  q('gs-pct').textContent   = pct + '% de réponses';
    var badge = document.getElementById('badgeGuests');
    if (badge) badge.textContent = wait > 0 ? wait : '';
    updateEvent(ev.id, { guestCount: tot, confirmedCount: conf });
    _renderGList(container, guests, filter, ev);
  });

  on('ga-add','click', function(){ _addGuestModal(ev); });
  on('ga-imp','click', function(){ _importContacts(ev); });
}
function _renderGList(container, guests, filter, ev) {
  var data = filter==='all' ? guests : guests.filter(function(g){ return g.status===filter; });
  var el   = container.querySelector('#g-list');
  if (!el) return;
  if (!data.length) { el.innerHTML = '<div class="empty"><div class="empty-ico">👥</div><div class="empty-t">Aucun invité</div><div class="empty-d">' + (filter==='all'?'Ajoute tes premiers invités !':'Aucun dans cette catégorie') + '</div></div>'; return; }
  el.innerHTML = data.map(function(g) {
    var bg = g.status==='confirmed'?'rgba(16,185,129,.22)':g.status==='declined'?'rgba(239,68,68,.18)':'var(--gb2)';
    return '<div class="li" data-gid="' + esc(g.id) + '">' +
      '<div class="li-icon" style="border-radius:50%;background:' + bg + ';font-size:15px;font-weight:700;">' + esc(g.name.charAt(0).toUpperCase()) + '</div>' +
      '<div class="li-c"><div class="li-t">' + esc(g.name) + '</div>' +
        '<div class="li-s">' + [g.phone,g.group,g.plus?'+1':null].filter(Boolean).map(esc).join(' · ') + '</div></div>' +
      '<div style="display:flex;align-items:center;gap:3px;">' +
        ['confirmed','pending','declined'].map(function(s) {
          var icons = { confirmed:'✅', pending:'⏳', declined:'❌' };
          var bgs   = { confirmed:'rgba(16,185,129,.25)', pending:'rgba(245,158,11,.2)', declined:'rgba(239,68,68,.2)' };
          var bds   = { confirmed:'rgba(16,185,129,.4)', pending:'rgba(245,158,11,.3)', declined:'rgba(239,68,68,.3)' };
          var active = g.status===s;
          return '<button class="rb glass-btn" data-gid="' + esc(g.id) + '" data-s="' + s + '" style="width:30px;height:30px;font-size:12px;background:' + (active?bgs[s]:'transparent') + ';border-color:' + (active?bds[s]:'var(--gbd)') + ';">' + icons[s] + '</button>';
        }).join('') +
        '<button class="gdel glass-btn" data-gid="' + esc(g.id) + '" style="width:27px;height:27px;font-size:11px;color:var(--txt3);margin-left:2px;">✕</button>' +
      '</div></div>';
  }).join('');
  el.querySelectorAll('.rb').forEach(function(btn) {
    btn.addEventListener('click', function(){ updateSub('guests', btn.dataset.gid, { status: btn.dataset.s }); });
  });
  el.querySelectorAll('.gdel').forEach(function(btn) {
    btn.addEventListener('click', function(){ if(confirm('Supprimer ?')) deleteSub('guests', btn.dataset.gid); });
  });
}
function _addGuestModal(ev) {
  var close = showModal(
    '<h3 class="modal-title">Ajouter un invité</h3>' +
    '<div class="ig"><label class="lbl">Nom *</label><input class="inp" id="gn" type="text" placeholder="Marie Dupont"/></div>' +
    '<div class="ig"><label class="lbl">Téléphone</label><input class="inp" id="gp" type="tel" placeholder="+33 6 12 34 56 78"/></div>' +
    '<div class="ig"><label class="lbl">Email</label><input class="inp" id="ge" type="email" placeholder="marie@exemple.fr"/></div>' +
    '<div class="ig"><label class="lbl">Groupe</label><select class="inp" id="gg"><option value="">Aucun</option><option>Famille</option><option>Amis</option><option>Collègues</option><option>Autres</option></select></div>' +
    '<div style="display:flex;align-items:center;gap:12px;margin-bottom:15px;"><label style="font-size:14px;color:var(--txt2);flex:1;">Accompagné(e) (+1)</label><input type="checkbox" id="gplus" style="width:20px;height:20px;accent-color:var(--purple);"/></div>' +
    '<div style="display:flex;gap:11px;"><button class="btn btn-s" id="gc" style="flex:1;">Annuler</button><button class="btn btn-p" id="gs" style="flex:2;">Ajouter</button></div>'
  );
  on('gc','click',close);
  on('gs','click',function(){
    var name = val('gn');
    if (!name){ toast('Nom requis','err'); return; }
    addSub('guests',{ name:name, phone:val('gp')||null, email:val('ge')||null, group:val('gg')||null, plus:document.getElementById('gplus').checked, status:'pending' }, function(){ toast(name+' ajouté(e) !','ok'); close(); });
  });
}
async function _importContacts(ev) {
  if (!('contacts' in navigator && 'ContactsManager' in window)) { toast('Contact Picker non supporté','err'); return; }
  try {
    var contacts = await navigator.contacts.select(['name','tel','email'],{multiple:true});
    if (!contacts.length) return;
    contacts.forEach(function(c){ addSub('guests',{ name:c.name?.[0]||'Inconnu', phone:c.tel?.[0]||null, email:c.email?.[0]||null, status:'pending', plus:false }); });
    toast(contacts.length + ' contact(s) importé(s) !','ok');
  } catch(e){ toast('Import annulé','inf'); }
}

// ── INVITATIONS ───────────────────────────────────────────────
function renderInvitations(container) {
  var ev = activeEvent();
  if (!ev) { container.innerHTML = _noEv(); return; }
  var rsvp = location.origin + '/rsvp.html?event=' + ev.id;
  var themes = [
    'linear-gradient(135deg,rgba(124,58,237,.5),rgba(236,72,153,.4),rgba(6,182,212,.25))',
    'linear-gradient(135deg,rgba(16,185,129,.45),rgba(6,182,212,.35))',
    'linear-gradient(135deg,rgba(245,158,11,.45),rgba(239,68,68,.35))',
    'linear-gradient(135deg,rgba(59,130,246,.45),rgba(124,58,237,.35))',
    'linear-gradient(135deg,rgba(236,72,153,.5),rgba(245,158,11,.35))'
  ];
  var selTheme = 0;

  container.innerHTML =
    '<div class="stagger">' +
    '<h2 class="vtitle">Invitations & QR</h2><p class="vsub">' + esc(ev.name) + '</p>' +
    '<p class="stitle">Aperçu</p>' +
    '<div id="inv-card" style="position:relative;overflow:hidden;border-radius:var(--r3);padding:26px 22px;margin-bottom:18px;border:1px solid rgba(255,255,255,.14);min-height:270px;">' +
      '<div id="inv-bg" style="position:absolute;inset:0;z-index:0;background:' + themes[0] + ';"></div>' +
      '<div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.42),transparent);z-index:0;"></div>' +
      '<div style="position:relative;z-index:1;">' +
        '<div style="font-size:42px;margin-bottom:10px;">' + (ev.emoji||'🎉') + '</div>' +
        '<p style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:rgba(255,255,255,.5);margin-bottom:3px;">Tu es invité(e) à</p>' +
        '<h3 style="font-family:var(--fd);font-size:24px;font-weight:800;margin-bottom:10px;">' + esc(ev.name) + '</h3>' +
        '<div style="display:flex;flex-direction:column;gap:5px;margin-bottom:16px;">' +
          (ev.date ? '<div style="font-size:13px;opacity:.85;">📅 ' + fmtDateLong(new Date(ev.date)) + '</div>' : '') +
          (ev.location ? '<div style="font-size:13px;opacity:.85;">📍 ' + esc(ev.location) + '</div>' : '') +
          (ev.dressCode ? '<div style="font-size:13px;opacity:.85;">👗 ' + esc(ev.dressCode) + '</div>' : '') +
        '</div>' +
        '<div id="qr-box" style="background:#fff;border-radius:10px;padding:8px;display:inline-block;"></div>' +
      '</div>' +
    '</div>' +
    '<p class="stitle">Thème</p>' +
    '<div style="display:flex;gap:10px;margin-bottom:20px;overflow-x:auto;padding-bottom:2px;">' +
      themes.map(function(t,i){ return '<button class="tbtn" data-ti="' + i + '" style="width:50px;height:50px;border-radius:12px;background:' + t + ';flex-shrink:0;cursor:pointer;border:2px solid ' + (i===0?'rgba(255,255,255,.55)':'transparent') + ';transition:border .2s;"></button>'; }).join('') +
    '</div>' +
    '<div class="ig"><label class="lbl">Message personnalisé</label><textarea class="inp" id="inv-msg" rows="3" placeholder="Viens fêter ça avec nous ! 🥂" style="resize:none;">' + esc(ev.customMessage||'') + '</textarea></div>' +
    '<div style="display:flex;flex-direction:column;gap:10px;">' +
      '<button class="btn btn-p btn-full" id="inv-png">⬇️ Télécharger en PNG</button>' +
      '<button class="btn btn-s btn-full" id="inv-link">🔗 Copier le lien RSVP</button>' +
      '<button class="btn btn-s btn-full" id="inv-wa">💬 Partager sur WhatsApp</button>' +
      '<button class="btn btn-s btn-full" id="inv-qr">⬇️ Télécharger le QR seul</button>' +
    '</div><div style="height:40px;"></div></div>';

  // Generate QR
  if (window.QRCode) {
    try { new QRCode(document.getElementById('qr-box'), { text: rsvp, width:90, height:90, colorDark:'#1a0a2e', colorLight:'#ffffff', correctLevel: QRCode.CorrectLevel.H }); }
    catch(e) { document.getElementById('qr-box').textContent = 'QR'; }
  }

  // Themes
  container.querySelectorAll('.tbtn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      selTheme = parseInt(btn.dataset.ti);
      container.querySelectorAll('.tbtn').forEach(function(b){ b.style.borderColor = parseInt(b.dataset.ti)===selTheme?'rgba(255,255,255,.55)':'transparent'; });
      var bg = document.getElementById('inv-bg'); if (bg) bg.style.background = themes[selTheme];
    });
  });

  on('inv-png','click', function() {
    if (!window.html2canvas) {
      var s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
      s.onload = function() { _doExport(ev); };
      document.head.appendChild(s);
    } else { _doExport(ev); }
  });
  on('inv-link','click', function() {
    navigator.clipboard.writeText(rsvp).then(function(){ toast('Lien copié !','ok'); }).catch(function(){ toast(rsvp,'inf',6000); });
  });
  on('inv-wa','click', function() {
    var msg = val('inv-msg');
    var txt = encodeURIComponent('🎉 *' + ev.name + '*\n' + (ev.date?'📅 '+fmtDateLong(new Date(ev.date))+'\n':'') + (ev.location?'📍 '+ev.location+'\n':'') + (msg?'\n'+msg+'\n':'') + '\n➡️ RSVP : ' + rsvp);
    window.open('https://wa.me/?text=' + txt, '_blank');
  });
  on('inv-qr','click', function() {
    var canvas = document.querySelector('#qr-box canvas');
    if (!canvas) { toast('QR non disponible','err'); return; }
    var a = document.createElement('a'); a.download = 'qr-' + ev.name.replace(/\s+/g,'-') + '.png'; a.href = canvas.toDataURL(); a.click();
    toast('QR téléchargé !','ok');
  });
}
function _doExport(ev) {
  html2canvas(document.getElementById('inv-card'), { backgroundColor:null, scale:2, useCORS:true }).then(function(canvas) {
    var a = document.createElement('a'); a.download = 'invitation-' + ev.name.replace(/\s+/g,'-') + '.png'; a.href = canvas.toDataURL('image/png'); a.click();
    toast('Image téléchargée !','ok');
  }).catch(function(){ toast('Erreur export','err'); });
}

// ── CONTRIBUTIONS ─────────────────────────────────────────────
var _cUnsub = null;
var CCATS = ['🍾 Boissons','🍕 Nourriture','🧊 Glaces & desserts','🎵 Musique','🎈 Décoration','📷 Photo/Vidéo','🎲 Jeux','📦 Autre'];
function renderContributions(container) {
  var ev = activeEvent();
  if (!ev) { container.innerHTML = _noEv(); return; }
  container.innerHTML =
    '<div class="vin">' +
    '<h2 class="vtitle">Contributions</h2><p class="vsub">' + esc(ev.name) + '</p>' +
    '<div class="sgrid" style="margin-bottom:18px;">' +
      '<div class="scard"><div class="sval" style="color:var(--green);" id="c-ass">0</div><div class="slbl">Assignés ✅</div></div>' +
      '<div class="scard"><div class="sval" style="color:var(--amber);" id="c-free">0</div><div class="slbl">Libres ⚡</div></div>' +
    '</div>' +
    '<button class="btn btn-p btn-full" id="c-add" style="margin-bottom:18px;">+ Ajouter un item</button>' +
    '<div id="c-list" class="stagger"></div><div style="height:40px;"></div></div>';

  if (_cUnsub) _cUnsub();
  _cUnsub = listenSub('contributions', function(items) {
    var ass = items.filter(function(i){ return i.assignedTo; }).length;
    var qa = container.querySelector('#c-ass'), qf = container.querySelector('#c-free');
    if(qa) qa.textContent = ass; if(qf) qf.textContent = items.length - ass;
    var el = container.querySelector('#c-list');
    if (!el) return;
    if (!items.length) { el.innerHTML='<div class="empty"><div class="empty-ico">🛒</div><div class="empty-t">Aucun item</div><div class="empty-d">Ajoute ce que les invités peuvent ramener.</div></div>'; return; }
    var byCat = {};
    items.forEach(function(i){ var c=i.category||'📦 Autre'; if(!byCat[c]) byCat[c]=[]; byCat[c].push(i); });
    el.innerHTML = Object.keys(byCat).map(function(cat) {
      return '<p class="stitle">' + cat + '</p>' + byCat[cat].map(function(item) {
        return '<div class="li">' +
          '<div class="li-icon" style="background:var(--gb2);">' + (item.assignedTo?'✅':'🔲') + '</div>' +
          '<div class="li-c"><div class="li-t">' + esc(item.name) + '</div>' +
            '<div class="li-s">' + [item.quantity?'Qté: '+esc(item.quantity):null, item.assignedTo?'Par: '+esc(item.assignedTo):'Non assigné'].filter(Boolean).join(' · ') + '</div></div>' +
          '<div style="display:flex;gap:5px;">' +
            '<button class="ca-btn glass-btn" data-id="' + esc(item.id) + '" data-cur="' + esc(item.assignedTo||'') + '" style="width:auto;padding:0 10px;height:30px;font-size:11px;border-radius:var(--rnd);">' + (item.assignedTo?'Changer':'+ Assigner') + '</button>' +
            '<button class="cd-btn glass-btn" data-id="' + esc(item.id) + '" style="width:29px;height:29px;font-size:11px;color:var(--txt3);">✕</button>' +
          '</div></div>';
      }).join('');
    }).join('');
    el.querySelectorAll('.ca-btn').forEach(function(btn){ btn.addEventListener('click', function(){ _assignModal(btn.dataset.id, btn.dataset.cur); }); });
    el.querySelectorAll('.cd-btn').forEach(function(btn){ btn.addEventListener('click', function(){ if(confirm('Supprimer ?')) deleteSub('contributions', btn.dataset.id); }); });
  });
  on('c-add','click', function(){ _addContribModal(); });
}
function _addContribModal() {
  var close = showModal(
    '<h3 class="modal-title">Ajouter un item</h3>' +
    '<div class="ig"><label class="lbl">Nom *</label><input class="inp" id="ci-n" type="text" placeholder="Champagne, pizza…"/></div>' +
    '<div class="ig"><label class="lbl">Catégorie</label><select class="inp" id="ci-c">' + CCATS.map(function(c){ return '<option>'+c+'</option>'; }).join('') + '</select></div>' +
    '<div class="ig"><label class="lbl">Quantité</label><input class="inp" id="ci-q" type="text" placeholder="2 bouteilles…"/></div>' +
    '<div class="ig"><label class="lbl">Notes</label><input class="inp" id="ci-no" type="text" placeholder="Sans alcool…"/></div>' +
    '<div style="display:flex;gap:11px;"><button class="btn btn-s" id="ci-x" style="flex:1;">Annuler</button><button class="btn btn-p" id="ci-s" style="flex:2;">Ajouter</button></div>'
  );
  on('ci-x','click',close);
  on('ci-s','click',function(){
    var n=val('ci-n'); if(!n){toast('Nom requis','err');return;}
    addSub('contributions',{name:n,category:val('ci-c'),quantity:val('ci-q')||null,notes:val('ci-no')||null,assignedTo:null},function(){ toast('"'+n+'" ajouté !','ok'); close(); });
  });
}
function _assignModal(itemId, current) {
  var close = showModal(
    '<h3 class="modal-title">Assigner à un invité</h3>' +
    '<div class="ig"><label class="lbl">Nom</label><input class="inp" id="as-n" type="text" value="' + esc(current) + '"/></div>' +
    '<div style="display:flex;gap:11px;"><button class="btn btn-s" id="as-clr" style="flex:1;">Désassigner</button><button class="btn btn-p" id="as-s" style="flex:2;">Assigner</button></div>'
  );
  on('as-clr','click',function(){ updateSub('contributions',itemId,{assignedTo:null}); toast('Désassigné','inf'); close(); });
  on('as-s','click',function(){ var n=val('as-n'); if(!n){toast('Nom requis','err');return;} updateSub('contributions',itemId,{assignedTo:n}); toast('Assigné à '+n,'ok'); close(); });
}

// ── BUDGET ────────────────────────────────────────────────────
var _bUnsub = null;
var BCATS = ['🍾 Boissons','🍕 Traiteur','🎈 Décoration','🎵 Musique/DJ','🏠 Location','💡 Éclairage','📷 Photo/Vidéo','🎭 Animation','📦 Autre'];
function renderBudget(container) {
  var ev = activeEvent();
  if (!ev) { container.innerHTML = _noEv(); return; }
  container.innerHTML =
    '<div class="stagger">' +
    '<h2 class="vtitle">Budget & Stats</h2><p class="vsub">' + esc(ev.name) + '</p>' +
    '<div class="glass-card-s" style="padding:19px;margin-bottom:18px;">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">' +
        '<div><div style="font-size:10px;color:var(--txt3);text-transform:uppercase;letter-spacing:1px;margin-bottom:3px;">Budget total</div>' +
        '<div style="font-family:var(--fd);font-size:34px;font-weight:800;" id="b-tot">' + (ev.budget||0) + '€</div></div>' +
        '<button class="glass-btn" id="b-edit" style="width:auto;padding:0 13px;height:34px;font-size:12px;border-radius:var(--rnd);">Modifier</button>' +
      '</div>' +
      '<div style="margin-bottom:9px;"><div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:5px;"><span style="color:var(--txt2);">Dépensé</span><span id="b-sp" style="font-weight:600;">0€</span></div>' +
        '<div class="pbar" style="height:8px;"><div class="pfill" id="b-prog" style="width:0%;"></div></div></div>' +
      '<div style="display:flex;justify-content:space-between;font-size:13px;"><span style="color:var(--txt2);">Restant</span><span id="b-rem" style="color:var(--green);font-weight:600;">0€</span></div>' +
    '</div>' +
    '<div class="sgrid" style="margin-bottom:18px;">' +
      '<div class="scard"><div class="sval" id="b-cpp" style="color:var(--cyan);">0€</div><div class="slbl">Coût / personne</div></div>' +
      '<div class="scard"><div class="sval" id="b-nb" style="color:#c084fc;">0</div><div class="slbl">Dépenses</div></div>' +
    '</div>' +
    '<div class="glass-card" style="padding:15px;margin-bottom:18px;"><p class="stitle" style="margin-top:0;">Répartition</p><div id="b-chart"></div></div>' +
    '<button class="btn btn-p btn-full" id="b-add" style="margin-bottom:14px;">+ Ajouter une dépense</button>' +
    '<p class="stitle">Détail des dépenses</p><div id="b-list" class="stagger"></div>' +
    '<div style="height:40px;"></div></div>';

  if (_bUnsub) _bUnsub();
  _bUnsub = listenSub('expenses', function(expenses) {
    var total  = parseFloat(ev.budget)||0;
    var spent  = expenses.reduce(function(s,e){ return s+(parseFloat(e.amount)||0); },0);
    var remain = total - spent;
    var pct    = total > 0 ? Math.min(100,Math.round(spent/total*100)) : 0;
    var guests = Math.max(1, ev.confirmedCount||ev.guestCount||1);
    var q = function(id){ return container.querySelector('#'+id); };
    if(q('b-tot'))  q('b-tot').textContent  = total+'€';
    if(q('b-sp'))   q('b-sp').textContent   = spent.toFixed(2)+'€';
    if(q('b-rem'))  { q('b-rem').textContent=remain.toFixed(2)+'€'; q('b-rem').style.color=remain<0?'var(--red)':'var(--green)'; }
    if(q('b-prog')) { q('b-prog').style.width=pct+'%'; if(pct>90) q('b-prog').style.background='linear-gradient(90deg,var(--amber),var(--red))'; }
    if(q('b-cpp'))  q('b-cpp').textContent  = (spent/guests).toFixed(0)+'€';
    if(q('b-nb'))   q('b-nb').textContent   = expenses.length;
    var byCat={};
    expenses.forEach(function(e){ var c=e.category||'📦 Autre'; byCat[c]=(byCat[c]||0)+(parseFloat(e.amount)||0); });
    var chart=q('b-chart');
    if(chart){
      if(!Object.keys(byCat).length){ chart.innerHTML='<div style="color:var(--txt3);font-size:13px;text-align:center;padding:12px 0;">Aucune dépense</div>'; }
      else {
        var max=Math.max.apply(null,Object.values(byCat));
        chart.innerHTML=Object.entries(byCat).sort(function(a,b){return b[1]-a[1];}).map(function(kv){
          return '<div style="margin-bottom:8px;"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px;"><span style="color:var(--txt2);">'+kv[0]+'</span><span style="font-weight:600;">'+kv[1].toFixed(0)+'€</span></div><div class="pbar" style="height:5px;"><div class="pfill" style="width:'+((kv[1]/max)*100).toFixed(0)+'%;"></div></div></div>';
        }).join('');
      }
    }
    var list=q('b-list');
    if(!list) return;
    if(!expenses.length){ list.innerHTML='<div class="empty"><div class="empty-ico">💸</div><div class="empty-t">Aucune dépense</div></div>'; return; }
    list.innerHTML=expenses.map(function(e){
      return '<div class="li"><div class="li-icon" style="background:var(--gb2);">'+(e.category?e.category.charAt(0):'💸')+'</div><div class="li-c"><div class="li-t">'+esc(e.name)+'</div><div class="li-s">'+[e.category,e.paidBy?'Payé par '+esc(e.paidBy):null].filter(Boolean).join(' · ')+'</div></div><div style="display:flex;align-items:center;gap:8px;"><span style="font-family:var(--fd);font-size:15px;font-weight:700;color:#c084fc;">'+parseFloat(e.amount).toFixed(0)+'€</span><button class="ed-btn glass-btn" data-id="'+esc(e.id)+'" style="width:27px;height:27px;font-size:11px;color:var(--txt3);">✕</button></div></div>';
    }).join('');
    list.querySelectorAll('.ed-btn').forEach(function(btn){
      btn.addEventListener('click',function(){ if(confirm('Supprimer ?')) deleteSub('expenses',btn.dataset.id); });
    });
    updateEvent(ev.id,{spent:spent});
  });
  on('b-add','click',function(){ _addExpModal(); });
  on('b-edit','click',function(){ _editBudgetModal(ev); });
}
function _addExpModal() {
  var close=showModal(
    '<h3 class="modal-title">Ajouter une dépense</h3>'+
    '<div class="ig"><label class="lbl">Description *</label><input class="inp" id="ex-n" type="text" placeholder="Catering, sono…"/></div>'+
    '<div class="ig"><label class="lbl">Montant (€) *</label><input class="inp" id="ex-a" type="number" placeholder="0" min="0" step="0.01"/></div>'+
    '<div class="ig"><label class="lbl">Catégorie</label><select class="inp" id="ex-c">'+BCATS.map(function(c){return '<option>'+c+'</option>';}).join('')+'</select></div>'+
    '<div class="ig"><label class="lbl">Payé par</label><input class="inp" id="ex-b" type="text" placeholder="Ton nom…"/></div>'+
    '<div style="display:flex;gap:11px;"><button class="btn btn-s" id="ex-x" style="flex:1;">Annuler</button><button class="btn btn-p" id="ex-s" style="flex:2;">Ajouter</button></div>'
  );
  on('ex-x','click',close);
  on('ex-s','click',function(){
    var n=val('ex-n'),a=parseFloat(val('ex-a'));
    if(!n||isNaN(a)||a<=0){toast('Nom et montant requis','err');return;}
    addSub('expenses',{name:n,amount:a,category:val('ex-c'),paidBy:val('ex-b')||null},function(){toast(n+' — '+a+'€ ajouté !','ok');close();});
  });
}
function _editBudgetModal(ev) {
  var close=showModal(
    '<h3 class="modal-title">Budget total</h3>'+
    '<div class="ig"><label class="lbl">Montant (€)</label><input class="inp" id="bd-v" type="number" value="'+(ev.budget||0)+'" min="0" step="10"/></div>'+
    '<div style="display:flex;gap:11px;"><button class="btn btn-s" id="bd-x" style="flex:1;">Annuler</button><button class="btn btn-p" id="bd-s" style="flex:2;">Enregistrer</button></div>'
  );
  on('bd-x','click',close);
  on('bd-s','click',function(){ var v=parseFloat(val('bd-v')); updateEvent(ev.id,{budget:isNaN(v)?0:v}); toast('Budget mis à jour !','ok'); close(); });
}

// ── CHECKLIST ─────────────────────────────────────────────────
var _ckUnsub=null;
var TPL=[
  {name:"Définir la date et le lieu",cat:"📋 Planification",off:-30},
  {name:"Créer la liste d'invités",cat:"📋 Planification",off:-21},
  {name:"Envoyer les invitations",cat:"📩 Invitations",off:-14},
  {name:"Confirmer le traiteur",cat:"🍕 Nourriture",off:-10},
  {name:"Commander les boissons",cat:"🍾 Boissons",off:-7},
  {name:"Préparer la playlist",cat:"🎵 Musique",off:-5},
  {name:"Acheter la décoration",cat:"🎈 Décoration",off:-3},
  {name:"Relancer les invités sans réponse",cat:"📩 Invitations",off:-3},
  {name:"Préparer le lieu",cat:"🏠 Logistique",off:-1},
  {name:"Confirmer les contributions",cat:"🛒 Contributions",off:-1},
  {name:"Préparer la playlist de secours",cat:"🎵 Musique",off:0},
  {name:"Accueillir les invités 🎉",cat:"🎉 Jour J",off:0}
];
function renderChecklist(container) {
  var ev=activeEvent();
  if(!ev){container.innerHTML=_noEv();return;}
  container.innerHTML=
    '<div class="vin">'+
    '<h2 class="vtitle">Checklist</h2><p class="vsub">'+esc(ev.name)+'</p>'+
    '<div class="sgrid" style="margin-bottom:14px;">'+
      '<div class="scard"><div class="sval" style="color:var(--green);" id="ck-d">0</div><div class="slbl">Terminés ✅</div></div>'+
      '<div class="scard"><div class="sval" id="ck-l">0</div><div class="slbl">Restants</div></div>'+
    '</div>'+
    '<div style="margin-bottom:18px;"><div class="pbar" style="height:8px;"><div class="pfill" id="ck-p" style="width:0%;"></div></div>'+
      '<div style="font-size:11px;color:var(--txt3);margin-top:4px;text-align:right;" id="ck-pct">0% terminés</div></div>'+
    '<div style="display:flex;gap:8px;margin-bottom:18px;">'+
      '<button class="btn btn-p" id="ck-add" style="flex:2;">+ Nouvelle tâche</button>'+
      '<button class="btn btn-s" id="ck-tpl" style="flex:1;font-size:13px;">📋 Template</button>'+
    '</div>'+
    '<div id="ck-list" class="stagger"></div><div style="height:40px;"></div></div>';

  if(_ckUnsub)_ckUnsub();
  _ckUnsub=listenSub('checklist',function(items){
    var done=items.filter(function(i){return i.done;}).length;
    var left=items.length-done;
    var pct=items.length>0?Math.round(done/items.length*100):0;
    var q=function(id){return container.querySelector('#'+id);};
    if(q('ck-d'))  q('ck-d').textContent =done;
    if(q('ck-l'))  q('ck-l').textContent =left;
    if(q('ck-p'))  q('ck-p').style.width =pct+'%';
    if(q('ck-pct'))q('ck-pct').textContent=pct+'% terminés';
    var badge=document.getElementById('badgeChecklist');
    if(badge) badge.textContent=left>0?left:'';
    var byCat={};
    items.forEach(function(i){var c=i.category||'📦 Autre';if(!byCat[c])byCat[c]=[];byCat[c].push(i);});
    var el=q('ck-list');
    if(!el) return;
    if(!items.length){el.innerHTML='<div class="empty"><div class="empty-ico">✅</div><div class="empty-t">Liste vide</div><div class="empty-d">Ajoute des tâches ou charge un template.</div></div>';return;}
    el.innerHTML=Object.keys(byCat).map(function(cat){
      return '<p class="stitle">'+cat+'</p>'+byCat[cat].map(function(item){
        return '<div class="li" style="'+(item.done?'opacity:.52;':'')+'">'+
          '<button class="ck-tog" data-id="'+esc(item.id)+'" data-done="'+item.done+'" style="width:27px;height:27px;border-radius:50%;flex-shrink:0;cursor:pointer;background:'+(item.done?'rgba(16,185,129,.28)':'var(--gb)')+';border:2px solid '+(item.done?'rgba(16,185,129,.5)':'var(--gbd)')+';color:'+(item.done?'#34d399':'transparent')+';font-size:13px;display:flex;align-items:center;justify-content:center;">✓</button>'+
          '<div class="li-c"><div class="li-t" style="'+(item.done?'text-decoration:line-through;color:var(--txt3);':'')+'">'+esc(item.name)+'</div>'+
            (item.dueDate?'<div class="li-s">📅 '+esc(item.dueDate)+'</div>':'')+
            (item.notes?'<div class="li-s">'+esc(item.notes)+'</div>':'')+
          '</div>'+
          '<button class="ck-del" data-id="'+esc(item.id)+'" style="background:none;border:none;color:var(--txt3);font-size:11px;padding:4px;cursor:pointer;">✕</button>'+
        '</div>';
      }).join('');
    }).join('');
    el.querySelectorAll('.ck-tog').forEach(function(btn){
      btn.addEventListener('click',function(){updateSub('checklist',btn.dataset.id,{done:btn.dataset.done!=='true'});});
    });
    el.querySelectorAll('.ck-del').forEach(function(btn){
      btn.addEventListener('click',function(){deleteSub('checklist',btn.dataset.id);});
    });
  });
  on('ck-add','click',function(){_addTaskModal();});
  on('ck-tpl','click',function(){_tplModal(ev);});
}
function _addTaskModal(){
  var close=showModal(
    '<h3 class="modal-title">Nouvelle tâche</h3>'+
    '<div class="ig"><label class="lbl">Tâche *</label><input class="inp" id="tk-n" type="text" placeholder="Confirmer le traiteur…"/></div>'+
    '<div class="ig"><label class="lbl">Catégorie</label><input class="inp" id="tk-c" type="text" placeholder="🍕 Nourriture…"/></div>'+
    '<div class="ig"><label class="lbl">Date limite</label><input class="inp" id="tk-d" type="date"/></div>'+
    '<div class="ig"><label class="lbl">Notes</label><input class="inp" id="tk-no" type="text" placeholder="Optionnel…"/></div>'+
    '<div style="display:flex;gap:11px;"><button class="btn btn-s" id="tk-x" style="flex:1;">Annuler</button><button class="btn btn-p" id="tk-s" style="flex:2;">Ajouter</button></div>'
  );
  on('tk-x','click',close);
  on('tk-s','click',function(){
    var n=val('tk-n');if(!n){toast('Tâche requise','err');return;}
    addSub('checklist',{name:n,category:val('tk-c')||'📦 Autre',dueDate:val('tk-d')||null,notes:val('tk-no')||null,done:false},function(){toast('Tâche ajoutée !','ok');close();});
  });
}
function _tplModal(ev){
  var close=showModal(
    '<h3 class="modal-title">Charger un template</h3>'+
    '<p class="modal-sub">Ajoute '+TPL.length+' tâches pré-définies à ta checklist</p>'+
    '<div class="li" id="tpl-std" style="cursor:pointer;"><div class="li-icon">📋</div><div class="li-c"><div class="li-t">Template standard</div><div class="li-s">'+TPL.length+' tâches de J-30 à J</div></div><span style="color:var(--txt3);">›</span></div>'+
    '<button class="btn btn-s btn-full" id="tpl-x" style="margin-top:12px;">Annuler</button>'
  );
  on('tpl-x','click',close);
  on('tpl-std','click',async function(){
    var evDate=ev.date?new Date(ev.date):new Date();
    for(var i=0;i<TPL.length;i++){
      var d=new Date(evDate); d.setDate(d.getDate()+TPL[i].off);
      await subCol(APP.user.uid,APP.activeId,'checklist').add({name:TPL[i].name,category:TPL[i].cat,dueDate:d.toISOString().split('T')[0],done:false,notes:null,createdAt:firebase.firestore.FieldValue.serverTimestamp()});
    }
    toast(TPL.length+' tâches ajoutées !','ok'); close();
  });
}

// ── VIBES ─────────────────────────────────────────────────────
var VCOLS=['#7c3aed','#ec4899','#3b82f6','#10b981','#f59e0b','#ef4444','#06b6d4','#ffffff'];
function renderVibes(container){
  var ev=activeEvent();
  if(!ev){container.innerHTML=_noEv();return;}
  var v=ev.vibes||{};
  var selCols=[].concat(v.colors||[]);
  var rating=v.rating||0;

  container.innerHTML=
    '<div class="stagger">'+
    '<h2 class="vtitle">Ambiance</h2><p class="vsub">'+esc(ev.name)+'</p>'+
    '<p class="stitle">Thème & Mood</p>'+
    '<div class="glass-card" style="padding:18px;margin-bottom:18px;">'+
      '<div class="ig"><label class="lbl">Thème</label><input class="inp" id="v-th" type="text" placeholder="Jungle, années 80, casino…" value="'+esc(v.theme||'')+'"/></div>'+
      '<div class="ig"><label class="lbl">Dress code</label><input class="inp" id="v-dr" type="text" placeholder="Élégant, costumé…" value="'+esc(ev.dressCode||'')+'"/></div>'+
      '<div class="ig"><label class="lbl">Mots clés</label><input class="inp" id="v-kw" type="text" placeholder="Festif, intimiste, chill…" value="'+esc(v.keywords||'')+'"/></div>'+
      '<div class="ig" style="margin-bottom:0;"><label class="lbl">Couleurs dominantes</label>'+
        '<div style="display:flex;gap:8px;flex-wrap:wrap;" id="vcols">'+
          VCOLS.map(function(c){return '<button class="vcb" data-c="'+c+'" style="width:31px;height:31px;border-radius:50%;background:'+c+';border:3px solid '+(selCols.indexOf(c)>-1?'white':'transparent')+';cursor:pointer;transition:border .15s;flex-shrink:0;"></button>';}).join('')+
        '</div>'+
      '</div>'+
    '</div>'+
    '<p class="stitle">Musique</p>'+
    '<div class="glass-card" style="padding:18px;margin-bottom:18px;">'+
      '<div class="ig"><label class="lbl">Lien Spotify / Apple Music</label><input class="inp" id="v-pl" type="url" placeholder="https://open.spotify.com/playlist/…" value="'+esc(v.playlistUrl||'')+'"/></div>'+
      (v.playlistUrl?'<a href="'+esc(v.playlistUrl)+'" target="_blank" rel="noopener" class="btn btn-s btn-full" style="text-decoration:none;text-align:center;margin-bottom:12px;display:flex;">🎵 Ouvrir la playlist</a>':'')+
      '<div class="ig" style="margin-bottom:0;"><label class="lbl">Genres</label><input class="inp" id="v-ge" type="text" placeholder="House, Hip-hop, Funk…" value="'+esc(v.genres||'')+'"/></div>'+
    '</div>'+
    '<p class="stitle">Notes organisateur</p>'+
    '<div class="glass-card" style="padding:18px;margin-bottom:18px;">'+
      '<textarea class="inp" id="v-no" rows="4" placeholder="Notes privées, idées, prestataires…" style="resize:none;">'+esc(v.notes||'')+'</textarea>'+
    '</div>'+
    '<p class="stitle">Compte-rendu post-soirée</p>'+
    '<div class="glass-card" style="padding:18px;margin-bottom:18px;">'+
      '<div class="ig"><label class="lbl">Comment s\'est passée la soirée ?</label>'+
        '<textarea class="inp" id="v-rv" rows="3" placeholder="Points positifs, à améliorer…" style="resize:none;">'+esc(v.review||'')+'</textarea></div>'+
      '<label class="lbl">Note globale</label>'+
      '<div id="vstars" style="display:flex;gap:4px;">'+
        [1,2,3,4,5].map(function(n){return '<button class="vsb" data-v="'+n+'" style="font-size:29px;background:none;border:none;cursor:pointer;color:'+(rating>=n?'#f59e0b':'rgba(255,255,255,.15)')+';transition:color .15s;">★</button>';}).join('')+
      '</div>'+
    '</div>'+
    '<button class="btn btn-p btn-full" id="v-save">💾 Sauvegarder</button>'+
    '<div style="height:40px;"></div></div>';

  // Color picker
  container.querySelectorAll('.vcb').forEach(function(btn){
    btn.addEventListener('click',function(){
      var c=btn.dataset.c;
      var idx=selCols.indexOf(c);
      if(idx>-1){selCols.splice(idx,1);btn.style.borderColor='transparent';}
      else{selCols.push(c);btn.style.borderColor='white';}
    });
  });
  // Stars
  var setStars=function(n){container.querySelectorAll('.vsb').forEach(function(b){b.style.color=parseInt(b.dataset.v)<=n?'#f59e0b':'rgba(255,255,255,.15)';});};
  container.querySelectorAll('.vsb').forEach(function(btn){
    btn.addEventListener('click',function(){rating=parseInt(btn.dataset.v);setStars(rating);});
    btn.addEventListener('mouseenter',function(){setStars(parseInt(btn.dataset.v));});
    btn.addEventListener('mouseleave',function(){setStars(rating);});
  });
  on('v-save','click',function(){
    updateEvent(ev.id,{
      vibes:{theme:val('v-th'),keywords:val('v-kw'),colors:selCols,playlistUrl:val('v-pl'),genres:val('v-ge'),notes:val('v-no'),review:val('v-rv'),rating:rating},
      dressCode:val('v-dr')||ev.dressCode
    });
    toast('Ambiance sauvegardée ! 🎵','ok');
  });
}

// ── NO EVENT PLACEHOLDER ─────────────────────────────────────
function _noEv(){
  return '<div class="empty"><div class="empty-ico">🎉</div><div class="empty-t">Aucune soirée active</div><div class="empty-d">Crée ou sélectionne une soirée depuis le dashboard.</div></div>';
}

// ── PWA ──────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('/sw.js').catch(function(){});
  });
}
