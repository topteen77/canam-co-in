/**
 * Utility functions for cleaning corrupted data across the CRM
 */

export interface CleanedUserData {
  name: string;
  email: string;
  role?: string;
}

/**
 * Cleans corrupted JSON data that might be stored in user fields
 * Handles cases where entire user objects are stored as strings
 */
export const cleanCorruptedData = (data: any): string => {
  if (!data) return '';
  
  // If it's not a string, convert to string first
  const dataStr = typeof data === 'string' ? data : String(data);
  
  // Check if it's a JSON string and try to extract email/name
  if (dataStr.startsWith('{') && (dataStr.includes('"email"') || dataStr.includes('"name"'))) {
    try {
      const parsedData = JSON.parse(dataStr);
      // Return email if available, otherwise name, otherwise fallback
      const result = parsedData.email || parsedData.name || parsedData.id || '';
      return result || 'Unknown User';
    } catch (e) {
      console.warn('Failed to parse corrupted data:', dataStr);
      // Try to extract email from truncated JSON using regex
      const emailMatch = dataStr.match(/"email":"([^"]+)"/);
      if (emailMatch) {
        return emailMatch[1];
      }
      // Try to extract name from truncated JSON using regex
      const nameMatch = dataStr.match(/"name":"([^"]+)"/);
      if (nameMatch) {
        return nameMatch[1];
      }
      return 'Unknown User';
    }
  }
  
  return dataStr;
};

/**
 * Cleans and extracts user data from corrupted JSON strings
 */
export const cleanUserData = (userData: any): CleanedUserData => {
  let name = '';
  let email = '';
  let role = '';

  if (typeof userData === 'string' && userData.startsWith('{')) {
    try {
      const parsedData = JSON.parse(userData);
      name = parsedData.name || '';
      email = parsedData.email || '';
      role = parsedData.role || '';
    } catch (e) {
      console.warn('Failed to parse user data JSON:', userData);
      name = userData;
      email = userData;
    }
  } else if (typeof userData === 'object' && userData !== null) {
    name = userData.name || '';
    email = userData.email || '';
    role = userData.role || '';
  } else {
    name = userData || '';
    email = userData || '';
  }

  return { name, email, role };
};

/**
 * Gets display name for a user, handling corrupted data
 */
export const getUserDisplayName = (emailOrUsername: string, availableUsers: any[] = []): string => {
  if (!emailOrUsername) return 'N/A';
  
  // Handle if emailOrUsername is a JSON string
  let cleanEmail = emailOrUsername;
  if (emailOrUsername.startsWith('{') && emailOrUsername.includes('"email"')) {
    try {
      const parsedData = JSON.parse(emailOrUsername);
      cleanEmail = parsedData.email || parsedData.id || emailOrUsername;
    } catch (e) {
      console.warn('Failed to parse email JSON:', emailOrUsername);
      // Try to extract email from truncated JSON
      const emailMatch = emailOrUsername.match(/"email":"([^"]+)"/);
      if (emailMatch) {
        cleanEmail = emailMatch[1];
      } else {
        cleanEmail = emailOrUsername;
      }
    }
  }
  
  // First clean any corrupted data
  cleanEmail = cleanCorruptedData(cleanEmail);
  
  if (!availableUsers || availableUsers.length === 0) {
    return cleanEmail.split('@')[0];
  }
  
  const user = availableUsers.find(u => u.email && u.email.toLowerCase() === cleanEmail.toLowerCase());
  if (user && user.name && user.name.trim()) {
    // Handle corrupted name data (JSON strings)
    let displayName = user.name.trim();
    
    // Check if the name is a JSON string and try to parse it
    if (displayName.startsWith('{') && displayName.includes('"name"')) {
      try {
        const parsedData = JSON.parse(displayName);
        if (parsedData.name && typeof parsedData.name === 'string') {
          displayName = parsedData.name;
        }
      } catch (e) {
        console.warn('Failed to parse user name JSON:', displayName);
      }
    }
    
    // Return clean name or fallback to email prefix
    return displayName || cleanEmail.split('@')[0];
  }
  
  return cleanEmail.split('@')[0];
};

/**
 * Cleans user data for display in tables and lists
 */
export const cleanUserForDisplay = (userData: any): { name: string; email: string } => {
  if (typeof userData === 'string' && userData.startsWith('{')) {
    try {
      const parsed = JSON.parse(userData);
      return {
        name: parsed.name || parsed.email?.split('@')[0] || 'Unknown User',
        email: parsed.email || userData
      };
    } catch (e) {
      return {
        name: userData.split('@')[0] || 'Unknown User',
        email: userData
      };
    }
  }
  
  return {
    name: userData?.name || userData?.email?.split('@')[0] || 'Unknown User',
    email: userData?.email || userData || 'unknown@example.com'
  };
};

