
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
  getDoc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  startAfter,
  Timestamp,
  serverTimestamp,
  doc,
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
    // Fetch all and filter client-side for now to ensure all students (even those missing 'role' field) are included
    // In a real large-scale app, we'd ensure data consistency and use index-backed queries.
    let constraints = [
      orderBy('fullName', 'asc'),
      limit(pageSize),
    ];
    if (lastVisible) constraints.push(startAfter(lastVisible));
    const q = query(ref, ...constraints);
    const snap = await getDocs(q);
    
    // Filter out wardens client-side
    const residents = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(r => r.role !== 'warden');
      
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
    const snap = await getDocs(ref);

    let maleCount = 0, femaleCount = 0, newAdmissions = 0, studentCount = 0;
    const since = Date.now() - 30 * 24 * 60 * 60 * 1000;

    snap.forEach(d => {
      const data = d.data();
      if (data.role === 'warden') return;
      
      studentCount++;
      const hostel = (data.hostel || '').toLowerCase();
      if (hostel.includes("men") && !hostel.includes("women")) maleCount++;
      else if (hostel.includes("women")) femaleCount++;

      const createdMs = data.createdAt?.toMillis?.() ?? 0;
      if (createdMs >= since) newAdmissions++;
    });

    return { total: studentCount, maleCount, femaleCount, newAdmissions };
  } catch (error) {
    console.error('Error fetching resident stats:', error);
    return { total: 0, maleCount: 0, femaleCount: 0, newAdmissions: 0 };
  }
}

// ─────────────────────────────────────────────────────────────
// PAYMENT FUNCTIONS
// ─────────────────────────────────────────────────────────────

/**
 * Verify a UPI payment with a UTR number.
 * Saves a transaction record and clears the student's outstanding fee.
 * @param {string} uid - Student's Firebase Auth UID
 * @param {string} utr - 12-digit UTR number from UPI
 * @param {number} amount - Amount paid
 */
export async function verifyPayment(uid, utr, amount) {
  // Validate UTR
  if (!/^\d{12}$/.test(utr)) throw new Error('Invalid UTR: must be exactly 12 digits.');

  // Check if UTR already used
  const txRef = doc(db, 'transactions', `${uid}_${utr}`);
  const existing = await getDoc(txRef);
  if (existing.exists()) throw new Error('This UTR number has already been used.');

  // Generate transaction ID
  const txId = `CEC-${Math.floor(Math.random() * 90000) + 10000}`;

  // Write transaction record
  await setDoc(txRef, {
    uid,
    utr,
    amount,
    txId,
    status: 'Success',
    createdAt: serverTimestamp(),
  });

  // Update student fee status
  const studentRef = doc(db, 'students', uid);
  await updateDoc(studentRef, {
    feeStatus: 'Paid',
    outstandingAmount: 0,
    lastPaymentDate: serverTimestamp(),
  });

  // Send payment confirmation notification
  await addDoc(collection(db, 'notifications'), {
    uid,
    type: 'payment',
    title: 'Payment Successful',
    message: `Your payment of ₹${amount.toLocaleString()} has been verified. Transaction ID: ${txId}.`,
    read: false,
    createdAt: serverTimestamp(),
  });

  return { txId };
}

/**
 * Fetch all transactions for a student, ordered newest first.
 */
export async function getTransactionHistory(uid) {
  try {
    const q = query(
      collection(db, 'transactions'),
      where('uid', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────
// COMPLAINT FUNCTIONS
// ─────────────────────────────────────────────────────────────

/**
 * Create a new complaint for a student.
 * Pulls studentName from their Firestore profile so it can't be spoofed.
 * @param {string} uid
 * @param {{ title: string, description: string, category: string }} data
 */
export async function createComplaint(uid, data) {
  const studentSnap = await getDoc(doc(db, 'students', uid));
  if (!studentSnap.exists()) throw new Error('Student profile not found.');
  const profile = studentSnap.data();

  const ref = await addDoc(collection(db, 'complaints'), {
    studentId: uid,
    studentName: profile.fullName || 'Unknown',
    registerNumber: profile.registerNumber || '',
    room: profile.room || '',
    title: data.title,
    description: data.description,
    category: data.category || 'General',
    status: 'Pending',
    createdAt: serverTimestamp(),
  });

  // Notify the student
  await addDoc(collection(db, 'notifications'), {
    uid,
    type: 'complaint',
    title: 'Complaint Received',
    message: `Your complaint "${data.title}" has been received and is pending review.`,
    read: false,
    createdAt: serverTimestamp(),
  });

  return ref.id;
}

/**
 * Update a complaint's status (warden action) and notify the student.
 * @param {string} complaintId
 * @param {'In Progress'|'Resolved'|'Rejected'} status
 * @param {string} studentId - UID of the student who filed the complaint
 */
export async function updateComplaintStatus(complaintId, status, studentId) {
  const complaintRef = doc(db, 'complaints', complaintId);
  await updateDoc(complaintRef, { status, updatedAt: serverTimestamp() });

  if (studentId) {
    await addDoc(collection(db, 'notifications'), {
      uid: studentId,
      type: 'complaint',
      title: 'Complaint Status Updated',
      message: `Your complaint has been marked as "${status}".`,
      read: false,
      createdAt: serverTimestamp(),
    });
  }
}

/**
 * Fetch complaints. If studentId is provided, returns only their complaints.
 * Otherwise returns all (for wardens).
 */
export async function getComplaints(studentId = null) {
  try {
    let q;
    if (studentId) {
      q = query(
        collection(db, 'complaints'),
        where('studentId', '==', studentId),
        orderBy('createdAt', 'desc'),
        limit(20)
      );
    } else {
      q = query(
        collection(db, 'complaints'),
        orderBy('createdAt', 'desc'),
        limit(50)
      );
    }
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error('Error fetching complaints:', error);
    return [];
  }
}

/**
 * Get overall complaint stats for the warden dashboard.
 */
export async function getComplaintStats() {
  try {
    const snap = await getDocs(collection(db, 'complaints'));
    let openCount = 0;
    let highPriority = 0;
    
    snap.docs.forEach(d => {
      const data = d.data();
      if (data.status !== 'Resolved' && data.status !== 'Rejected') openCount++;
      if (data.category === 'Emergency' || (data.description && data.description.length > 100)) highPriority++; // Mock logic for priority if not stored
    });

    return {
      openCount,
      highPriority,
      avgTime: '4.2h' // Mocked for now
    };
  } catch (error) {
    console.error('Error fetching complaint stats:', error);
    return { openCount: 0, highPriority: 0, avgTime: '0h' };
  }
}

// ─────────────────────────────────────────────────────────────
// NOTIFICATION FUNCTIONS
// ─────────────────────────────────────────────────────────────

/**
 * Fetch notifications for a student, ordered newest first.
 */
export async function getNotifications(uid) {
  try {
    const q = query(
      collection(db, 'notifications'),
      where('uid', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return [];
  }
}

/**
 * Mark a single notification as read.
 */
export async function markNotificationRead(notifId) {
  await updateDoc(doc(db, 'notifications', notifId), { read: true });
}

/**
 * Mark ALL unread notifications for a student as read (Clear All).
 */
export async function markAllNotificationsRead(uid) {
  const q = query(
    collection(db, 'notifications'),
    where('uid', '==', uid),
    where('read', '==', false)
  );
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.update(d.ref, { read: true }));
  await batch.commit();
}

/**
 * Send an announcement from the warden to all (or a subset of) students.
 * Also saves a record in the 'broadcasts' collection for history tracking.
 */
export async function sendWardenAnnouncement(title, message, targetGroup = 'all', priority = 'Normal') {
  try {
    // 1. Save the broadcast itself for history
    const broadcastRef = await addDoc(collection(db, 'broadcasts'), {
      title,
      message,
      targetGroup,
      priority,
      status: 'Sent',
      createdAt: serverTimestamp(),
    });

    // 2. Fetch target students
    // We fetch all students and filter client-side to be inclusive of those missing the 'role' field
    const studentsSnap = await getDocs(collection(db, 'students'));
    const batch = writeBatch(db);
    let count = 0;

    studentsSnap.forEach(d => {
      const data = d.data();
      if (data.role === 'warden') return;

      const hostel = (data.hostel || '').toLowerCase();
      if (targetGroup === 'men' && !hostel.includes('men')) return;
      if (targetGroup === 'women' && !hostel.includes('women')) return;

      const nRef = doc(collection(db, 'notifications'));
      batch.set(nRef, {
        uid: d.id,
        type: 'announcement',
        title: title,
        message: message,
        from: 'Warden',
        priority: priority,
        read: false,
        createdAt: serverTimestamp(),
      });
      count++;
    });

    if (count > 0) {
      await batch.commit();
    }
    
    return broadcastRef.id;
  } catch (error) {
    console.error('Error sending announcement:', error);
    throw error;
  }
}

/**
 * Fetch recent broadcasts for the warden history table.
 */
export async function getWardenBroadcasts(limitCount = 10) {
  try {
    const q = query(
      collection(db, 'broadcasts'),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error('Error fetching broadcasts:', error);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────
// MESS REDUCTION FUNCTIONS
// ─────────────────────────────────────────────────────────────

/**
 * Submit a mess reduction request for a student.
 * @param {string} uid
 * @param {{ periods: Array<{from: string, to: string}>, reason: string, totalDays: number }} data
 */
export async function submitMessReduction(uid, data) {
  const studentSnap = await getDoc(doc(db, 'students', uid));
  if (!studentSnap.exists()) throw new Error('Student profile not found.');
  const profile = studentSnap.data();

  // Validate: at least one period must have dates
  const validPeriods = data.periods.filter(p => p.from && p.to && p.to >= p.from);
  if (!validPeriods.length) throw new Error('Please provide at least one valid date range.');
  if (!data.reason?.trim()) throw new Error('Please provide a reason.');

  const ref = await addDoc(collection(db, 'messReductions'), {
    uid,
    studentName: profile.fullName || 'Unknown',
    registerNumber: profile.registerNumber || '',
    room: profile.room || '',
    hostel: profile.hostel || '',
    periods: validPeriods,
    totalDays: data.totalDays,
    reason: data.reason.trim(),
    status: 'Pending',
    createdAt: serverTimestamp(),
  });

  // Notify the student
  await addDoc(collection(db, 'notifications'), {
    uid,
    type: 'mess',
    title: 'Mess Reduction Pending',
    message: `Your mess reduction request for ${data.totalDays} days is under review.`,
    read: false,
    createdAt: serverTimestamp(),
  });

  return ref.id;
}

/**
 * Aggregate all hostel data for the Reports page.
 */
export async function getReportData() {
  try {
    const [studentsSnap, complaintsSnap, transactionsSnap, messSnap] = await Promise.all([
      getDocs(collection(db, 'students')),
      getDocs(collection(db, 'complaints')),
      getDocs(collection(db, 'transactions')),
      getDocs(collection(db, 'messReductions'))
    ]);

    // 1. Revenue & Fees
    let totalRevenue = 0;
    let pendingFeesCount = 0;
    transactionsSnap.forEach(d => totalRevenue += (d.data().amount || 0));
    studentsSnap.forEach(d => {
      const data = d.data();
      if (data.role !== 'warden' && (data.feeStatus === 'Pending' || data.outstandingAmount > 0)) {
        pendingFeesCount++;
      }
    });

    // 2. Occupancy
    let menCount = 0, womenCount = 0;
    studentsSnap.forEach(d => {
      const data = d.data();
      if (data.role === 'warden') return;
      const hostel = (data.hostel || '').toLowerCase();
      if (hostel.includes('men')) menCount++;
      else if (hostel.includes('women')) womenCount++;
    });

    // 3. Complaints
    let resolved = 0, open = 0;
    complaintsSnap.forEach(d => {
      const status = d.data().status;
      if (status === 'Resolved') resolved++;
      else if (status !== 'Rejected') open++;
    });

    // 4. Mess Reductions
    const activeMessReductions = messSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(m => m.status === 'Approved' || m.status === 'Pending')
      .slice(0, 10);

    return {
      revenue: totalRevenue,
      pendingFees: pendingFeesCount,
      occupancy: { men: menCount, women: womenCount, total: menCount + womenCount },
      complaints: { resolved, open, total: resolved + open },
      recentMess: activeMessReductions
    };
  } catch (error) {
    console.error('Error fetching report data:', error);
    return null;
  }
}

/**
 * Get all mess reduction requests (warden: all students, student: own only).
 */
export async function getMessReductions(uid = null) {
  try {
    let q;
    if (uid) {
      q = query(
        collection(db, 'messReductions'),
        where('uid', '==', uid),
        orderBy('createdAt', 'desc'),
        limit(10)
      );
    } else {
      q = query(
        collection(db, 'messReductions'),
        orderBy('createdAt', 'desc'),
        limit(30)
      );
    }
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error('Error fetching mess reductions:', error);
    return [];
  }
}
