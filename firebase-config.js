/**
 * firebase-config.js — Firebase SDK initialization for StayCEC
 * Uses ES module CDN imports (Firebase v11+)
 *
 * ⚠️  REPLACE the firebaseConfig values below with YOUR project's config
 *     from: Firebase Console → Project Settings → Your apps → Web app → SDK snippet
 */

import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged } from "firebase/auth";
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db, onAuthStateChanged };
