# CRM Authentication Server

A comprehensive Node.js server using Firebase Admin SDK for handling user authentication, signup, admin approval, and role management for the Agency Partner CRM system.

## Features

- ✅ **User Signup**: Email/password and Google OAuth signup
- ✅ **Admin Approval**: Role assignment and user activation
- ✅ **Password Management**: Setup for Google users, password reset
- ✅ **Email Notifications**: Welcome emails, approval notifications
- ✅ **Security**: Rate limiting, input validation, error handling
- ✅ **Admin Tools**: User management, bulk operations

## Setup Instructions

### 1. Install Dependencies

```bash
cd server
npm install
```

### 2. MySQL Database (required)

The server uses MySQL for users, leads, and all CRM data. **MySQL must be running** or you will see `ECONNREFUSED` and login (including Google Sign-In) will fail.

- **Start MySQL** (e.g. start the MySQL service on Windows, or run `mysql.server start` on Mac).
- Copy `env.example` to `.env` in the **project root** (parent of `server/`) and set:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=crm_db
```

- Create the database if needed: `CREATE DATABASE crm_db;`
- Run any migrations or import your dump (e.g. `dump.sql`) into `crm_db`.

### 3. Firebase Admin SDK Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `agent-follow-up-crm`
3. Go to Project Settings → Service Accounts
4. Click "Generate new private key"
5. Download the JSON file

### 4. Environment Configuration

Create a `.env` file in the **project root** (parent of `server/`), or in the server directory:

```bash
# Copy the example file
cp env.example .env
```

Edit `.env` with your Firebase Admin SDK credentials:

```env
# Firebase Admin SDK Configuration
FIREBASE_PROJECT_ID=agent-follow-up-crm
FIREBASE_PRIVATE_KEY_ID=your_private_key_id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@agent-follow-up-crm.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=your_client_id
FIREBASE_AUTH_URI=https://accounts.google.com/o/oauth2/auth
FIREBASE_TOKEN_URI=https://oauth2.googleapis.com/token

# Server Configuration
PORT=3001
NODE_ENV=production

# Email Configuration (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Admin Configuration
ADMIN_EMAIL=canamrakesh@gmail.com
ADMIN_PASSWORD=@16Agentcrm

# Security
JWT_SECRET=your-super-secret-jwt-key
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 5. Initialize Admin User

```bash
# Set up the admin user in Firestore
node scripts/setup-admin.js
```

### 6. Start the Server

```bash
# Development
npm run dev

# Production
npm start
```

## API Endpoints

### Authentication

#### POST `/api/signup`
Create a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe",
  "signupMethod": "email"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User created successfully",
  "user": {
    "email": "user@example.com",
    "name": "John Doe",
    "role": "Pending",
    "status": "Pending"
  }
}
```

#### POST `/api/approve-user`
Approve a pending user and assign role (Admin only).

**Request Body:**
```json
{
  "userId": "user@example.com",
  "role": "Sales",
  "approvedBy": "admin@example.com"
}
```

#### POST `/api/setup-password`
Set password for Google users.

**Request Body:**
```json
{
  "uid": "firebase_user_id",
  "newPassword": "newpassword123"
}
```

### User Management

#### GET `/api/users?adminEmail=admin@example.com`
Get all users (Admin only).

**Response:**
```json
{
  "success": true,
  "users": [
    {
      "id": "user@example.com",
      "name": "John Doe",
      "email": "user@example.com",
      "role": "Sales",
      "status": "Active",
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

#### POST `/api/create-admin`
Create admin user (one-time setup).

**Request Body:**
```json
{
  "email": "admin@example.com",
  "password": "adminpassword",
  "name": "Admin User"
}
```

## Scripts

### Setup Admin User
```bash
node scripts/setup-admin.js
```

### Check All Users
```bash
node scripts/check-users.js
```

### Approve User
```bash
node scripts/approve-user.js user@example.com Sales
```

## Security Features

- **Rate Limiting**: 100 requests per 15 minutes per IP
- **Input Validation**: Joi schema validation for all inputs
- **CORS Protection**: Configured for specific origins
- **Helmet Security**: Security headers
- **Error Handling**: Comprehensive error logging
- **Admin Verification**: Role-based access control

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error message",
  "details": "Additional error details (if applicable)"
}
```

## Email Notifications

The server can send email notifications for:
- Welcome emails for new users
- Account approval notifications
- Password reset emails (if configured)

Configure SMTP settings in `.env` to enable email functionality.

## Deployment

### Local Development
```bash
npm run dev
```

### Production
```bash
npm start
```

### Environment Variables
Ensure all required environment variables are set in production.

## Monitoring

The server includes:
- Health check endpoint: `GET /api/health`
- Comprehensive error logging
- Request/response logging
- Performance monitoring

## Troubleshooting

### Common Issues

1. **Firebase Admin SDK Error**
   - Verify service account credentials
   - Check project ID matches
   - Ensure private key is properly formatted

2. **Email Not Sending**
   - Verify SMTP credentials
   - Check firewall settings
   - Use app-specific passwords for Gmail

3. **Permission Denied**
   - Verify admin role in Firestore
   - Check Firestore security rules
   - Ensure proper authentication

### Logs

Check server logs for detailed error information:
```bash
# Development
npm run dev

# Production
npm start
```

## Support

For issues or questions:
1. Check server logs
2. Verify environment configuration
3. Test with provided scripts
4. Review Firebase Console for errors






















































