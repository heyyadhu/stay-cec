/**
 * auth.js — Shared authentication helpers for StayCEC
 * Import this as an ES module in any page that needs auth functionality.
 */

import { auth, db, onAuthStateChanged } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

/**
 * Update student fees status after mock payment
 */
export async function updateStudentFees(uid) {
  const studentRef = doc(db, "students", uid);
  await updateDoc(studentRef, {
    outstandingAmount: 0,
    feeStatus: 'Paid',
    lastPaymentDate: serverTimestamp()
  });
}

/**
 * Sign up a new student.
 * Creates Firebase Auth user + saves profile to Firestore students/{uid}.
 */
export async function signUp(email, password, profileData) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const uid = cred.user.uid;

  await setDoc(doc(db, "students", uid), {
    ...profileData,
    email,
    createdAt: serverTimestamp(),
  });

  return cred.user;
}

/**
 * Sign in an existing student.
 */
export async function signIn(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

/**
 * Sign out and redirect to login page.
 */
export async function logOut() {
  await signOut(auth);
  window.location.href = "index.html";
}

/**
 * Get the current user's Firestore student profile.
 * Returns null if no user or no doc.
 */
export async function getStudentProfile(uid) {
  if (!uid) {
    const user = auth.currentUser;
    if (!user) return null;
    uid = user.uid;
  }
  if (!uid) return null;
  const snap = await getDoc(doc(db, "students", uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/**
 * Update the current user's student profile in Firestore.
 */
export async function updateStudentProfile(data) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  await setDoc(doc(db, "students", user.uid), data, { merge: true });
}

/**
 * Auth guard — redirects to login.html if no user is signed in.
 * Returns a Promise that resolves with the Firebase user object.
 * Use at the top of every protected page:
 *   const user = await requireAuth();
 */
export function requireAuth() {
  return new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      if (user) {
        resolve(user);
      } else {
        window.location.href = "index.html";
        reject(new Error("Not authenticated"));
      }
    });
  });
}

/**
 * Wait for auth to settle and return current user (or null).
 */
export function getCurrentUser() {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, (user) => resolve(user));
  });
}
