import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Firebase Admin SDK
const adminApp = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKeyId: process.env.FIREBASE_PRIVATE_KEY_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    clientId: process.env.FIREBASE_CLIENT_ID,
    authUri: process.env.FIREBASE_AUTH_URI,
    tokenUri: process.env.FIREBASE_TOKEN_URI,
  }),
  projectId: process.env.FIREBASE_PROJECT_ID,
});

const db = getFirestore(adminApp);

async function checkUsers() {
  try {
    console.log('📋 Checking all users in Firestore...\n');

    const usersSnapshot = await db.collection('Users').get();
    
    if (usersSnapshot.empty) {
      console.log('❌ No users found in Firestore');
      return;
    }

    console.log(`✅ Found ${usersSnapshot.size} users:\n`);
    console.log('='.repeat(80));

    usersSnapshot.forEach((doc, index) => {
      const userData = doc.data();
      console.log(`\n${index + 1}. 📧 Email: ${userData.email}`);
      console.log(`   👤 Name: ${userData.name}`);
      console.log(`   🔑 Role: ${userData.role}`);
      console.log(`   📊 Status: ${userData.status}`);
      console.log(`   📅 Created: ${userData.created_at}`);
      console.log(`   🔐 Password Set: ${userData.password_set ? 'Yes' : 'No'}`);
      console.log(`   📝 Signup Method: ${userData.signup_method}`);
      if (userData.approved_at) {
        console.log(`   ✅ Approved: ${userData.approved_at}`);
        console.log(`   👨‍💼 Approved By: ${userData.approved_by}`);
      }
      console.log('-'.repeat(80));
    });

    // Summary
    const users = usersSnapshot.docs.map(doc => doc.data());
    const activeUsers = users.filter(u => u.status === 'Active');
    const pendingUsers = users.filter(u => u.status === 'Pending');
    const admins = users.filter(u => u.role === 'Admin');

    console.log('\n📊 SUMMARY:');
    console.log(`   Total Users: ${users.length}`);
    console.log(`   Active Users: ${activeUsers.length}`);
    console.log(`   Pending Users: ${pendingUsers.length}`);
    console.log(`   Admin Users: ${admins.length}`);

  } catch (error) {
    console.error('❌ Error checking users:', error);
    process.exit(1);
  }
}

checkUsers();






















































