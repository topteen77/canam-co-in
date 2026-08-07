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

async function approveUser() {
  try {
    // Get command line arguments
    const args = process.argv.slice(2);
    if (args.length < 2) {
      console.log('Usage: node approve-user.js <email> <role>');
      console.log('Roles: Admin, Account Manager, Sales, Operations');
      console.log('Example: node approve-user.js user@example.com Sales');
      process.exit(1);
    }

    const userEmail = args[0].toLowerCase();
    const role = args[1];
    const approvedBy = 'canamrakesh@gmail.com';

    // Validate role
    const validRoles = ['Admin', 'Account Manager', 'Sales', 'Operations'];
    if (!validRoles.includes(role)) {
      console.log('❌ Invalid role. Valid roles are:', validRoles.join(', '));
      process.exit(1);
    }

    console.log(`🔧 Approving user: ${userEmail} as ${role}...`);

    // Check if user exists
    const userDoc = await db.collection('Users').doc(userEmail).get();
    if (!userDoc.exists) {
      console.log('❌ User not found in Firestore');
      process.exit(1);
    }

    const currentData = userDoc.data();
    console.log('📊 Current user data:', currentData);

    // Update user status
    const updateData = {
      role,
      status: 'Active',
      approved_at: new Date().toISOString(),
      approved_by: approvedBy
    };

    await db.collection('Users').doc(userEmail).update(updateData);
    console.log('✅ User approved successfully!');

    // Show updated data
    const updatedDoc = await db.collection('Users').doc(userEmail).get();
    const updatedData = updatedDoc.data();
    
    console.log('\n🎉 User approval completed!');
    console.log('📧 Email:', updatedData.email);
    console.log('👤 Name:', updatedData.name);
    console.log('🔑 Role:', updatedData.role);
    console.log('📊 Status:', updatedData.status);
    console.log('✅ Approved At:', updatedData.approved_at);
    console.log('👨‍💼 Approved By:', updatedData.approved_by);

  } catch (error) {
    console.error('❌ User approval failed:', error);
    process.exit(1);
  }
}

approveUser();






















































