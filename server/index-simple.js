import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: ['https://agent-follow-up-crm.web.app', 'http://localhost:5173'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Mock Firebase Admin SDK for initial testing
let adminApp = null;
let auth = null;
let db = null;

// Try to initialize Firebase Admin SDK
try {
  const { initializeApp, getApps, cert } = await import('firebase-admin/app');
  const { getAuth } = await import('firebase-admin/auth');
  const { getFirestore } = await import('firebase-admin/firestore');

  if (getApps().length === 0 && process.env.FIREBASE_PROJECT_ID) {
    adminApp = initializeApp({
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
    auth = getAuth(adminApp);
    db = getFirestore(adminApp);
    console.log('✅ Firebase Admin SDK initialized successfully');
  } else {
    console.log('⚠️  Firebase Admin SDK not configured - running in mock mode');
  }
} catch (error) {
  console.log('⚠️  Firebase Admin SDK initialization failed - running in mock mode:', error.message);
}

// Mock data store for testing
const mockUsers = new Map();

// Utility functions
const logError = (operation, error, context = {}) => {
  console.error(`[${new Date().toISOString()}] ${operation} failed:`, {
    error: error.message,
    stack: error.stack,
    context
  });
};

// Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    firebase_configured: !!adminApp
  });
});

// User signup endpoint
app.post('/api/signup', async (req, res) => {
  try {
    const { email, password, name, signupMethod } = req.body;
    
    if (!email || !name || !signupMethod) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email, name, and signupMethod are required' 
      });
    }

    const emailLower = email.toLowerCase();

    if (db) {
      // Use Firebase Admin SDK
      try {
        const userDoc = await db.collection('Users').doc(emailLower).get();
        if (userDoc.exists) {
          return res.status(409).json({ 
            success: false, 
            error: 'User already exists' 
          });
        }

        let firebaseUser;
        if (signupMethod === 'email') {
          firebaseUser = await auth.createUser({
            email: emailLower,
            password,
            displayName: name,
            emailVerified: false
          });
        }

        const userData = {
          name,
          email: emailLower,
          role: emailLower === 'canamrakesh@gmail.com' ? 'Admin' : 'Account Manager',
          status: 'Active', // All new users are now Active by default
          created_at: new Date().toISOString(),
          signup_method: signupMethod,
          password_set: signupMethod === 'email',
          last_login: null,
          approved_at: new Date().toISOString(),
          approved_by: 'system-auto-approval'
        };

        await db.collection('Users').doc(emailLower).set(userData);

        res.json({ 
          success: true, 
          message: 'User created successfully',
          user: {
            email: emailLower,
            name,
            role: userData.role,
            status: userData.status
          }
        });
      } catch (firebaseError) {
        logError('firebase-signup', firebaseError, { email: emailLower });
        throw firebaseError;
      }
    } else {
      // Use mock storage
      if (mockUsers.has(emailLower)) {
        return res.status(409).json({ 
          success: false, 
          error: 'User already exists' 
        });
      }

      const userData = {
        name,
        email: emailLower,
        role: emailLower === 'canamrakesh@gmail.com' ? 'Admin' : 'Pending',
        status: emailLower === 'canamrakesh@gmail.com' ? 'Active' : 'Pending',
        created_at: new Date().toISOString(),
        signup_method: signupMethod,
        password_set: signupMethod === 'email'
      };

      mockUsers.set(emailLower, userData);

      res.json({ 
        success: true, 
        message: 'User created successfully (mock mode)',
        user: {
          email: emailLower,
          name,
          role: userData.role,
          status: userData.status
        }
      });
    }

  } catch (error) {
    logError('signup', error, { email: req.body.email });
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Admin approval endpoint
app.post('/api/approve-user', async (req, res) => {
  try {
    const { userId, role, approvedBy } = req.body;
    
    if (!userId || !role || !approvedBy) {
      return res.status(400).json({ 
        success: false, 
        error: 'userId, role, and approvedBy are required' 
      });
    }

    const userIdLower = userId.toLowerCase();

    if (db) {
      // Use Firebase Admin SDK
      const adminDoc = await db.collection('Users').doc(approvedBy.toLowerCase()).get();
      if (!adminDoc.exists || adminDoc.data().role !== 'Admin') {
        return res.status(403).json({ 
          success: false, 
          error: 'Insufficient permissions' 
        });
      }

      const updateData = {
        role,
        status: 'Active',
        approved_at: new Date().toISOString(),
        approved_by: approvedBy.toLowerCase()
      };

      await db.collection('Users').doc(userIdLower).update(updateData);

      res.json({ 
        success: true, 
        message: 'User approved successfully',
        user: {
          email: userIdLower,
          role,
          status: 'Active'
        }
      });
    } else {
      // Use mock storage
      const user = mockUsers.get(userIdLower);
      if (!user) {
        return res.status(404).json({ 
          success: false, 
          error: 'User not found' 
        });
      }

      user.role = role;
      user.status = 'Active';
      user.approved_at = new Date().toISOString();
      user.approved_by = approvedBy.toLowerCase();

      mockUsers.set(userIdLower, user);

      res.json({ 
        success: true, 
        message: 'User approved successfully (mock mode)',
        user: {
          email: userIdLower,
          role,
          status: 'Active'
        }
      });
    }

  } catch (error) {
    logError('approve-user', error, { userId: req.body.userId });
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Get all users (admin only)
app.get('/api/users', async (req, res) => {
  try {
    const adminEmail = req.query.adminEmail;
    if (!adminEmail) {
      return res.status(400).json({ 
        success: false, 
        error: 'Admin email required' 
      });
    }

    if (db) {
      // Use Firebase Admin SDK
      const adminDoc = await db.collection('Users').doc(adminEmail.toLowerCase()).get();
      if (!adminDoc.exists || adminDoc.data().role !== 'Admin') {
        return res.status(403).json({ 
          success: false, 
          error: 'Insufficient permissions' 
        });
      }

      const usersSnapshot = await db.collection('Users').get();
      const users = [];
      
      usersSnapshot.forEach(doc => {
        users.push({
          id: doc.id,
          ...doc.data()
        });
      });

      res.json({ 
        success: true, 
        users: users.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      });
    } else {
      // Use mock storage
      const users = Array.from(mockUsers.entries()).map(([id, data]) => ({
        id,
        ...data
      }));

      res.json({ 
        success: true, 
        users: users.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      });
    }

  } catch (error) {
    logError('get-users', error, { adminEmail: req.query.adminEmail });
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Create admin user (one-time setup)
app.post('/api/create-admin', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    if (!email || !password || !name) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email, password, and name are required' 
      });
    }

    const emailLower = email.toLowerCase();

    if (db) {
      // Use Firebase Admin SDK
      const firebaseUser = await auth.createUser({
        email: emailLower,
        password,
        displayName: name,
        emailVerified: true
      });

      const userData = {
        name,
        email: emailLower,
        role: 'Admin',
        status: 'Active',
        created_at: new Date().toISOString(),
        signup_method: 'admin_setup',
        password_set: true,
        last_login: null,
        approved_at: new Date().toISOString(),
        approved_by: 'system'
      };

      await db.collection('Users').doc(emailLower).set(userData);

      res.json({ 
        success: true, 
        message: 'Admin user created successfully',
        user: {
          email: emailLower,
          name,
          role: 'Admin',
          status: 'Active'
        }
      });
    } else {
      // Use mock storage
      const userData = {
        name,
        email: emailLower,
        role: 'Admin',
        status: 'Active',
        created_at: new Date().toISOString(),
        signup_method: 'admin_setup',
        password_set: true
      };

      mockUsers.set(emailLower, userData);

      res.json({ 
        success: true, 
        message: 'Admin user created successfully (mock mode)',
        user: {
          email: emailLower,
          name,
          role: 'Admin',
          status: 'Active'
        }
      });
    }

  } catch (error) {
    logError('create-admin', error, { email: req.body.email });
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  logError('unhandled-error', error, { 
    url: req.url, 
    method: req.method,
    body: req.body 
  });
  
  res.status(500).json({ 
    success: false, 
    error: 'Internal server error' 
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false, 
    error: 'Endpoint not found' 
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 CRM Auth Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔐 Firebase Admin SDK: ${adminApp ? 'Configured ✅' : 'Not configured ⚠️'}`);
  console.log(`🌐 Server URL: http://localhost:${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
  console.log(`\n📋 Available endpoints:`);
  console.log(`   POST /api/signup - Create new user`);
  console.log(`   POST /api/approve-user - Approve pending user`);
  console.log(`   GET  /api/users - Get all users`);
  console.log(`   POST /api/create-admin - Create admin user`);
  console.log(`   GET  /api/health - Health check`);
});

export default app;







