// Script to assign all mock leads to real users
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

// Mock data with real user assignments
const mockLeads = [
  {
    id: '1',
    agencyName: 'Global Education Consultants',
    status: 'New',
    agentCategory: 'Gold',
    tags: ['High Potential', 'Mumbai'],
    accountManager: 'Alka',
    salesPerson: 'Akash',
    contacts: [{
      id: 'c1',
      name: 'Rohan Sharma',
      role: 'Director',
      phone: '919876543210',
      email: 'rohan.s@gec.com',
      city: 'Mumbai',
      country: 'India'
    }],
    followUps: [{
      id: 'f1-1',
      type: 'Meeting',
      status: 'Planned',
      date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      notes: 'Discuss Q3 targets.'
    }],
    createdAt: new Date().toISOString(),
    createdBy: 'Alka'
  },
  {
    id: '2',
    agencyName: 'Future Abroad',
    status: 'In Pipeline',
    agentCategory: 'Silver',
    tags: ['UK Specialist'],
    accountManager: 'Akash',
    salesPerson: 'Alka',
    contacts: [
      {
        id: 'c2-1',
        name: 'Priya Patel',
        role: 'Senior Counselor',
        phone: '918765432109',
        email: 'priya.p@futureabroad.com',
        city: 'London',
        country: 'UK'
      },
      {
        id: 'c2-2',
        name: 'Mr. Khan',
        role: 'Owner',
        phone: '918765432108'
      }
    ],
    followUps: [
      {
        id: 'f2-1',
        type: 'Call',
        status: 'Done',
        date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        notes: 'Initial discussion completed. Very interested in partnership.'
      },
      {
        id: 'f2-2',
        type: 'Meeting',
        status: 'Planned',
        date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        notes: 'Follow-up meeting to discuss terms.'
      }
    ],
    createdAt: new Date().toISOString(),
    createdBy: 'Akash'
  },
  {
    id: '3',
    agencyName: 'Study Canada Inc.',
    status: 'ICP Qualified',
    agentCategory: 'Gold',
    tags: ['Canada Specialist'],
    accountManager: 'Alka',
    salesPerson: 'Akash',
    contacts: [{
      id: 'c3',
      name: 'Amit Singh',
      role: 'Director',
      phone: '917654321098',
      email: 'amit.s@studycanada.com',
      city: 'Toronto',
      country: 'Canada'
    }],
    followUps: [{
      id: 'f3',
      type: 'Meeting',
      status: 'Done',
      date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      notes: 'Completed qualification call. Strong potential partner.'
    }],
    createdAt: new Date().toISOString(),
    createdBy: 'Alka'
  },
  {
    id: '4',
    agencyName: 'US Admissions Experts',
    status: 'Won',
    agentCategory: 'Diamond',
    tags: ['USA'],
    accountManager: 'Rakesh Admin',
    salesPerson: 'Alka',
    contacts: [{
      id: 'c4',
      name: 'Sunita Rao',
      role: 'CEO',
      phone: '916543210987',
      email: 'sunita.r@usaexperts.com',
      city: 'New York',
      country: 'USA'
    }],
    followUps: [],
    createdAt: new Date().toISOString(),
    createdBy: 'Rakesh Admin',
    onboardedBy: 'Rakesh Admin'
  },
  {
    id: '5',
    agencyName: 'Punjab Edu Services',
    status: 'New',
    agentCategory: 'Bronze',
    tags: ['Punjab'],
    accountManager: 'Akash',
    salesPerson: 'Alka',
    contacts: [{
      id: 'c5',
      name: 'Jaspreet Singh',
      role: 'Owner',
      phone: '919876512345',
      email: 'jaspreet@pes.com',
      city: 'Ludhiana',
      country: 'India'
    }],
    followUps: [{
      id: 'f5',
      type: 'Meeting',
      status: 'Planned',
      date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      notes: 'Onboarding session.'
    }],
    createdAt: new Date().toISOString(),
    createdBy: 'Akash'
  },
  {
    id: '6',
    agencyName: 'Haryana Overseas Group',
    status: 'In Pipeline',
    agentCategory: 'Beginner',
    tags: ['Haryana', 'High Potential'],
    accountManager: 'Rakesh Admin',
    salesPerson: 'Akash',
    contacts: [{
      id: 'c6',
      name: 'Sandeep Kumar',
      role: 'Counselor',
      phone: '919876554321',
      email: 'sandeep@hog.com',
      city: 'Gurgaon',
      country: 'India'
    }],
    followUps: [{
      id: 'f6',
      type: 'Meeting',
      status: 'Planned',
      date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      notes: 'Follow up on proposal.'
    }],
    createdAt: new Date().toISOString(),
    createdBy: 'Rakesh Admin'
  },
  {
    id: '7',
    agencyName: 'Gujarat Connect',
    status: 'ICP Qualified',
    agentCategory: 'Silver',
    tags: ['Gujarat'],
    accountManager: 'Alka',
    salesPerson: 'Akash',
    contacts: [{
      id: 'c7',
      name: 'Aarav Patel',
      role: 'Director',
      phone: '919876598765',
      email: 'aarav@gujaratconnect.com',
      city: 'Ahmedabad',
      country: 'India'
    }],
    followUps: [
      {
        id: 'f7-1',
        type: 'Meeting',
        status: 'Done',
        date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        notes: 'Initial presentation complete.'
      },
      {
        id: 'f7-2',
        type: 'Call',
        status: 'Planned',
        date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
        notes: 'Follow-up call to discuss next steps.'
      }
    ],
    createdAt: new Date().toISOString(),
    createdBy: 'Alka'
  },
  {
    id: '8',
    agencyName: 'Amritsar Consultants',
    status: 'New',
    agentCategory: 'Beginner',
    tags: ['Punjab'],
    accountManager: 'Akash',
    salesPerson: 'Alka',
    contacts: [{
      id: 'c8',
      name: 'Harleen Kaur',
      role: 'Manager',
      phone: '919876567890',
      email: 'harleen@ac.com',
      city: 'Amritsar',
      country: 'India'
    }],
    followUps: [{
      id: 'f8',
      type: 'Meeting',
      status: 'Planned',
      date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      notes: 'Explore collaboration.'
    }],
    createdAt: new Date().toISOString(),
    createdBy: 'Akash'
  }
];

async function assignMockDataToUsers() {
  try {
    console.log('🔄 Assigning mock data to real users...');

    // Clear existing leads first
    const leadsSnapshot = await db.collection('Leads').get();
    const batch = db.batch();
    
    leadsSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    console.log('✅ Cleared existing leads');

    // Add new leads with real user assignments
    const newBatch = db.batch();
    
    for (const lead of mockLeads) {
      const leadRef = db.collection('Leads').doc(lead.id);
      newBatch.set(leadRef, lead);
    }
    
    await newBatch.commit();
    console.log('✅ Added mock leads with real user assignments');

    // Summary
    console.log('\n📊 Lead Assignment Summary:');
    console.log('========================');
    
    const userStats = {};
    mockLeads.forEach(lead => {
      const am = lead.accountManager;
      const sp = lead.salesPerson;
      const creator = lead.createdBy;
      
      if (!userStats[am]) userStats[am] = { accountManager: 0, salesPerson: 0, created: 0 };
      if (!userStats[sp]) userStats[sp] = { accountManager: 0, salesPerson: 0, created: 0 };
      if (!userStats[creator]) userStats[creator] = { accountManager: 0, salesPerson: 0, created: 0 };
      
      userStats[am].accountManager++;
      userStats[sp].salesPerson++;
      userStats[creator].created++;
    });

    Object.entries(userStats).forEach(([user, stats]) => {
      console.log(`👤 ${user}:`);
      console.log(`   Account Manager: ${stats.accountManager} leads`);
      console.log(`   Sales Person: ${stats.salesPerson} leads`);
      console.log(`   Created: ${stats.created} leads`);
    });

    console.log('\n🎉 Mock data successfully assigned to real users!');
    console.log('📱 All users can now see their assigned leads in the CRM');

  } catch (error) {
    console.error('❌ Error assigning mock data:', error);
    process.exit(1);
  }
}

assignMockDataToUsers();
