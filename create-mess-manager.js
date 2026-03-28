// create-mess-manager.js
// Run: node create-mess-manager.js

const admin = require('firebase-admin');

// Initialize with service account
const serviceAccount = require('./stay-cec-firebase-adminsdk-fbsvc-8f9f45b9df.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://stay-cec.firebaseio.com"
});

const db = admin.firestore();
const auth = admin.auth();

async function createMessManager() {
  const email = 'mess.manager@staycec.com';
  const password = 'MessManager2024!';
  const fullName = 'Mess Manager';
  const registerNumber = 'MM-001';
  
  try {
    // Create user in Firebase Auth
    const userRecord = await auth.createUser({
      email: email,
      password: password,
      displayName: fullName,
    });

    console.log('✅ Auth user created:', userRecord.uid);

    // Create profile in Firestore
    await db.collection('students').doc(userRecord.uid).set({
      fullName: fullName,
      registerNumber: registerNumber,
      department: 'administration',
      phone: '+91 9876543210',
      role: 'mess-manager',
      gender: 'male',
      hostel: 'Administration',
      email: email,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log('✅ Firestore profile created');
    console.log('\n📋 Mess Manager Credentials:');
    console.log('   Email:', email);
    console.log('   Password:', password);
    console.log('   UID:', userRecord.uid);
    
  } catch (error) {
    if (error.code === 'auth/email-already-exists') {
      console.log('⚠️  User already exists. Use these credentials:');
      console.log('   Email:', email);
      console.log('   Password:', password);
    } else {
      console.error('❌ Error:', error.message);
    }
  }
}

createMessManager();
