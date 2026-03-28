/**
 * firebase-config.js — Firebase SDK initialization for StayCEC
 * Uses ES module CDN imports (Firebase v11+)
 *
 * ⚠️  REPLACE the firebaseConfig values below with YOUR project's config
 *     from: Firebase Console → Project Settings → Your apps → Web app → SDK snippet
 */

import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// ──── YOUR FIREBASE CONFIG ────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyDHJ8wtLsZiS_s6PoRrBzarcVjrO-5vm9A",
  authDomain: "stay-cec.firebaseapp.com",
  projectId: "stay-cec",
  storageBucket: "stay-cec.firebasestorage.app",
  messagingSenderId: "375519420241",
  appId: "1:375519420241:web:dd4e641e8c4ce8a71efd70",
  measurementId: "G-3M75F9012K"
};
// ──────────────────────────────────────────────────────────
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage, onAuthStateChanged };
