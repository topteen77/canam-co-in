// components/AdminUsers.tsx – uses API (no Firebase)
import React, { useState, useEffect, useMemo } from 'react';
import apiClient from '../services/apiClient';
import { generateDefaultPasswordsForAllUsers } from '../services/passwordService';
import { getUserDisplayName as utilGetUserDisplayName, cleanCorruptedData } from '../utils/dataCleaning';
import CompanyManagement from './CompanyManagement';

export type AppRole = 'Admin' | 'SubAdmin' | 'Account Manager' | 'Sales' | 'Operations' | 'Pending';

interface AppUser {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  role?: AppRole;
  status?: 'Active' | 'Inactive' | 'Pending';
  defaultPassword?: string;
  created_at?: any;
  updated_at?: string;
  updated_by?: string;
  activated_at?: string;
}

interface AdminUsersProps {
  isAdmin?: boolean;
  isSubAdmin?: boolean;
  userRole?: string;
  currentUser?: string;
  onLogout?: () => void;
}

const mapUserRow = (row: any): AppUser => ({
  id: row.id,
  name: row.name,
  email: row.email,
  role: row.role,
  status: row.status,
  defaultPassword: row.default_password ?? row.defaultPassword,
  created_at: row.created_at ?? row.createdAt,
  updated_at: row.updated_at ?? row.updatedAt,
});

const AdminUsers: React.FC<AdminUsersProps> = ({
  isAdmin = false,
  isSubAdmin = false,
  userRole = 'Account Manager',
  currentUser = '',
  onLogout
}) => {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatingPasswords, setGeneratingPasswords] = useState(false);
  const hasAdminAccess = isAdmin || isSubAdmin;
  const effectiveUserRole = userRole || 'Account Manager';
  const effectiveCurrentUser = currentUser || '';
  const [activeTab, setActiveTab] = useState<'users' | 'costs' | 'usage' | 'company-management'>('users');

  const getUserDisplayName = (email: string): string =>
    utilGetUserDisplayName(email, Array.isArray(users) ? users : []);

  const loadUsers = async () => {
    try {
      const { data } = await apiClient.get('/users');
      const list = (Array.isArray(data) ? data : []).map(mapUserRow);
      setUsers(list);
    } catch (e: any) {
      setError(e?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hasAdminAccess || effectiveCurrentUser) loadUsers();
  }, [hasAdminAccess, effectiveCurrentUser]);

  const updateUser = async (userId: string, updates: Partial<AppUser>) => {
    try {
      await apiClient.put(`/users/${userId}`, updates);
      await loadUsers();
    } catch (error) {
      console.error('Error updating user:', error);
    }
  };

  const resetUserPassword = async (user: AppUser) => {
    try {
      // 🟢 SAFE FIX: Handle cases where email or name might be missing
      const safeEmail = user.email || '';
      const safeName = user.name || '';
      
      // Generate new password
      const emailPrefix = safeEmail.split('@')[0] || 'user';
      const namePrefix = safeName.split(' ')[0]?.toLowerCase() || '';
      const baseString = `${emailPrefix}${namePrefix}`.toLowerCase().replace(/[^a-z0-9]/g, '');
      const year = new Date().getFullYear();
      const newPassword = `${baseString}${year}!`;
      
      await updateUser(user.id, {
        defaultPassword: newPassword,
        passwordGeneratedAt: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...({ password_reset_requested: true, password_reset_at: new Date().toISOString() } as any)
      });
      
      alert(`✅ Password reset for ${user.email}!\n\nNew Password: ${newPassword}\n\nPlease share this password with the user.`);
      
    } catch (error) {
      console.error('Error resetting password:', error);
      alert(`❌ Error resetting password for ${user.email}: ${error}`);
    }
  };

  const editUserRole = async (user: AppUser) => {
    if (!user.id) return;
    
    const currentRole = user.role || 'Pending';
    const availableRoles: AppRole[] = ['Admin', 'SubAdmin', 'Account Manager', 'Sales', 'Operations'];
    
    // Don't show Pending in the list since we're editing away from it
    const roleOptions = availableRoles.map(role => `${role}`);
    
    const selectedRole = prompt(
      `Edit role for ${getUserDisplayName(user.email || '')}\n\n` +
      `Current role: ${currentRole}\n\n` +
      `Available roles:\n${roleOptions.map((role, index) => `${index + 1}. ${role}`).join('\n')}\n\n` +
      `Enter the new role (1-${roleOptions.length}):`
    );
    
    if (selectedRole === null) return; // User cancelled
    
    const roleIndex = parseInt(selectedRole) - 1;
    if (roleIndex < 0 || roleIndex >= roleOptions.length) {
      alert('Invalid selection. Please try again.');
      return;
    }
    
    const newRole = availableRoles[roleIndex];
    
    try {
      await updateUser(user.id, {
        role: newRole,
        status: newRole === 'Pending' ? 'Pending' : 'Active', // Auto-activate non-pending roles
        updated_at: new Date().toISOString(),
        updated_by: effectiveCurrentUser || 'admin'
      });
      
      alert(`✅ Role updated successfully!\n\n${getUserDisplayName(user.email || '')}\n${currentRole} → ${newRole}`);
    } catch (error) {
      console.error('Error updating role:', error);
      alert('Failed to update user role');
    }
  };

  const activateAllPendingUsers = async () => {
    // 🟢 SAFE FIX: Ensure users is an array
    const safeUsers = Array.isArray(users) ? users : [];
    const pendingUsers = safeUsers.filter(user => user.role === 'Pending' || user.status === 'Pending');
    
    if (pendingUsers.length === 0) {
      alert('✅ No pending users found! All users are already active.');
      return;
    }
    
    const confirmMessage = `Found ${pendingUsers.length} pending users:\n\n` +
      pendingUsers.map(user => `• ${getUserDisplayName(user.email || '')} (${user.email})`).join('\n') +
      `\n\nDo you want to activate all pending users as "Account Manager" role?`;
    
    if (!confirm(confirmMessage)) return;
    
    try {
      let successCount = 0;
      
      for (const user of pendingUsers) {
        try {
          await updateUser(user.id, {
            role: 'Account Manager',
            status: 'Active',
            updated_at: new Date().toISOString(),
            updated_by: effectiveCurrentUser || 'admin',
            activated_at: new Date().toISOString()
          });
          successCount++;
        } catch (error) {
          console.error(`Failed to activate ${user.email}:`, error);
        }
      }
      
      alert(`✅ Successfully activated ${successCount}/${pendingUsers.length} pending users!\n\nThey can now access the CRM with "Account Manager" role.`);
    } catch (error) {
      console.error('Error activating pending users:', error);
      alert('❌ Failed to activate some users. Check console for details.');
    }
  };

  const loginAsUser = async (user: AppUser) => {
    try {
      // 🟢 SAFE FIX: Prevent crashing if user data is incomplete
      if (!user || !user.email) {
        alert('❌ Cannot login as user: User data is incomplete or email is missing.');
        return;
      }

      console.log('🔐 Admin logging in as user:', user.email);
      
      // Store the original admin user for switching back
      const originalAdmin = effectiveCurrentUser;
      localStorage.setItem('originalAdmin', originalAdmin || '');
      
      // Set the target user as the current user - store as JSON for consistency
      const userObject = {
        email: user.email.toLowerCase(),
        id: user.email.toLowerCase(), // Use email as ID if ID is missing for safety
        name: user.name || user.email.split('@')[0] || '',
        role: user.role || 'Account Manager',
        approved: user.status === 'Active',
        status: user.status || 'Active',
        signup_method: 'google',
        created_at: user.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      localStorage.setItem('crmUser', JSON.stringify(userObject));
      
      // Show confirmation
      const confirmMessage = `
🎭 ADMIN LOGIN AS USER

You are now logging in as:
👤 Name: ${user.name || 'N/A'}
📧 Email: ${user.email}
👥 Role: ${user.role}
✅ Status: ${user.status}

🔄 The page will refresh and you'll be logged in as this user.

🔙 To switch back to admin:
- Go to User Profile → "Switch Back to Admin"
- Or clear browser data and login as admin again

Continue?
      `;
      
      if (confirm(confirmMessage)) {
        // Refresh the page to apply the new user session
        window.location.reload();
      } else {
        // User cancelled, restore original admin
        localStorage.setItem('crmUser', originalAdmin?.toUpperCase() || '');
      }
      
    } catch (error) {
      console.error('Error logging in as user:', error);
      alert(`Error logging in as ${user.email}: ${error}`);
    }
  };

  const generatePasswordsForAllUsers = async () => {
    setGeneratingPasswords(true);
    try {
      const result = await generateDefaultPasswordsForAllUsers();
      alert(`✅ Generated passwords for ${result.success} users successfully!${result.errors.length > 0 ? `\n\nErrors: ${result.errors.join('\n')}` : ''}`);
    } catch (e: any) {
      setError(e.message);
      alert(`❌ Error generating passwords: ${e.message}`);
    } finally {
      setGeneratingPasswords(false);
    }
  };

  const fixUserPassword = async (user: AppUser) => {
    try {
      const safeEmail = user.email || '';
      const safeName = user.name || '';
      const emailPrefix = safeEmail.split('@')[0] || 'user';
      const namePrefix = safeName.split(' ')[0]?.toLowerCase() || '';
      const baseString = `${emailPrefix}${namePrefix}`.toLowerCase().replace(/[^a-z0-9]/g, '');
      const year = new Date().getFullYear();
      const defaultPassword = `${baseString}${year}!`;
      await apiClient.put(`/users/${user.id}`, {
        defaultPassword,
        passwordGeneratedAt: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      await loadUsers();
      alert(`✅ Password fixed for ${user.email}!\n\nPassword: ${defaultPassword}\n\nPlease share this password with the user.`);
    } catch (error) {
      console.error('Error fixing password:', error);
      alert(`❌ Error fixing password for ${user.email}: ${error}`);
    }
  };

  // Fix passwords for Nakul and Akash specifically
  const fixNakulAndAkashPasswords = async () => {
    try {
      // 🟢 SAFE FIX: Handle potential nulls during search
      const nakul = users.find(u => 
        (u.email?.toLowerCase() || '').includes('nakul') || 
        (u.name?.toLowerCase() || '').includes('nakul') ||
        (u.email || '').includes('iapplyam2b2b')
      );
      
      const akash = users.find(u => 
        (u.email?.toLowerCase() || '').includes('akash') || 
        (u.name?.toLowerCase() || '').includes('akash')
      );
      
      let fixedUsers = [];
      
      if (nakul) {
        await fixUserPassword(nakul);
        fixedUsers.push(nakul.email);
      }
      
      if (akash) {
        await fixUserPassword(akash);
        fixedUsers.push(akash.email);
      }
      
      if (fixedUsers.length > 0) {
        alert(`✅ Fixed passwords for: ${fixedUsers.join(', ')}\n\nPlease share the passwords with the users.`);
      } else {
        alert('❌ Could not find Nakul or Akash in the user list.');
      }
      
    } catch (error) {
      console.error('Error fixing passwords:', error);
      alert(`❌ Error fixing passwords: ${error}`);
    }
  };

  const createUserManually = async () => {
    const email = prompt('Enter the email address of the user to create:');
    if (!email) return;
    try {
      const { data } = await apiClient.post('/users', {
        email: email.toLowerCase(),
        name: email.split('@')[0],
        role: 'Pending',
        status: 'Pending',
      });
      await loadUsers();
      const pwd = (data as any)?.defaultPassword;
      alert(`✅ User ${email} created and added to pending list!${pwd ? `\n\nTemporary password: ${pwd}\nShare with user to log in.` : ''}\n\n⚠️ User must be approved by admin before they can access.`);
    } catch (error: any) {
      console.error('❌ Error creating user:', error);
      alert(`❌ Failed to create user: ${error?.response?.data?.message || error.message}`);
    }
  };

  /**
   * PERMANENT FIX: Clean all corrupted data in database
   * Removes JSON strings from email, name, and other text fields
   */
  const cleanCorruptedDataInDatabase = async () => {
    const confirmed = confirm(
      '🧹 CLEAN CORRUPTED DATA\n\n' +
      'This will scan and fix:\n' +
      '• JSON strings in email fields\n' +
      '• JSON strings in name fields\n' +
      '• Corrupted user reference fields\n\n' +
      'This is SAFE and will only clean corrupted data.\n\n' +
      'Continue?'
    );
    
    if (!confirmed) return;

    try {
      console.log('🧹 Starting database cleanup...');
      
      // Helper function to clean a field
      const cleanField = (data: any, fieldName: string = 'email'): string => {
        if (!data || typeof data !== 'string') return data || '';
        
        // Check if it's a JSON string
        if (data.startsWith('{') && data.includes('"')) {
          try {
            const parsed = JSON.parse(data);
            if (fieldName === 'email' || fieldName.includes('By') || fieldName.includes('To')) {
              return parsed.email || parsed.id || data;
            } else if (fieldName === 'name') {
              return parsed.name || parsed.email?.split('@')[0] || data;
            }
            return parsed[fieldName] || parsed.email || parsed.name || data;
          } catch (e) {
            // Try regex extraction
            if (fieldName === 'email') {
              const emailMatch = data.match(/"email":"([^"]+)"/);
              if (emailMatch) return emailMatch[1];
            } else if (fieldName === 'name') {
              const nameMatch = data.match(/"name":"([^"]+)"/);
              if (nameMatch) return nameMatch[1];
            }
            return data;
          }
        }
        return data;
      };

      const { data: usersList } = await apiClient.get('/users');
      const usersArr = Array.isArray(usersList) ? usersList : [];
      let cleanedCount = 0;
      let corruptionCount = 0;
      for (const u of usersArr) {
        const userData = u as any;
        const userId = userData.id;
        const updates: any = {};
        let hasCorruption = false;
        if (userData.email && typeof userData.email === 'string' && userData.email.startsWith('{')) {
          updates.email = cleanField(userData.email, 'email');
          hasCorruption = true;
        }
        if (userData.name && typeof userData.name === 'string' && userData.name.startsWith('{')) {
          updates.name = cleanField(userData.name, 'name');
          hasCorruption = true;
        }
        if (hasCorruption) {
          corruptionCount++;
          try {
            await apiClient.put(`/users/${userId}`, updates);
            cleanedCount++;
          } catch (err) {
            console.error(`Failed to clean user ${userId}:`, err);
          }
        }
      }

      const { data: leadsList } = await apiClient.get('/leads/all');
      const leadsArr = Array.isArray(leadsList) ? leadsList : [];
      let leadsCleanedCount = 0;
      let leadsCorruptionCount = 0;
      for (const lead of leadsArr) {
        const leadData = lead as any;
        const leadId = leadData.id ?? leadData.firebase_id;
        if (!leadId) continue;
        const updates: any = {};
        let hasCorruption = false;
        ['assignedTo', 'createdBy', 'updatedBy', 'assigned_to', 'created_by', 'updated_by'].forEach(field => {
          const val = leadData[field];
          if (val && typeof val === 'string' && val.startsWith('{')) {
            updates[field] = cleanField(val, field);
            hasCorruption = true;
          }
        });
        if (hasCorruption) {
          leadsCorruptionCount++;
          try {
            await apiClient.put(`/leads/update/${leadId}`, updates);
            leadsCleanedCount++;
          } catch (err) {
            console.error(`Failed to clean lead ${leadId}:`, err);
          }
        }
      }

      const message = '✅ DATABASE CLEANUP COMPLETE!\n\n' +
        `Users scanned: ${usersArr.length}\nUsers with corruption: ${corruptionCount}\nUsers cleaned: ${cleanedCount}\n\n` +
        `Leads scanned: ${leadsArr.length}\nLeads with corruption: ${leadsCorruptionCount}\nLeads cleaned: ${leadsCleanedCount}\n\n🔄 Refreshing list.`;
      alert(message);
      await loadUsers();

    } catch (error) {
      console.error('❌ Error during cleanup:', error);
      alert(`❌ Error during cleanup: ${error}\n\nCheck console for details.`);
    }
  };

  const roleOptions: AppRole[] = useMemo(() => ['Admin', 'SubAdmin', 'Account Manager', 'Sales', 'Operations', 'Pending'], []);

  if (!hasAdminAccess && !effectiveCurrentUser) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-slate-600">Sign in via the app to manage users.</p>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Admin Panel</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-600">
            {hasAdminAccess ? `${effectiveCurrentUser} (Company Admin)` : effectiveCurrentUser}
          </span>
          {!hasAdminAccess && onLogout && (
            <button onClick={onLogout} className="px-3 py-1.5 text-sm bg-slate-200 rounded-md">Sign out</button>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('users')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'users'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            👥 User Management
          </button>
          <button
            onClick={() => setActiveTab('company-management')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'company-management'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            🏢 Company Management
          </button>
          <button
            onClick={() => setActiveTab('costs')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'costs'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            💰 Cost Calculator
          </button>
          <button
            onClick={() => setActiveTab('usage')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'usage'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            👥 User Usage Tracker
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">User Management</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={createUserManually}
                className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                ➕ Add User
              </button>
              <button
                onClick={generatePasswordsForAllUsers}
                disabled={generatingPasswords}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {generatingPasswords ? '⏳ Generating...' : '🔑 Generate Passwords'}
              </button>
              
              <button
                onClick={fixNakulAndAkashPasswords}
                className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                🔧 Fix Nakul & Akash
              </button>
              
              <button
                onClick={() => {
                  console.log('🔍 ALL USERS DEBUG INFO:');
                  console.log(`Total users: ${users.length}`);
                  // 🟢 SAFE FIX: Ensure users is an array before forEach
                  const safeUsers = Array.isArray(users) ? users : [];
                  safeUsers.forEach((user, index) => {
                    console.log(`${index + 1}. ${user.name || 'No name'} (${user.email}) - Status: ${user.status || 'No status'} - Role: ${user.role || 'No role'}`);
                  });
                  
                  // Find Nakul specifically
                  const nakul = safeUsers.find(u => (u.name || '').toLowerCase().includes('nakul') || (u.email || '').toLowerCase().includes('nakul'));
                  if (nakul) {
                    console.log('🎯 NAKUL FOUND:', nakul);
                  } else {
                    console.log('❌ NAKUL NOT FOUND in user list');
                  }
                  
                  alert(`Found ${safeUsers.length} users total. Check console for detailed list. Nakul ${nakul ? 'FOUND' : 'NOT FOUND'}.`);
                }}
                className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700"
              >
                🔍 Debug All Users
              </button>
              
              <button
                onClick={cleanCorruptedDataInDatabase}
                className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-md hover:bg-red-700"
                title="Clean JSON strings in email/name fields"
              >
                🧹 Clean Corrupted Data
              </button>
              
              <button
                onClick={activateAllPendingUsers}
                className="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-md hover:bg-emerald-700"
                title="Activate all pending users as Account Manager"
              >
                ✅ Activate All Pending
              </button>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-600 mt-2">Loading users...</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Password</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {users
                      .map((u) => (
                        <tr key={u.id} className={`text-sm ${u.role === 'Admin' ? 'bg-yellow-50 border-yellow-200' : ''}`}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-1">
                              {getUserDisplayName(u.email || '')}
                              {u.role === 'Admin' && <span className="text-yellow-600" title="Admin User">👑</span>}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-gray-900">{cleanCorruptedData(u.email || '')}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              u.role === 'Admin' ? 'bg-yellow-100 text-yellow-800 font-bold' :
                              u.role === 'SubAdmin' ? 'bg-blue-100 text-blue-800' :
                              u.role === 'Account Manager' ? 'bg-green-100 text-green-800' :
                              u.role === 'Sales' ? 'bg-purple-100 text-purple-800' :
                              u.role === 'Operations' ? 'bg-orange-100 text-orange-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {u.role || 'Pending'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              u.status === 'Active' ? 'bg-green-100 text-green-800' : 
                              u.status === 'Inactive' ? 'bg-red-100 text-red-800' : 
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {u.status || 'Inactive'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {u.defaultPassword ? (
                              <div className="flex items-center gap-2">
                                <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">
                                  {u.defaultPassword}
                                </code>
                                <button
                                  onClick={() => navigator.clipboard.writeText(u.defaultPassword!)}
                                  className="text-xs text-blue-600 hover:text-blue-800"
                                  title="Copy password"
                                >
                                  📋
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="text-red-500 text-xs font-medium">❌ No password set</span>
                                <button
                                  onClick={() => fixUserPassword(u)}
                                  className="text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700"
                                  title="Fix password"
                                >
                                  🔧 Fix
                                </button>
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => updateUser(u.id, { status: u.status === 'Active' ? 'Inactive' : 'Active' })}
                                className={`px-2 py-1 text-xs rounded ${
                                  u.status === 'Active' 
                                    ? 'bg-red-100 text-red-800 hover:bg-red-200' 
                                    : 'bg-green-100 text-green-800 hover:bg-green-200'
                                }`}
                              >
                                {u.status === 'Active' ? 'Deactivate' : 'Activate'}
                              </button>
                              <button
                                onClick={() => resetUserPassword(u)}
                                className="px-2 py-1 text-xs bg-orange-600 text-white rounded hover:bg-orange-700"
                              >
                                Reset Password
                              </button>
                              <button
                                onClick={() => editUserRole(u)}
                                className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                                title="Edit user role"
                              >
                                ✏️ Edit Role
                              </button>
                              <button onClick={() => loginAsUser(u)} className="px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700" title="Login as this user">
                                🎭 Login as User
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="text-xs text-slate-500">
            Tip: Use the lists above to manage active users and approve pending ones.
          </div>
        </div>
      )}

      {/* Cost Calculator Tab */}
      {activeTab === 'costs' && (
        <div>
          <div className="p-4 text-center">
            <h3 className="text-lg font-semibold text-gray-600">Cost Calculator</h3>
            <p className="text-sm text-gray-500 mt-2">Coming soon...</p>
          </div>
        </div>
      )}

      {/* Company Management Tab */}
      {activeTab === 'company-management' && (
        <div>
          {console.log('🏢 Company Management tab is rendering!')}
          <CompanyManagement />
        </div>
      )}

      {/* User Usage Tracker Tab */}
      {activeTab === 'usage' && (
        <div>
          <div className="p-4 text-center">
            <h3 className="text-lg font-semibold text-gray-600">User Usage Tracker</h3>
            <p className="text-sm text-gray-500 mt-2">Coming soon...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUsers;