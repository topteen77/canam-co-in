// Utility functions for generating and managing default passwords

export const generateDefaultPassword = (email: string, name?: string): string => {
  // Generate a consistent password based on email and name
  const emailPrefix = email.split('@')[0];
  const namePrefix = name ? name.split(' ')[0].toLowerCase() : '';
  
  // Create a predictable but secure password format
  const baseString = `${emailPrefix}${namePrefix}`.toLowerCase();
  const year = new Date().getFullYear();
  
  // Format: [baseString][year]!
  return `${baseString}${year}!`;
};

export const generateRandomPassword = (): string => {
  // Generate a random password for new users
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  
  // Ensure at least one of each type
  password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]; // Uppercase
  password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]; // Lowercase
  password += '0123456789'[Math.floor(Math.random() * 10)]; // Number
  password += '!@#$%^&*'[Math.floor(Math.random() * 8)]; // Special char
  
  // Add 4 more random characters
  for (let i = 0; i < 4; i++) {
    password += chars[Math.floor(Math.random() * chars.length)];
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
};

export const validatePassword = (password: string): boolean => {
  // Basic password validation
  return password.length >= 8 && 
         /[A-Z]/.test(password) && 
         /[a-z]/.test(password) && 
         /[0-9]/.test(password) && 
         /[!@#$%^&*]/.test(password);
};

export const maskPassword = (password: string): string => {
  // Show first 2 and last 2 characters, mask the rest
  if (password.length <= 4) return '*'.repeat(password.length);
  return password.substring(0, 2) + '*'.repeat(password.length - 4) + password.substring(password.length - 2);
};
