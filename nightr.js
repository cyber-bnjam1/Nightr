/* ============================================================
   NIGHTR — nightr.js  (vanilla JS, aucun module ES)
   ============================================================ */

// ── CONFIG FIREBASE ──────────────────────────────────────────
var FIREBASE_CONFIG = {
  apiKey:            "AIzaSyCR3A1Rfd08MdnSAVKcMFZh1mApCnt_dL0",
  authDomain:        "nightr-48fd7.firebaseapp.com",
  projectId:         "nightr-48fd7",
  storageBucket:     "nightr-48fd7.firebasestorage.app",
  messagingSenderId: "781987170518",
  appId:             "1:781987170518:web:5b49f4958b0ac313e1a177"
};

// ── STATE ────────────────────────────────────────────────────
var APP = {
  user:     null,
  events:   [],
  activeId: localStorage.getItem('nightr_ev') || null,
  view:     'dashboard',
  evUnsub:  null,   // listener soirées
  subUnsub: null    // listener sous-collection active
};

function activeEvent() {
  return APP.events.find(function(e){ return e.id === APP.activeId; }) || null;
}

// ── FIREBASE INIT ─────────────────────────────────────────────
var db, auth;
firebase.initializeApp(FIREBASE_CONFIG);
db   = firebase.firestore();
auth = firebase.auth();

// ── DOM READY ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  setupMenu();
  setupNav();

  // Retour après redirection Google (mobile)
  auth.getRedirectResult()
    .then(function(result) {
      if (result && result.user) {
        toast('Connecté avec Google ! Bienvenue ' + (result.user.displayName || '') + ' 🎉', 'ok', 4000);
      }
    })
    .catch(function(e) {
      if (e.code === 'auth/credential-already-in-use' && e.credential) {
        auth.signInWithCredential(e.credential).catch(function(){});
      }
    });

  // Connexion auto anonyme si pas de session
  auth.onAuthStateChanged(function(user) {
    if (user) {
      APP.user = user;
      updateUserUI(user);
      startEventsListener();
    } else {
      auth.signInAnonymously().catch(function(e) {
        toast('Erreur auth: ' + e.message, 'err');
      });
    }
  });
});

// ── FIRESTORE HELPERS ─────────────────────────────────────────
function eventsCol()          { return db.collection('users').doc(APP.user.uid).collection('events'); }
function eventDoc(eid)        { return eventsCol().doc(eid); }
function subCol(eid, sub)     { return eventDoc(eid).collection(sub); }
function activeSubCol(sub)    { return subCol(APP.activeId, sub); }

// Écoute les soirées — met à jour APP.events sans re-render de la vue
function startEventsListener() {
  if (APP.evUnsub) APP.evUnsub();
  APP.evUnsub = eventsCol()
    .orderBy('createdAt', 'desc')
    .onSnapshot(function(snap) {
      APP.events = snap.docs.map(function(d) {
        return Object.assign({ id: d.id }, d.data());
      });
      // Corrige activeId si besoin
      if (APP.activeId && !APP.events.find(function(e){ return e.id === APP.activeId; })) {
        APP.activeId = APP.events.length ? APP.events[0].id : null;
      } else if (!APP.activeId && APP.events.length) {
        APP.activeId = APP.events[0].id;
      }
      localStorage.setItem('nightr_ev', APP.activeId || '');
      // Met à jour l'UI sans recréer toute la vue
      refreshEventsUI();
    }, function(e) {
      toast('Erreur lecture données: ' + e.message, 'err');
    });
}

// Met à jour uniquement les éléments statiques (nom soirée active, badges)
function refreshEventsUI() {
  var ev = activeEvent();
  var el = document.getElementById('activeEventName');
  if (el) el.textContent = ev ? ev.name : 'Aucune soirée';
  // Si la vue actuelle est le dashboard, la recharger (liste des soirées)
  if (APP.view === 'dashboard') {
    var container = document.getElementById('view');
    if (container) renderDashboard(container);
  }
}

// CRUD soirées
function createEvent(data, cb) {
  eventsCol()
    .add(Object.assign({}, data, { createdAt: firebase.firestore.FieldValue.serverTimestamp() }))
    .then(function(ref) { if (cb) cb(ref); })
    .catch(function(e) { toast('Erreur création: ' + e.message, 'err'); });
}
function updateEvent(eid, data) {
  eventDoc(eid)
    .set(Object.assign({}, data, { updatedAt: firebase.firestore.FieldValue.serverTimestamp() }), { merge: true })
    .catch(function(e) { console.warn('updateEvent:', e.message); });
}
function deleteEventFull(eid) {
  eventDoc(eid).delete()
    .then(function() {
      if (APP.activeId === eid) {
        APP.activeId = APP.events.find(function(e){ return e.id !== eid; }) ? null : null;
        localStorage.setItem('nightr_ev', '');
      }
    })
    .catch(function(e) { toast('Erreur suppression: ' + e.message, 'err'); });
}

// CRUD sous-collections
function addItem(sub, data, cb) {
  if (!APP.activeId) { toast('Aucune soirée active', 'err'); return; }
  activeSubCol(sub)
    .add(Object.assign({}, data, { createdAt: firebase.firestore.FieldValue.serverTimestamp() }))
    .then(function(ref) { if (cb) cb(ref); })
    .catch(function(e) { toast('Erreur: ' + e.message, 'err'); });
}
function updateItem(sub, id, data) {
  if (!APP.activeId) return;
  activeSubCol(sub).doc(id)
    .set(Object.assign({}, data, { updatedAt: firebase.firestore.FieldValue.serverTimestamp() }), { merge: true })
    .catch(function(e) { console.warn('updateItem:', e.message); });
}
function deleteItem(sub, id) {
  if (!APP.activeId) return;
  activeSubCol(sub).doc(id).delete()
    .catch(function(e) { toast('Erreur: ' + e.message, 'err'); });
}
function listenItems(sub, cb) {
  if (!APP.activeId) { cb([]); return function(){}; }
  return activeSubCol(sub)
    .orderBy('createdAt', 'asc')
    .onSnapshot(function(snap) {
      cb(snap.docs.map(function(d){ return Object.assign({ id: d.id }, d.data()); }));
    }, function(e) {
      console.warn('listenItems', sub, e.message);
    });
}

// ── MENU ──────────────────────────────────────────────────────
function setupMenu() {
  document.getElementById('burgerBtn').addEventListener('click', openMenu);
  document.getElementById('closeMenuBtn').addEventListener('click', closeMenu);
  document.getElementById('menuOverlay').addEventListener('click', closeMenu);
  document.getElementById('addBtn').addEventListener('click', showNewEventModal);
  document.getElementById('eventChip').addEventListener('click', function() { closeMenu(); showSwitcherModal(); });
  var panel = document.getElementById('menuPanel');
  var sx = 0;
  panel.addEventListener('touchstart', function(e){ sx = e.touches[0].clientX; }, { passive: true });
  panel.addEventListener('touchend', function(e){ if (sx - e.changedTouches[0].clientX > 55) closeMenu(); }, { passive: true });
}
function openMenu()  {
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
    btn.addEventListener('click', function() { navTo(btn.dataset.view); });
  });
}
function navTo(view) {
  APP.view = view;
  closeMenu();
  // Arrête le listener de sous-collection précédent
  if (APP.subUnsub) { APP.subUnsub(); APP.subUnsub = null; }
  document.querySelectorAll('.nav-btn[data-view]').forEach(function(b) {
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

// ── AUTH ───────────────────────────────────────────────────────
function _isMobile() { return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent); }

function showLoginModal() {
  var close = showModal(
    '<h3 class="modal-title">🌙 Connexion Google</h3>' +
    '<p class="modal-sub">Synchronise tes soirées sur tous tes appareils.</p>' +
    '<button class="btn btn-p btn-full" id="lg-g" style="gap:10px;">' +
      '<svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>' +
      ' Continuer avec Google' +
    '</button>' +
    '<div style="height:8px;"></div>' +
    '<button class="btn btn-s btn-full" id="lg-x">Pas maintenant</button>'
  );
  document.getElementById('lg-g').addEventListener('click', function() {
    var provider = new firebase.auth.GoogleAuthProvider();
    var cur = auth.currentUser;
    if (_isMobile()) {
      if (cur && cur.isAnonymous) cur.linkWithRedirect(provider);
      else auth.signInWithRedirect(provider);
    } else {
      var p = (cur && cur.isAnonymous) ? cur.linkWithPopup(provider) : auth.signInWithPopup(provider);
      p.then(function(r) { toast('Connecté ! Bienvenue ' + (r.user.displayName||'') + ' 🎉', 'ok'); close(); })
       .catch(function(e) {
         if (e.code === 'auth/credential-already-in-use' && e.credential) {
           auth.signInWithCredential(e.credential).then(function(r){ toast('Connecté !','ok'); close(); });
         } else if (e.code !== 'auth/popup-closed-by-user') {
           toast('Erreur: ' + e.message, 'err');
         }
       });
    }
  });
  document.getElementById('lg-x').addEventListener('click', close);
}

function updateUserUI(user) {
  var av = document.getElementById('userAv');
  var nm = document.getElementById('userName');
  var em = document.getElementById('userEmail');
  if (!user) { av.textContent='?'; nm.textContent='Non connecté'; em.textContent='—'; return; }
  if (user.isAnonymous) {
    av.textContent='👤'; nm.textContent='Mode invité'; em.textContent='Appuie pour te connecter';
    var chip = document.getElementById('userChip');
    if (chip) { chip.style.cursor='pointer'; chip.onclick = showLoginModal; }
    return;
  }
  var n = user.displayName || 'Utilisateur';
  av.textContent = n.charAt(0).toUpperCase();
  nm.textContent = n;
  em.textContent = user.email || '';
  var chip = document.getElementById('userChip');
  if (chip) { chip.style.cursor = 'default'; chip.onclick = null; }
}

// ── TOAST ──────────────────────────────────────────────────────
function toast(msg, type, dur) {
  type = type||'inf'; dur = dur||3000;
  var icons = { ok:'✓', err:'✕', inf:'●' };
  var cls   = { ok:'ti-ok', err:'ti-err', inf:'ti-inf' };
  var c = document.getElementById('toasts');
  var t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = '<span class="'+(cls[type]||'ti-inf')+'">'+(icons[type]||'●')+'</span><span>'+esc(msg)+'</span>';
  c.appendChild(t);
  setTimeout(function(){
    t.classList.add('out');
    t.addEventListener('animationend', function(){ t.remove(); }, { once:true });
  }, dur);
}

// ── MODAL ──────────────────────────────────────────────────────
function showModal(html) {
  var bg   = document.getElementById('modalBg');
  var wrap = document.getElementById('modalWrap');
  wrap.innerHTML = '<div class="modal-sheet"><div class="modal-handle"></div>' + html + '</div>';
  bg.classList.add('on');
  wrap.classList.add('on');
  function close() {
    bg.classList.remove('on');
    wrap.classList.remove('on');
    setTimeout(function(){ wrap.innerHTML = ''; }, 420);
  }
  bg.onclick = function(e) { if (e.target === bg) close(); };
  return close;
}

// ── HELPERS ───────────────────────────────────────────────────
function esc(s) { return s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') : ''; }
function val(id) { var el=document.getElementById(id); return el?el.value.trim():''; }
function fmtDate(d) { return d.toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}); }
function fmtDateLong(d) { return d.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'}); }
function countdown(d,now) {
  var ms=d-now; if(ms<=0) return null;
  var days=Math.floor(ms/86400000); if(days>0) return days+'j';
  var h=Math.floor(ms/3600000); if(h>0) return h+'h';
  return Math.floor(ms/60000)+'min';
}
function greeting() {
  var h=new Date().getHours();
  return h<12?'Bonne matinée ☀️':h<18?'Bonne après-midi 🌤️':h<21?'Bonne soirée 🌆':'Bonne nuit 🌙';
}
function setActiveEvent(id) {
  APP.activeId = id;
  localStorage.setItem('nightr_ev', id||'');
  var el = document.getElementById('activeEventName');
  if (el) el.textContent = activeEvent() ? activeEvent().name : 'Aucune soirée';
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
    evHtml =
      '<div class="hero">' +
        '<div class="hero-bg" style="background:linear-gradient(135deg,rgba(124,58,237,.5),rgba(236,72,153,.4),rgba(6,182,212,.25));"></div>' +
        '<div class="hero-ov"></div>' +
        '<div class="hero-c">' +
          (isPast ? '<span class="pill pill-p" style="margin-bottom:10px;">✓ Passée</span>' :
           cd     ? '<span class="pill pill-g" style="margin-bottom:10px;">● Dans '+cd+'</span>' : '') +
          '<h3 style="font-family:var(--fd);font-size:23px;font-weight:800;margin-bottom:6px;">' + esc(ev.name) + '</h3>' +
          '<p style="font-size:13px;opacity:.75;margin-bottom:12px;">' +
            (date ? fmtDate(date) : 'Date à définir') + (ev.location ? ' · '+esc(ev.location) : '') +
          '</p>' +
          '<div style="display:flex;gap:14px;flex-wrap:wrap;font-size:13px;opacity:.9;">' +
            (ev.guestCount > 0 ? '<span>👥 '+(ev.confirmedCount||0)+'/'+ev.guestCount+' confirmés</span>' : '') +
            (ev.budget ? '<span>💰 '+ev.budget+'€</span>' : '') +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="sgrid">' +
        _qaBtn('qa-g','👥','Invités',(ev.confirmedCount||0)+' confirmés') +
        _qaBtn('qa-i','📩','Invitations','Créer & partager') +
        _qaBtn('qa-b','💰','Budget',ev.budget?ev.budget+'€':'À définir') +
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

  var evList = APP.events.length
    ? APP.events.map(function(e) {
        var isAct = e.id === APP.activeId;
        var d = e.date ? new Date(e.date) : null;
        return '<div class="li ev-item" data-eid="'+esc(e.id)+'" style="cursor:pointer;'+(isAct?'border-color:rgba(168,85,247,.4);background:rgba(124,58,237,.1);':'')+'">' +
          '<div class="li-icon" style="background:'+(isAct?'rgba(124,58,237,.25)':'var(--gb2)')+';">'+(e.emoji||'🎉')+'</div>' +
          '<div class="li-c"><div class="li-t">'+esc(e.name)+'</div><div class="li-s">'+(d?fmtDate(d):'Date non définie')+(e.location?' · '+esc(e.location):'')+'</div></div>' +
          '<div style="display:flex;align-items:center;gap:6px;">' +
            (isAct?'<span style="color:#c084fc;font-size:17px;">✦</span>':'') +
            '<button class="ev-del" data-eid="'+esc(e.id)+'" style="background:var(--gb);border:1px solid var(--gbd);border-radius:8px;color:var(--txt3);width:28px;height:28px;cursor:pointer;font-size:11px;">✕</button>' +
          '</div></div>';
      }).join('')
    : '<div class="empty"><div class="empty-d">Aucune soirée pour l\'instant</div></div>';

  container.innerHTML =
    '<div class="stagger">' +
      '<h2 class="vtitle">'+greeting()+'</h2>' +
      '<p class="vsub">'+new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})+'</p>' +
      evHtml +
      (APP.events.length ? '<div class="sgrid"><div class="scard"><div class="sval" style="color:#c084fc;">'+APP.events.length+'</div><div class="slbl">Soirées</div></div><div class="scard"><div class="sval" style="color:var(--green);">'+APP.events.filter(function(e){return e.date&&new Date(e.date)>now;}).length+'</div><div class="slbl">À venir</div></div></div>' : '') +
      '<p class="stitle">Mes soirées</p>' + evList +
      '<div style="height:80px;"></div>' +
    '</div>';

  // FAB
  var fab = document.createElement('button');
  fab.className = 'fab';
  fab.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
  fab.addEventListener('click', showNewEventModal);
  container.appendChild(fab);

  var hc = document.getElementById('heroCreate');
  if (hc) hc.addEventListener('click', showNewEventModal);
  var qg = document.getElementById('qa-g'); if(qg) qg.addEventListener('click',function(){navTo('guests');});
  var qi = document.getElementById('qa-i'); if(qi) qi.addEventListener('click',function(){navTo('invitations');});
  var qb = document.getElementById('qa-b'); if(qb) qb.addEventListener('click',function(){navTo('budget');});
  var qc = document.getElementById('qa-c'); if(qc) qc.addEventListener('click',function(){navTo('checklist');});

  container.querySelectorAll('.ev-item').forEach(function(el) {
    el.addEventListener('click', function(e) {
      if (e.target.closest('.ev-del')) return;
      setActiveEvent(el.dataset.eid);
      renderDashboard(container);
      toast('"'+(activeEvent()||{name:''}).name+'" activée','ok');
    });
  });
  container.querySelectorAll('.ev-del').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      if (!confirm('Supprimer cette soirée ?')) return;
      deleteEventFull(btn.dataset.eid);
      toast('Soirée supprimée','inf');
    });
  });
}

function _qaBtn(id,ico,title,sub) {
  return '<button class="glass-card" id="'+id+'" style="padding:15px;text-align:left;border:none;cursor:pointer;width:100%;border-radius:var(--r2);">'+
    '<div style="font-size:21px;margin-bottom:5px;">'+ico+'</div>'+
    '<div style="font-size:13px;font-weight:600;color:var(--txt);">'+title+'</div>'+
    '<div style="font-size:11px;color:var(--txt2);">'+sub+'</div></button>';
}

// Modal nouvelle soirée
function showNewEventModal() {
  var emojis = ['🎉','🎂','🍾','🕺','🎸','🌙','🔥','🎭','🌊','🎪'];
  var selEmoji = '🎉';
  var saving = false;

  var close = showModal(
    '<h3 class="modal-title">Nouvelle soirée ✦</h3>' +
    '<div class="ig"><label class="lbl">Emoji</label><div style="display:flex;gap:7px;flex-wrap:wrap;" id="epicker">' +
      emojis.map(function(e){
        return '<button class="ep glass-btn" data-e="'+e+'" style="font-size:19px;width:40px;height:40px;'+(e===selEmoji?'background:rgba(124,58,237,.3);border-color:rgba(168,85,247,.5);':'')+'">'+e+'</button>';
      }).join('') +
    '</div></div>' +
    '<div class="ig"><label class="lbl">Nom *</label><input class="inp" id="ne-name" type="text" placeholder="Soirée anniversaire…" autocomplete="off"/></div>' +
    '<div class="ig"><label class="lbl">Date & heure</label><input class="inp" id="ne-date" type="datetime-local"/></div>' +
    '<div class="ig"><label class="lbl">Lieu</label><input class="inp" id="ne-loc" type="text" placeholder="Adresse…"/></div>' +
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
        b.style.background  = b.dataset.e===selEmoji ? 'rgba(124,58,237,.3)' : '';
        b.style.borderColor = b.dataset.e===selEmoji ? 'rgba(168,85,247,.5)' : '';
      });
    });
  });

  document.getElementById('ne-cancel').addEventListener('click', close);
  document.getElementById('ne-save').addEventListener('click', function() {
    if (saving) return;
    var name = val('ne-name');
    if (!name) { toast('Le nom est requis','err'); return; }
    saving = true;
    var btn = document.getElementById('ne-save');
    if (btn) { btn.disabled=true; btn.textContent='Création…'; btn.style.opacity='.6'; }
    createEvent({
      emoji: selEmoji, name: name,
      date:      val('ne-date')   || null,
      location:  val('ne-loc')    || null,
      budget:    parseFloat(val('ne-budget')) || 0,
      dressCode: val('ne-dress')  || null,
      guestCount: 0, confirmedCount: 0, spent: 0
    }, function(ref) {
      setActiveEvent(ref.id);
      close();
      toast('"'+name+'" créée ! 🎉','ok');
    });
  });
}

// Modal switcher de soirée
function showSwitcherModal() {
  var rows = APP.events.length
    ? APP.events.map(function(e) {
        var isAct = e.id === APP.activeId;
        return '<div class="li sw-row" data-sid="'+esc(e.id)+'" style="cursor:pointer;'+(isAct?'border-color:rgba(168,85,247,.4);':'')+'">' +
          '<div class="li-icon">'+(e.emoji||'🎉')+'</div>' +
          '<div class="li-c"><div class="li-t">'+esc(e.name)+'</div><div class="li-s">'+(e.date?fmtDate(new Date(e.date)):'Date non définie')+'</div></div>' +
          (isAct?'<span style="color:#c084fc;">✦</span>':'') +
        '</div>';
      }).join('')
    : '<div class="empty"><div class="empty-d">Aucune soirée</div></div>';

  var close = showModal(
    '<h3 class="modal-title">Changer de soirée</h3>' +
    '<p class="modal-sub">'+APP.events.length+' soirée(s)</p>' +
    rows +
    '<button class="btn btn-p btn-full" id="sw-new" style="margin-top:14px;">+ Nouvelle soirée</button>'
  );
  document.querySelectorAll('.sw-row').forEach(function(el) {
    el.addEventListener('click', function() {
      setActiveEvent(el.dataset.sid);
      close();
      navTo(APP.view);
    });
  });
  var swn = document.getElementById('sw-new');
  if (swn) swn.addEventListener('click', function(){ close(); setTimeout(showNewEventModal, 430); });
}

// ── GUESTS ────────────────────────────────────────────────────
function renderGuests(container) {
  var ev = activeEvent();
  if (!ev) { container.innerHTML = _noEv(); return; }

  container.innerHTML =
    '<div class="vin">' +
    '<h2 class="vtitle">Invités & RSVP</h2><p class="vsub">'+esc(ev.name)+'</p>' +
    '<div class="sgrid">' +
      '<div class="scard"><div class="sval" style="color:var(--green);" id="gs-ok">0</div><div class="slbl">Confirmés ✅</div></div>' +
      '<div class="scard"><div class="sval" style="color:var(--amber);" id="gs-wait">0</div><div class="slbl">En attente ⏳</div></div>' +
      '<div class="scard"><div class="sval" style="color:var(--red);" id="gs-no">0</div><div class="slbl">Déclinés ❌</div></div>' +
      '<div class="scard"><div class="sval" id="gs-tot">0</div><div class="slbl">Total</div></div>' +
    '</div>' +
    '<div style="margin-bottom:16px;"><div class="pbar" style="height:7px;"><div class="pfill" id="gs-prog" style="width:0%;"></div></div>' +
      '<div style="font-size:11px;color:var(--txt3);margin-top:4px;text-align:right;" id="gs-pct">0% de réponses</div></div>' +
    '<button class="btn btn-p btn-full" id="ga-add" style="margin-bottom:14px;">+ Ajouter un invité</button>' +
    '<div style="display:flex;gap:5px;margin-bottom:14px;">' +
      ['all','confirmed','pending','declined'].map(function(f,i){
        return '<button class="gfilt" data-f="'+f+'" style="flex:1;padding:8px 2px;border-radius:var(--rnd);font-size:11px;font-weight:600;cursor:pointer;border:1px solid '+(i===0?'rgba(168,85,247,.3)':'var(--gbd)')+';background:'+(i===0?'rgba(124,58,237,.25)':'var(--gb)')+';color:'+(i===0?'#c084fc':'var(--txt2)')+';">'+['Tous','✅','⏳','❌'][i]+'</button>';
      }).join('') +
    '</div>' +
    '<div id="g-list"></div>' +
    '<div style="height:40px;"></div></div>';

  var filter = 'all';

  container.querySelectorAll('.gfilt').forEach(function(btn) {
    btn.addEventListener('click', function() {
      filter = btn.dataset.f;
      container.querySelectorAll('.gfilt').forEach(function(b) {
        b.style.background  = b.dataset.f===filter?'rgba(124,58,237,.25)':'var(--gb)';
        b.style.borderColor = b.dataset.f===filter?'rgba(168,85,247,.3)':'var(--gbd)';
        b.style.color       = b.dataset.f===filter?'#c084fc':'var(--txt2)';
      });
    });
  });

  document.getElementById('ga-add').addEventListener('click', function(){ _addGuestModal(); });

  APP.subUnsub = listenItems('guests', function(guests) {
    // Stats
    var conf = guests.filter(function(g){return g.status==='confirmed';}).length;
    var wait = guests.filter(function(g){return g.status==='pending';}).length;
    var no   = guests.filter(function(g){return g.status==='declined';}).length;
    var tot  = guests.length;
    var pct  = tot>0 ? Math.round((conf+no)/tot*100) : 0;
    var q = function(id){ return container.querySelector('#'+id); };
    if(q('gs-ok'))   q('gs-ok').textContent   = conf;
    if(q('gs-wait')) q('gs-wait').textContent  = wait;
    if(q('gs-no'))   q('gs-no').textContent    = no;
    if(q('gs-tot'))  q('gs-tot').textContent   = tot;
    if(q('gs-prog')) q('gs-prog').style.width  = pct+'%';
    if(q('gs-pct'))  q('gs-pct').textContent   = pct+'% de réponses';
    var badge = document.getElementById('badgeGuests');
    if (badge) badge.textContent = wait>0?wait:'';
    // Sync stats sur l'event
    updateEvent(ev.id, { guestCount: tot, confirmedCount: conf });
    // Liste
    var data = filter==='all' ? guests : guests.filter(function(g){return g.status===filter;});
    var el = container.querySelector('#g-list');
    if (!el) return;
    if (!data.length) {
      el.innerHTML = '<div class="empty"><div class="empty-ico">👥</div><div class="empty-t">Aucun invité</div><div class="empty-d">'+(filter==='all'?'Ajoute tes premiers invités !':'Aucun dans cette catégorie')+'</div></div>';
      return;
    }
    var newHtml = data.map(function(g) {
      var bg = g.status==='confirmed'?'rgba(16,185,129,.22)':g.status==='declined'?'rgba(239,68,68,.18)':'var(--gb2)';
      return '<div class="li" data-gid="'+esc(g.id)+'">' +
        '<div class="li-icon" style="border-radius:50%;background:'+bg+';font-size:15px;font-weight:700;">'+esc((g.name||'?').charAt(0).toUpperCase())+'</div>' +
        '<div class="li-c"><div class="li-t">'+esc(g.name)+'</div>' +
          '<div class="li-s">'+[g.phone,g.group,g.plus?'+1':null].filter(Boolean).map(esc).join(' · ')+'</div></div>' +
        '<div style="display:flex;align-items:center;gap:3px;">' +
          ['confirmed','pending','declined'].map(function(s){
            var icons={confirmed:'✅',pending:'⏳',declined:'❌'};
            var bgs={confirmed:'rgba(16,185,129,.25)',pending:'rgba(245,158,11,.2)',declined:'rgba(239,68,68,.2)'};
            var bds={confirmed:'rgba(16,185,129,.4)',pending:'rgba(245,158,11,.3)',declined:'rgba(239,68,68,.3)'};
            var act=g.status===s;
            return '<button class="rb glass-btn" data-gid="'+esc(g.id)+'" data-s="'+s+'" style="width:30px;height:30px;font-size:12px;background:'+(act?bgs[s]:'transparent')+';border-color:'+(act?bds[s]:'var(--gbd)')+';">'+icons[s]+'</button>';
          }).join('') +
          '<button class="gdel glass-btn" data-gid="'+esc(g.id)+'" style="width:27px;height:27px;font-size:11px;color:var(--txt3);margin-left:2px;">✕</button>' +
        '</div></div>';
    }).join('');
    if (el.innerHTML !== newHtml) {
      var main=document.getElementById('main'), sy=main?main.scrollTop:0;
      el.innerHTML = newHtml;
      if(main) main.scrollTop=sy;
    }
    el.querySelectorAll('.rb').forEach(function(btn){
      btn.addEventListener('click', function(){ updateItem('guests', btn.dataset.gid, {status:btn.dataset.s}); });
    });
    el.querySelectorAll('.gdel').forEach(function(btn){
      btn.addEventListener('click', function(){ if(confirm('Supprimer ?')) deleteItem('guests', btn.dataset.gid); });
    });
  });
}

function _addGuestModal() {
  var saving = false;
  var close = showModal(
    '<h3 class="modal-title">Ajouter un invité</h3>' +
    '<div class="ig"><label class="lbl">Nom *</label><input class="inp" id="gn" type="text" placeholder="Marie Dupont" autocomplete="off"/></div>' +
    '<div class="ig"><label class="lbl">Téléphone</label><input class="inp" id="gp" type="tel" placeholder="+33 6 12 34 56 78"/></div>' +
    '<div class="ig"><label class="lbl">Email</label><input class="inp" id="ge" type="email" placeholder="marie@exemple.fr"/></div>' +
    '<div class="ig"><label class="lbl">Groupe</label><select class="inp" id="gg"><option value="">Aucun</option><option>Famille</option><option>Amis</option><option>Collègues</option><option>Autres</option></select></div>' +
    '<div style="display:flex;align-items:center;gap:12px;margin-bottom:15px;"><label style="font-size:14px;color:var(--txt2);flex:1;">Accompagné(e) (+1)</label><input type="checkbox" id="gplus" style="width:20px;height:20px;accent-color:var(--purple);"/></div>' +
    '<div style="display:flex;gap:11px;"><button class="btn btn-s" id="gc" style="flex:1;">Annuler</button><button class="btn btn-p" id="gs" style="flex:2;">Ajouter</button></div>'
  );
  document.getElementById('gc').addEventListener('click', close);
  document.getElementById('gs').addEventListener('click', function() {
    if (saving) return;
    var name = val('gn');
    if (!name) { toast('Nom requis','err'); return; }
    saving = true;
    var btn = document.getElementById('gs');
    if(btn){btn.disabled=true;btn.textContent='Ajout…';btn.style.opacity='.6';}
    addItem('guests', {
      name: name, phone: val('gp')||null, email: val('ge')||null,
      group: val('gg')||null, plus: document.getElementById('gplus').checked, status:'pending'
    }, function() { toast(name+' ajouté(e) !','ok'); close(); });
  });
}

// ── INVITATIONS ───────────────────────────────────────────────
function renderInvitations(container) {
  var ev = activeEvent();
  if (!ev) { container.innerHTML = _noEv(); return; }
  var rsvp = location.origin + '/?event=' + ev.id;
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
    '<h2 class="vtitle">Invitations & QR</h2><p class="vsub">'+esc(ev.name)+'</p>' +
    '<p class="stitle">Aperçu</p>' +
    '<div id="inv-card" style="position:relative;overflow:hidden;border-radius:var(--r3);padding:26px 22px;margin-bottom:18px;border:1px solid rgba(255,255,255,.14);min-height:260px;">' +
      '<div id="inv-bg" style="position:absolute;inset:0;z-index:0;background:'+themes[0]+';"></div>' +
      '<div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.42),transparent);z-index:0;"></div>' +
      '<div style="position:relative;z-index:1;">' +
        '<div style="font-size:42px;margin-bottom:10px;">'+(ev.emoji||'🎉')+'</div>' +
        '<p style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:rgba(255,255,255,.5);margin-bottom:3px;">Tu es invité(e) à</p>' +
        '<h3 style="font-family:var(--fd);font-size:24px;font-weight:800;margin-bottom:10px;">'+esc(ev.name)+'</h3>' +
        '<div style="display:flex;flex-direction:column;gap:5px;margin-bottom:16px;">' +
          (ev.date?'<div style="font-size:13px;opacity:.85;">📅 '+fmtDateLong(new Date(ev.date))+'</div>':'') +
          (ev.location?'<div style="font-size:13px;opacity:.85;">📍 '+esc(ev.location)+'</div>':'') +
          (ev.dressCode?'<div style="font-size:13px;opacity:.85;">👗 '+esc(ev.dressCode)+'</div>':'') +
        '</div>' +
        '<div id="qr-box" style="background:#fff;border-radius:10px;padding:8px;display:inline-block;"></div>' +
      '</div>' +
    '</div>' +
    '<p class="stitle">Thème</p>' +
    '<div style="display:flex;gap:10px;margin-bottom:20px;overflow-x:auto;padding-bottom:2px;">' +
      themes.map(function(t,i){return '<button class="tbtn" data-ti="'+i+'" style="width:50px;height:50px;border-radius:12px;background:'+t+';flex-shrink:0;cursor:pointer;border:2px solid '+(i===0?'rgba(255,255,255,.55)':'transparent')+';"></button>';}).join('') +
    '</div>' +
    '<div class="ig"><label class="lbl">Message personnalisé</label><textarea class="inp" id="inv-msg" rows="3" placeholder="Viens fêter ça avec nous ! 🥂" style="resize:none;">'+esc(ev.customMessage||'')+'</textarea></div>' +
    '<div style="display:flex;flex-direction:column;gap:10px;">' +
      '<button class="btn btn-p btn-full" id="inv-png">⬇️ Télécharger en PNG</button>' +
      '<button class="btn btn-s btn-full" id="inv-link">🔗 Copier le lien</button>' +
      '<button class="btn btn-s btn-full" id="inv-wa">💬 Partager sur WhatsApp</button>' +
      '<button class="btn btn-s btn-full" id="inv-save">💾 Sauvegarder le message</button>' +
    '</div><div style="height:40px;"></div></div>';

  if (window.QRCode) {
    try { new QRCode(document.getElementById('qr-box'), {text:rsvp,width:90,height:90,colorDark:'#1a0a2e',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.H}); }
    catch(e) {}
  }
  container.querySelectorAll('.tbtn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      selTheme = parseInt(btn.dataset.ti);
      container.querySelectorAll('.tbtn').forEach(function(b){ b.style.borderColor=parseInt(b.dataset.ti)===selTheme?'rgba(255,255,255,.55)':'transparent'; });
      var bg=document.getElementById('inv-bg'); if(bg) bg.style.background=themes[selTheme];
    });
  });
  document.getElementById('inv-link').addEventListener('click', function() {
    navigator.clipboard.writeText(rsvp).then(function(){ toast('Lien copié !','ok'); }).catch(function(){ toast(rsvp,'inf',7000); });
  });
  document.getElementById('inv-wa').addEventListener('click', function() {
    var msg=val('inv-msg');
    var txt=encodeURIComponent('🎉 *'+ev.name+'*\n'+(ev.date?'📅 '+fmtDateLong(new Date(ev.date))+'\n':'')+(ev.location?'📍 '+ev.location+'\n':'')+(msg?'\n'+msg+'\n':'')+'\n➡️ '+rsvp);
    window.open('https://wa.me/?text='+txt,'_blank');
  });
  document.getElementById('inv-save').addEventListener('click', function() {
    updateEvent(ev.id, { customMessage: val('inv-msg') });
    toast('Message sauvegardé !','ok');
  });
  document.getElementById('inv-png').addEventListener('click', function() {
    if (!window.html2canvas) {
      var s=document.createElement('script'); s.src='https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
      s.onload=function(){ _doExport(ev); }; document.head.appendChild(s);
    } else { _doExport(ev); }
  });
}
function _doExport(ev) {
  html2canvas(document.getElementById('inv-card'),{backgroundColor:null,scale:2,useCORS:true}).then(function(canvas){
    var a=document.createElement('a'); a.download='invitation-'+ev.name.replace(/\s+/g,'-')+'.png'; a.href=canvas.toDataURL('image/png'); a.click();
    toast('Image téléchargée !','ok');
  }).catch(function(){ toast('Erreur export','err'); });
}

// ── CONTRIBUTIONS ─────────────────────────────────────────────
var CCATS = ['🍾 Boissons','🍕 Nourriture','🧊 Glaces & desserts','🎵 Musique','🎈 Décoration','📷 Photo/Vidéo','🎲 Jeux','📦 Autre'];
function renderContributions(container) {
  var ev = activeEvent();
  if (!ev) { container.innerHTML = _noEv(); return; }
  container.innerHTML =
    '<div class="vin">' +
    '<h2 class="vtitle">Contributions</h2><p class="vsub">'+esc(ev.name)+'</p>' +
    '<div class="sgrid" style="margin-bottom:18px;">' +
      '<div class="scard"><div class="sval" style="color:var(--green);" id="c-ass">0</div><div class="slbl">Assignés ✅</div></div>' +
      '<div class="scard"><div class="sval" style="color:var(--amber);" id="c-free">0</div><div class="slbl">Libres ⚡</div></div>' +
    '</div>' +
    '<button class="btn btn-p btn-full" id="c-add" style="margin-bottom:18px;">+ Ajouter un item</button>' +
    '<div id="c-list"></div><div style="height:40px;"></div></div>';

  document.getElementById('c-add').addEventListener('click', _addContribModal);

  APP.subUnsub = listenItems('contributions', function(items) {
    var ass=items.filter(function(i){return i.assignedTo;}).length;
    var qa=container.querySelector('#c-ass'),qf=container.querySelector('#c-free');
    if(qa) qa.textContent=ass; if(qf) qf.textContent=items.length-ass;
    var el=container.querySelector('#c-list');
    if(!el) return;
    if(!items.length){el.innerHTML='<div class="empty"><div class="empty-ico">🛒</div><div class="empty-t">Aucun item</div><div class="empty-d">Ajoute ce que les invités peuvent ramener.</div></div>';return;}
    var byCat={};
    items.forEach(function(i){var c=i.category||'📦 Autre';if(!byCat[c])byCat[c]=[];byCat[c].push(i);});
    el.innerHTML=Object.keys(byCat).map(function(cat){
      return '<p class="stitle">'+cat+'</p>'+byCat[cat].map(function(item){
        return '<div class="li">' +
          '<div class="li-icon" style="background:var(--gb2);">'+(item.assignedTo?'✅':'🔲')+'</div>' +
          '<div class="li-c"><div class="li-t">'+esc(item.name)+'</div>' +
            '<div class="li-s">'+[item.quantity?'Qté: '+esc(item.quantity):null,item.assignedTo?'Par: '+esc(item.assignedTo):'Non assigné'].filter(Boolean).join(' · ')+'</div></div>' +
          '<div style="display:flex;gap:5px;">' +
            '<button class="ca-btn glass-btn" data-id="'+esc(item.id)+'" data-cur="'+esc(item.assignedTo||'')+'" style="width:auto;padding:0 10px;height:30px;font-size:11px;border-radius:var(--rnd);">'+(item.assignedTo?'Changer':'+ Assigner')+'</button>' +
            '<button class="cd-btn glass-btn" data-id="'+esc(item.id)+'" style="width:29px;height:29px;font-size:11px;color:var(--txt3);">✕</button>' +
          '</div></div>';
      }).join('');
    }).join('');
    el.querySelectorAll('.ca-btn').forEach(function(btn){btn.addEventListener('click',function(){_assignModal(btn.dataset.id,btn.dataset.cur);});});
    el.querySelectorAll('.cd-btn').forEach(function(btn){btn.addEventListener('click',function(){if(confirm('Supprimer ?')) deleteItem('contributions',btn.dataset.id);});});
  });
}
function _addContribModal() {
  var saving=false;
  var close=showModal(
    '<h3 class="modal-title">Ajouter un item</h3>'+
    '<div class="ig"><label class="lbl">Nom *</label><input class="inp" id="ci-n" type="text" placeholder="Champagne, pizza…" autocomplete="off"/></div>'+
    '<div class="ig"><label class="lbl">Catégorie</label><select class="inp" id="ci-c">'+CCATS.map(function(c){return '<option>'+c+'</option>';}).join('')+'</select></div>'+
    '<div class="ig"><label class="lbl">Quantité</label><input class="inp" id="ci-q" type="text" placeholder="2 bouteilles…"/></div>'+
    '<div style="display:flex;gap:11px;"><button class="btn btn-s" id="ci-x" style="flex:1;">Annuler</button><button class="btn btn-p" id="ci-s" style="flex:2;">Ajouter</button></div>'
  );
  document.getElementById('ci-x').addEventListener('click',close);
  document.getElementById('ci-s').addEventListener('click',function(){
    if(saving)return; var n=val('ci-n'); if(!n){toast('Nom requis','err');return;}
    saving=true; var btn=document.getElementById('ci-s'); if(btn){btn.disabled=true;btn.textContent='Ajout…';btn.style.opacity='.6';}
    addItem('contributions',{name:n,category:val('ci-c'),quantity:val('ci-q')||null,assignedTo:null},function(){toast('"'+n+'" ajouté !','ok');close();});
  });
}
function _assignModal(itemId,current) {
  var close=showModal(
    '<h3 class="modal-title">Assigner à un invité</h3>'+
    '<div class="ig"><label class="lbl">Nom</label><input class="inp" id="as-n" type="text" value="'+esc(current)+'" autocomplete="off"/></div>'+
    '<div style="display:flex;gap:11px;"><button class="btn btn-s" id="as-clr" style="flex:1;">Désassigner</button><button class="btn btn-p" id="as-s" style="flex:2;">Assigner</button></div>'
  );
  document.getElementById('as-clr').addEventListener('click',function(){updateItem('contributions',itemId,{assignedTo:null});toast('Désassigné','inf');close();});
  document.getElementById('as-s').addEventListener('click',function(){var n=val('as-n');if(!n){toast('Nom requis','err');return;}updateItem('contributions',itemId,{assignedTo:n});toast('Assigné à '+n,'ok');close();});
}

// ── BUDGET ────────────────────────────────────────────────────
var BCATS=['🍾 Boissons','🍕 Traiteur','🎈 Décoration','🎵 Musique/DJ','🏠 Location','💡 Éclairage','📷 Photo/Vidéo','🎭 Animation','📦 Autre'];
function renderBudget(container) {
  var ev=activeEvent();
  if(!ev){container.innerHTML=_noEv();return;}
  container.innerHTML=
    '<div class="stagger">' +
    '<h2 class="vtitle">Budget & Stats</h2><p class="vsub">'+esc(ev.name)+'</p>' +
    '<div class="glass-card-s" style="padding:19px;margin-bottom:18px;">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">' +
        '<div><div style="font-size:10px;color:var(--txt3);text-transform:uppercase;letter-spacing:1px;margin-bottom:3px;">Budget total</div>' +
        '<div style="font-family:var(--fd);font-size:34px;font-weight:800;" id="b-tot">'+(ev.budget||0)+'€</div></div>' +
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
    '<p class="stitle">Détail</p><div id="b-list"></div>' +
    '<div style="height:40px;"></div></div>';

  document.getElementById('b-add').addEventListener('click',_addExpModal);
  document.getElementById('b-edit').addEventListener('click',function(){_editBudgetModal(ev);});

  APP.subUnsub=listenItems('expenses',function(expenses){
    var total=parseFloat(ev.budget)||0;
    var spent=expenses.reduce(function(s,e){return s+(parseFloat(e.amount)||0);},0);
    var remain=total-spent;
    var pct=total>0?Math.min(100,Math.round(spent/total*100)):0;
    var guests=Math.max(1,ev.confirmedCount||ev.guestCount||1);
    var q=function(id){return container.querySelector('#'+id);};
    if(q('b-tot'))  q('b-tot').textContent=total+'€';
    if(q('b-sp'))   q('b-sp').textContent=spent.toFixed(2)+'€';
    if(q('b-rem'))  {q('b-rem').textContent=remain.toFixed(2)+'€';q('b-rem').style.color=remain<0?'var(--red)':'var(--green)';}
    if(q('b-prog')) {q('b-prog').style.width=pct+'%';if(pct>90)q('b-prog').style.background='linear-gradient(90deg,var(--amber),var(--red))';}
    if(q('b-cpp'))  q('b-cpp').textContent=(spent/guests).toFixed(0)+'€';
    if(q('b-nb'))   q('b-nb').textContent=expenses.length;
    var byCat={};
    expenses.forEach(function(e){var c=e.category||'📦 Autre';byCat[c]=(byCat[c]||0)+(parseFloat(e.amount)||0);});
    var chart=q('b-chart');
    if(chart){
      if(!Object.keys(byCat).length){chart.innerHTML='<div style="color:var(--txt3);font-size:13px;text-align:center;padding:12px 0;">Aucune dépense</div>';}
      else{var max=Math.max.apply(null,Object.values(byCat));chart.innerHTML=Object.entries(byCat).sort(function(a,b){return b[1]-a[1];}).map(function(kv){return '<div style="margin-bottom:8px;"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px;"><span style="color:var(--txt2);">'+kv[0]+'</span><span style="font-weight:600;">'+kv[1].toFixed(0)+'€</span></div><div class="pbar" style="height:5px;"><div class="pfill" style="width:'+((kv[1]/max)*100).toFixed(0)+'%;"></div></div></div>';}).join('');}
    }
    var list=q('b-list');
    if(!list) return;
    if(!expenses.length){list.innerHTML='<div class="empty"><div class="empty-ico">💸</div><div class="empty-t">Aucune dépense</div></div>';return;}
    list.innerHTML=expenses.map(function(e){
      return '<div class="li"><div class="li-icon" style="background:var(--gb2);">'+(e.category?e.category.charAt(0):'💸')+'</div><div class="li-c"><div class="li-t">'+esc(e.name)+'</div><div class="li-s">'+[e.category,e.paidBy?'Payé par '+esc(e.paidBy):null].filter(Boolean).join(' · ')+'</div></div><div style="display:flex;align-items:center;gap:8px;"><span style="font-family:var(--fd);font-size:15px;font-weight:700;color:#c084fc;">'+parseFloat(e.amount).toFixed(0)+'€</span><button class="ed-btn glass-btn" data-id="'+esc(e.id)+'" style="width:27px;height:27px;font-size:11px;color:var(--txt3);">✕</button></div></div>';
    }).join('');
    list.querySelectorAll('.ed-btn').forEach(function(btn){btn.addEventListener('click',function(){if(confirm('Supprimer ?'))deleteItem('expenses',btn.dataset.id);});});
    updateEvent(ev.id,{spent:spent});
  });
}
function _addExpModal(){
  var saving=false;
  var close=showModal(
    '<h3 class="modal-title">Ajouter une dépense</h3>'+
    '<div class="ig"><label class="lbl">Description *</label><input class="inp" id="ex-n" type="text" placeholder="Catering, sono…" autocomplete="off"/></div>'+
    '<div class="ig"><label class="lbl">Montant (€) *</label><input class="inp" id="ex-a" type="number" placeholder="0" min="0" step="0.01"/></div>'+
    '<div class="ig"><label class="lbl">Catégorie</label><select class="inp" id="ex-c">'+BCATS.map(function(c){return '<option>'+c+'</option>';}).join('')+'</select></div>'+
    '<div class="ig"><label class="lbl">Payé par</label><input class="inp" id="ex-b" type="text" placeholder="Ton nom…" autocomplete="off"/></div>'+
    '<div style="display:flex;gap:11px;"><button class="btn btn-s" id="ex-x" style="flex:1;">Annuler</button><button class="btn btn-p" id="ex-s" style="flex:2;">Ajouter</button></div>'
  );
  document.getElementById('ex-x').addEventListener('click',close);
  document.getElementById('ex-s').addEventListener('click',function(){
    if(saving)return; var n=val('ex-n'),a=parseFloat(val('ex-a'));
    if(!n||isNaN(a)||a<=0){toast('Nom et montant requis','err');return;}
    saving=true; var btn=document.getElementById('ex-s'); if(btn){btn.disabled=true;btn.textContent='Ajout…';btn.style.opacity='.6';}
    addItem('expenses',{name:n,amount:a,category:val('ex-c'),paidBy:val('ex-b')||null},function(){toast(n+' — '+a+'€ ajouté !','ok');close();});
  });
}
function _editBudgetModal(ev){
  var close=showModal(
    '<h3 class="modal-title">Budget total</h3>'+
    '<div class="ig"><label class="lbl">Montant (€)</label><input class="inp" id="bd-v" type="number" value="'+(ev.budget||0)+'" min="0" step="10"/></div>'+
    '<div style="display:flex;gap:11px;"><button class="btn btn-s" id="bd-x" style="flex:1;">Annuler</button><button class="btn btn-p" id="bd-s" style="flex:2;">Enregistrer</button></div>'
  );
  document.getElementById('bd-x').addEventListener('click',close);
  document.getElementById('bd-s').addEventListener('click',function(){
    var v=parseFloat(val('bd-v'));
    updateEvent(ev.id,{budget:isNaN(v)?0:v});
    toast('Budget mis à jour !','ok'); close();
  });
}

// ── CHECKLIST ─────────────────────────────────────────────────
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
function renderChecklist(container){
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
    '<div id="ck-list"></div><div style="height:40px;"></div></div>';

  document.getElementById('ck-add').addEventListener('click',_addTaskModal);
  document.getElementById('ck-tpl').addEventListener('click',function(){_tplModal(ev);});

  APP.subUnsub=listenItems('checklist',function(items){
    var done=items.filter(function(i){return i.done;}).length;
    var left=items.length-done;
    var pct=items.length>0?Math.round(done/items.length*100):0;
    var q=function(id){return container.querySelector('#'+id);};
    if(q('ck-d'))  q('ck-d').textContent=done;
    if(q('ck-l'))  q('ck-l').textContent=left;
    if(q('ck-p'))  q('ck-p').style.width=pct+'%';
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
          '</div>'+
          '<button class="ck-del" data-id="'+esc(item.id)+'" style="background:none;border:none;color:var(--txt3);font-size:11px;padding:4px;cursor:pointer;">✕</button>'+
        '</div>';
      }).join('');
    }).join('');
    el.querySelectorAll('.ck-tog').forEach(function(btn){
      btn.addEventListener('click',function(){updateItem('checklist',btn.dataset.id,{done:btn.dataset.done!=='true'});});
    });
    el.querySelectorAll('.ck-del').forEach(function(btn){
      btn.addEventListener('click',function(){deleteItem('checklist',btn.dataset.id);});
    });
  });
}
function _addTaskModal(){
  var saving=false;
  var close=showModal(
    '<h3 class="modal-title">Nouvelle tâche</h3>'+
    '<div class="ig"><label class="lbl">Tâche *</label><input class="inp" id="tk-n" type="text" placeholder="Confirmer le traiteur…" autocomplete="off"/></div>'+
    '<div class="ig"><label class="lbl">Catégorie</label><input class="inp" id="tk-c" type="text" placeholder="🍕 Nourriture…"/></div>'+
    '<div class="ig"><label class="lbl">Date limite</label><input class="inp" id="tk-d" type="date"/></div>'+
    '<div class="ig"><label class="lbl">Notes</label><input class="inp" id="tk-no" type="text" placeholder="Optionnel…"/></div>'+
    '<div style="display:flex;gap:11px;"><button class="btn btn-s" id="tk-x" style="flex:1;">Annuler</button><button class="btn btn-p" id="tk-s" style="flex:2;">Ajouter</button></div>'
  );
  document.getElementById('tk-x').addEventListener('click',close);
  document.getElementById('tk-s').addEventListener('click',function(){
    if(saving)return; var n=val('tk-n'); if(!n){toast('Tâche requise','err');return;}
    saving=true; var btn=document.getElementById('tk-s'); if(btn){btn.disabled=true;btn.textContent='Ajout…';btn.style.opacity='.6';}
    addItem('checklist',{name:n,category:val('tk-c')||'📦 Autre',dueDate:val('tk-d')||null,notes:val('tk-no')||null,done:false},function(){toast('Tâche ajoutée !','ok');close();});
  });
}
function _tplModal(ev){
  var loading=false;
  var close=showModal(
    '<h3 class="modal-title">Charger un template</h3>'+
    '<p class="modal-sub">Ajoute '+TPL.length+' tâches pré-définies à ta checklist</p>'+
    '<div class="li" id="tpl-std" style="cursor:pointer;"><div class="li-icon">📋</div><div class="li-c"><div class="li-t">Template standard</div><div class="li-s">'+TPL.length+' tâches de J-30 à J</div></div><span style="color:var(--txt3);">›</span></div>'+
    '<button class="btn btn-s btn-full" id="tpl-x" style="margin-top:12px;">Annuler</button>'
  );
  document.getElementById('tpl-x').addEventListener('click',close);
  document.getElementById('tpl-std').addEventListener('click',function(){
    if(loading)return; loading=true;
    var evDate=ev.date?new Date(ev.date):new Date();
    var batch=db.batch();
    TPL.forEach(function(t){
      var d=new Date(evDate); d.setDate(d.getDate()+t.off);
      var ref=activeSubCol('checklist').doc();
      batch.set(ref,{name:t.name,category:t.cat,dueDate:d.toISOString().split('T')[0],done:false,notes:null,createdAt:firebase.firestore.FieldValue.serverTimestamp()});
    });
    batch.commit().then(function(){toast(TPL.length+' tâches ajoutées !','ok');close();}).catch(function(e){toast('Erreur: '+e.message,'err');loading=false;});
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
      '<div class="ig"><label class="lbl">Thème</label><input class="inp" id="v-th" type="text" placeholder="Jungle, années 80…" value="'+esc(v.theme||'')+'"/></div>'+
      '<div class="ig"><label class="lbl">Dress code</label><input class="inp" id="v-dr" type="text" placeholder="Élégant, costumé…" value="'+esc(ev.dressCode||'')+'"/></div>'+
      '<div class="ig"><label class="lbl">Mots clés</label><input class="inp" id="v-kw" type="text" placeholder="Festif, intimiste…" value="'+esc(v.keywords||'')+'"/></div>'+
      '<div class="ig" style="margin-bottom:0;"><label class="lbl">Couleurs</label>'+
        '<div style="display:flex;gap:8px;flex-wrap:wrap;" id="vcols">'+
          VCOLS.map(function(c){return '<button class="vcb" data-c="'+c+'" style="width:31px;height:31px;border-radius:50%;background:'+c+';border:3px solid '+(selCols.indexOf(c)>-1?'white':'transparent')+';cursor:pointer;flex-shrink:0;"></button>';}).join('')+
        '</div>'+
      '</div>'+
    '</div>'+
    '<p class="stitle">Musique</p>'+
    '<div class="glass-card" style="padding:18px;margin-bottom:18px;">'+
      '<div class="ig"><label class="lbl">Lien Spotify / Apple Music</label><input class="inp" id="v-pl" type="url" placeholder="https://open.spotify.com/playlist/…" value="'+esc(v.playlistUrl||'')+'"/></div>'+
      (v.playlistUrl?'<a href="'+esc(v.playlistUrl)+'" target="_blank" rel="noopener" class="btn btn-s btn-full" style="text-decoration:none;text-align:center;margin-bottom:12px;display:flex;">🎵 Ouvrir la playlist</a>':'')+
      '<div class="ig" style="margin-bottom:0;"><label class="lbl">Genres</label><input class="inp" id="v-ge" type="text" placeholder="House, Hip-hop…" value="'+esc(v.genres||'')+'"/></div>'+
    '</div>'+
    '<p class="stitle">Notes</p>'+
    '<div class="glass-card" style="padding:18px;margin-bottom:18px;">'+
      '<textarea class="inp" id="v-no" rows="4" placeholder="Notes privées, idées, prestataires…" style="resize:none;">'+esc(v.notes||'')+'</textarea>'+
    '</div>'+
    '<p class="stitle">Compte-rendu</p>'+
    '<div class="glass-card" style="padding:18px;margin-bottom:18px;">'+
      '<div class="ig"><label class="lbl">Comment ça s\'est passé ?</label>'+
        '<textarea class="inp" id="v-rv" rows="3" placeholder="Points positifs, à améliorer…" style="resize:none;">'+esc(v.review||'')+'</textarea></div>'+
      '<label class="lbl">Note</label>'+
      '<div id="vstars" style="display:flex;gap:4px;">'+
        [1,2,3,4,5].map(function(n){return '<button class="vsb" data-v="'+n+'" style="font-size:29px;background:none;border:none;cursor:pointer;color:'+(rating>=n?'#f59e0b':'rgba(255,255,255,.15)')+';transition:color .15s;">★</button>';}).join('')+
      '</div>'+
    '</div>'+
    '<button class="btn btn-p btn-full" id="v-save">💾 Sauvegarder</button>'+
    '<div style="height:40px;"></div></div>';

  container.querySelectorAll('.vcb').forEach(function(btn){
    btn.addEventListener('click',function(){
      var c=btn.dataset.c,idx=selCols.indexOf(c);
      if(idx>-1){selCols.splice(idx,1);btn.style.borderColor='transparent';}
      else{selCols.push(c);btn.style.borderColor='white';}
    });
  });
  var setStars=function(n){container.querySelectorAll('.vsb').forEach(function(b){b.style.color=parseInt(b.dataset.v)<=n?'#f59e0b':'rgba(255,255,255,.15)';});};
  container.querySelectorAll('.vsb').forEach(function(btn){
    btn.addEventListener('click',function(){rating=parseInt(btn.dataset.v);setStars(rating);});
    btn.addEventListener('mouseenter',function(){setStars(parseInt(btn.dataset.v));});
    btn.addEventListener('mouseleave',function(){setStars(rating);});
  });
  document.getElementById('v-save').addEventListener('click',function(){
    updateEvent(ev.id,{
      vibes:{theme:val('v-th'),keywords:val('v-kw'),colors:selCols,playlistUrl:val('v-pl'),genres:val('v-ge'),notes:val('v-no'),review:val('v-rv'),rating:rating},
      dressCode:val('v-dr')||null
    });
    toast('Ambiance sauvegardée ! 🎵','ok');
  });
}

// ── UTILS ─────────────────────────────────────────────────────
function _noEv(){
  return '<div class="empty"><div class="empty-ico">🎉</div><div class="empty-t">Aucune soirée active</div><div class="empty-d">Crée ou sélectionne une soirée depuis le dashboard.</div></div>';
}

// ── PWA ───────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('/sw.js').catch(function(){});
  });
}
