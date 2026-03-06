# Nightr 🎉

Assistant PWA pour organiser tes soirées – installable sur iPhone.

## Fichiers

```
nightr/
├── index.html        ← App principale
├── style.css         ← Styles (dark, coloré, dynamique)
├── app.js            ← Logique complète
├── firebase-config.js← Configuration Firebase (à remplir)
├── manifest.json     ← PWA manifest
├── sw.js             ← Service Worker (cache offline)
└── README.md
```

## 🔧 Configuration Firebase

1. Va sur [console.firebase.google.com](https://console.firebase.google.com)
2. Crée un nouveau projet (ex: `nightr-app`)
3. Active **Firestore Database** (mode production ou test)
4. Va dans **Paramètres du projet → Tes applications → Web** et copie ta config
5. Colle les valeurs dans `firebase-config.js` :

```js
const firebaseConfig = {
  apiKey:            "ta-clé-api",
  authDomain:        "nightr-app.firebaseapp.com",
  projectId:         "nightr-app",
  storageBucket:     "nightr-app.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123:web:abc123"
};
```

## 🚀 Déploiement

### Option 1 – Firebase Hosting (recommandé)
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy
```

### Option 2 – Vercel / Netlify
Glisse le dossier `nightr/` dans [vercel.com](https://vercel.com) ou [netlify.com](https://netlify.com) → déploiement en 1 clic.

## 📱 Installation iPhone (PWA)

1. Ouvre l'URL dans **Safari**
2. Appuie sur le bouton **Partager** (⎙)
3. Sélectionne **"Sur l'écran d'accueil"**
4. Nightr apparaît comme une vraie app !

## 🎨 Icônes

Place deux fichiers dans le dossier :
- `icon-192.png` (192×192 px)
- `icon-512.png` (512×512 px)

Tu peux les générer sur [favicon.io](https://favicon.io) ou [maskable.app](https://maskable.app).

## ✨ Fonctionnalités

- **Multi-événements** : Soirée, Anniversaire, Crémaillère, Mariage, BBQ…
- **Invités** : Ajout, statut (en attente / confirmé / absent), compteurs
- **Courses** : Liste manuelle + génération automatique par type
- **Budget** : Jauge visuelle, suivi des dépenses
- **Checklist** : Tâches + génération automatique + barre de progression
- **Firebase** : Sync cloud temps réel
- **PWA** : Installable sur iPhone, fonctionne offline (assets mis en cache)
