// =============================================
//  NIGHTR - Firebase Configuration
//  ⚠️  Remplace les valeurs ci-dessous par
//     celles de TON projet Firebase
// =============================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// 👉 Colle ici ta config Firebase (Console > Paramètres du projet > Tes applis)
const firebaseConfig = {
  apiKey:            "REMPLACE_MOI",
  authDomain:        "REMPLACE_MOI.firebaseapp.com",
  projectId:         "REMPLACE_MOI",
  storageBucket:     "REMPLACE_MOI.appspot.com",
  messagingSenderId: "REMPLACE_MOI",
  appId:             "REMPLACE_MOI"
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// Expose db globalement pour app.js
window.__db = db;

// Signale que Firebase est prêt
window.dispatchEvent(new Event('firebase-ready'));
