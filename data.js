
/**
 * data.js — Data fetching and Firestore helpers for StayCEC
 */

import { db } from "./firebase-config.js";
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs,
  getCountFromServer,
  startAfter,
  Timestamp,
  doc,
  updateDoc
} from "firebase/firestore";

/**
 * Fetch the 3 most recent complaints for a specific student.
 */
export async function getRecentComplaints(uid) {
  try {
    const complaintsRef = collection(db, "complaints");
    const q = query(
      complaintsRef,
      where("studentId", "==", uid),
      orderBy("createdAt", "desc"),
      limit(3)
    );
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error fetching complaints:", error);
    return [];
  }
}

/**
 * Fetch upcoming meetings/announcements.
 */
export async function getUpcomingMeetings() {
  try {
    const meetingsRef = collection(db, "meetings");
    // Only fetch meetings scheduled for today or in the future
    const now = Timestamp.now();
    const q = query(
      meetingsRef,
      where("date", ">=", now),
      orderBy("date", "asc"),
      limit(2)
    );
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error fetching meetings:", error);
    return [];
  }
}

/**
 * Fetch stats for Warden Dashboard.
 */
export async function getWardenStats() {
  try {
    const studentsRef = collection(db, "students");
    const studentsSnap = await getDocs(query(studentsRef, where("role", "==", "student")));
    const totalStudents = studentsSnap.size;

    let feePendingCount = 0;
    studentsSnap.forEach((doc) => {
      const data = doc.data();
      if ((data.outstandingAmount !== undefined && data.outstandingAmount > 0) || data.feeStatus === "Pending") {
        feePendingCount++;
      }
    });

    const complaintsRef = collection(db, "complaints");
    const complaintsSnap = await getDocs(query(complaintsRef, where("status", "==", "Pending")));
    const pendingRequests = complaintsSnap.size;

    return { totalStudents, pendingRequests, feePendingCount };
  } catch (error) {
    console.error("Error fetching stats:", error);
    return { totalStudents: 0, pendingRequests: 0, feePendingCount: 0 };
  }
}

/**
 * Fetch recent complaints for all students.
 */
export async function getAllComplaints() {
  try {
    const complaintsRef = collection(db, "complaints");
    const q = query(complaintsRef, orderBy("createdAt", "desc"), limit(10));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error fetching all complaints:", error);
    return [];
  }
}

/**
 * Update complaint status by warden.
 */
export async function updateComplaintStatus(complaintId, status) {
  try {
    const docRef = doc(db, "complaints", complaintId);
    await updateDoc(docRef, { status });
  } catch (error) {
    console.error("Error updating complaint:", error);
    throw error;
  }
}

/**
 * Fetch a page of students (role === 'student') for the Resident Directory.
 * @param {number} pageSize  - rows per page
 * @param {DocumentSnapshot|null} lastVisible - cursor from previous page (null for first page)
 * @returns {{ residents: Array, lastVisible: DocumentSnapshot|null }}
 */
export async function getAllResidents(pageSize = 10, lastVisible = null) {
  try {
    const ref = collection(db, 'students');
    let constraints = [
      where('role', '==', 'student'),
      orderBy('fullName', 'asc'),
      limit(pageSize),
    ];
    if (lastVisible) constraints.push(startAfter(lastVisible));
    const q = query(ref, ...constraints);
    const snap = await getDocs(q);
    const residents = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const newLastVisible = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;
    return { residents, lastVisible: newLastVisible };
  } catch (error) {
    console.error('Error fetching residents:', error);
    return { residents: [], lastVisible: null };
  }
}

/**
 * Count all students and compute stats for the Resident Directory stat cards.
 */
export async function getResidentStats() {
  try {
    const ref = collection(db, 'students');
    const studentQuery = query(ref, where('role', '==', 'student'));
    const countSnap = await getCountFromServer(studentQuery);
    const total = countSnap.data().count;

    // Approximate splits from hostel name (men/women)
    const menQuery  = query(ref, where('role', '==', 'student'), where('hostel', '>=', "CEC Premium Men"),  where('hostel', '<=', "CEC Premium Men\uf8ff"));
    const womenQuery = query(ref, where('role', '==', 'student'), where('hostel', '>=', "CEC Premium Women"), where('hostel', '<=', "CEC Premium Women\uf8ff"));
    const [menSnap, womenSnap] = await Promise.all([getDocs(menQuery), getDocs(womenQuery)]);
    const maleCount   = menSnap.size;
    const femaleCount = womenSnap.size;

    // New admissions this academic cycle (no date field → just use last 30 days)
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const newQuery = query(ref, where('role', '==', 'student'), where('createdAt', '>=', Timestamp.fromDate(since)));
    const newSnap = await getDocs(newQuery);
    const newAdmissions = newSnap.size;

    return { total, maleCount, femaleCount, newAdmissions };
  } catch (error) {
    console.error('Error fetching resident stats:', error);
    return { total: 0, maleCount: 0, femaleCount: 0, newAdmissions: 0 };
  }
}
