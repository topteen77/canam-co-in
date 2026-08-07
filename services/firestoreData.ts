import apiClient from './apiClient';

// --- SQL TABLE MAPPINGS ---
// These replace the Firebase Collection References. 
// Used as constants for API endpoints or reference.
export const usersCol = 'users';
export const partnersCol = 'companies'; // Mapped 'Partners' collection to 'companies' table
export const contactsCol = 'contacts';
export const followUpsCol = 'activity_logs'; // Mapped 'FollowUps' collection to 'activity_logs' table
export const onboardingCol = 'onboarding';

// --- USER SYNC FUNCTION ---
// Replaces: setDoc(userRef, data, { merge: true })
// This sends user data to the backend to ensure the record exists (Upsert).
export async function ensureUserProfile(user: { uid: string; displayName?: string | null; email?: string | null; }) {
  try {
    const userData = {
      id: user.uid,
      name: user.displayName || 'Unknown',
      email: user.email || '',
      role: 'Admin', // Retaining original default behavior
      status: 'Active'
    };

    console.log('👤 Ensuring User Profile in SQL:', userData);

    // Call backend to sync user (Insert if new, Update if exists)
    // Note: You may need to add this '/auth/sync-user' route to your backend index.js
    await apiClient.post('/auth/sync-user', userData);
    
  } catch (error) {
    // We log but don't throw, to prevent blocking the auth flow
    console.warn('⚠️ User profile sync warning:', error);
  }
}