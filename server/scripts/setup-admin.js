import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
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

const auth = getAuth(adminApp);
const db = getFirestore(adminApp);

async function setupAdmin() {
  try {
    const adminEmail = 'canamrakesh@gmail.com';
    const adminPassword = '@16Agentcrm';
    const adminName = 'Rakesh Admin';

    console.log('🔧 Setting up admin user...');

    // Check if admin already exists in Firestore
    const adminDoc = await db.collection('Users').doc(adminEmail).get();
    if (adminDoc.exists) {
      console.log('✅ Admin user already exists in Firestore');
      console.log('📊 Current admin data:', adminDoc.data());
      return;
    }

    // Create Firebase Auth user
    let firebaseUser;
    try {
      firebaseUser = await auth.createUser({
        email: adminEmail,
        password: adminPassword,
        displayName: adminName,
        emailVerified: true
      });
      console.log('✅ Firebase Auth user created:', firebaseUser.uid);
    } catch (authError) {
      if (authError.code === 'auth/email-already-exists') {
        console.log('✅ Firebase Auth user already exists');
        // Get existing user
        firebaseUser = await auth.getUserByEmail(adminEmail);
      } else {
        throw authError;
      }
    }

    // Create admin user profile in Firestore
    const userData = {
      name: adminName,
      email: adminEmail,
      role: 'Admin',
      status: 'Active',
      created_at: new Date().toISOString(),
      signup_method: 'admin_setup',
      password_set: true,
      last_login: null,
      approved_at: new Date().toISOString(),
      approved_by: 'system'
    };

    await db.collection('Users').doc(adminEmail).set(userData);
    console.log('✅ Admin user profile created in Firestore');

    console.log('\n🎉 Admin setup completed successfully!');
    console.log('📧 Email:', adminEmail);
    console.log('🔑 Password:', adminPassword);
    console.log('👤 Role: Admin');
    console.log('📊 Status: Active');

  } catch (error) {
    console.error('❌ Admin setup failed:', error);
    process.exit(1);
  }
}

setupAdmin();






















































