import apiClient from './apiClient';
import type { User } from '../types';
import { generateDefaultPassword } from '../utils/passwordUtils'; 

// Generate and set default password for a user
export const setDefaultPasswordForUser = async (userId: string, userData: Partial<User>): Promise<string> => {
  try {
    // Send request to backend to set password
    const response = await apiClient.post('/password/set-default', { userId, userData });
    return response.data.defaultPassword;
  } catch (error) {
    console.error('Error setting default password:', error);
    // Fallback: Generate locally if API fails (though saving won't work without API)
    return generateDefaultPassword(userData.email || '', userData.name || '');
  }
};

// Generate default passwords for all users
export const generateDefaultPasswordsForAllUsers = async (): Promise<{ success: number; errors: string[] }> => {
  try {
    const response = await apiClient.post('/password/generate-all');
    return response.data;
  } catch (error) {
    console.error('Error generating passwords for all users:', error);
    throw error;
  }
};

// Get user with default password
export const getUserWithPassword = async (userId: string): Promise<User | null> => {
  try {
    // Fetch user details from API (which should include password info if admin)
    // Note: Ensure your /users/:id endpoint returns the defaultPassword field for admins
    const response = await apiClient.get(`/users/${userId}`);
    return response.data;
  } catch (error) {
    console.error('Error getting user with password:', error);
    return null;
  }
};

// Update user's default password
export const updateUserDefaultPassword = async (userId: string, newPassword?: string): Promise<string> => {
  try {
    // We fetch user first to get details for generation if needed
    const userResponse = await apiClient.get(`/users/${userId}`);
    const user = userResponse.data;
    
    if (!user) throw new Error('User not found');

    const passwordToSet = newPassword || generateDefaultPassword(user.email, user.name);

    // Call API to update specific user password
    // Using a specific endpoint is cleaner than generic update
    await apiClient.put(`/users/${userId}/default-password`, { 
      defaultPassword: passwordToSet,
      passwordGeneratedAt: new Date().toISOString()
    });
    
    return passwordToSet;
  } catch (error) {
    console.error('Error updating user default password:', error);
    throw error;
  }
};

// Verify default password for login
export const verifyDefaultPassword = async (email: string, password: string): Promise<User | null> => {
  try {
    const response = await apiClient.post('/password/verify', { email, password });
    return response.data.user;
  } catch (error) {
    console.error('Error verifying password:', error);
    return null;
  }
};