import React, { useState, useEffect } from 'react';
import apiClient from '../services/apiClient';
import type { Lead, User } from '../types';

interface UserProfileProps {
  userEmail: string;
  onClose: () => void;
  onLogout?: () => void;
  userRole?: string;
  leads?: Lead[];
  availableUsers?: User[];
}

// --- Helper functions for training content Generation ---

const getOverviewContent = (userRole: string, leads: any[], availableUsers: any[]) => {
  // 🟢 SAFE FIX: Handle potential undefined arrays
  const safeLeads = Array.isArray(leads) ? leads : [];
  const safeUsers = Array.isArray(availableUsers) ? availableUsers : [];
  const sampleFollowUps = safeLeads.flatMap(lead => lead.followUps || []).slice(0, 5);

  return `
    <div class="space-y-8">
      <div class="bg-gradient-to-r from-blue-50 to-indigo-50 p-8 rounded-xl border border-blue-200">
        <h3 class="text-2xl font-bold text-blue-800 mb-4">Welcome to Canam Marketing CRM</h3>
        <p class="text-blue-700 text-lg leading-relaxed">
          This comprehensive training guide will help you master all aspects of our CRM system. 
          Each section includes real examples from your current data to provide practical learning.
        </p>
      </div>

      <div class="grid lg:grid-cols-2 gap-8">
        <div class="bg-white p-8 border rounded-xl shadow-sm">
          <h4 class="text-xl font-semibold text-gray-800 mb-4">🏗️ System Architecture</h4>
          <ul class="text-gray-600 space-y-3">
            <li class="flex items-center"><span class="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>Cloud-based Firebase backend</li>
            <li class="flex items-center"><span class="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>Real-time data synchronization</li>
            <li class="flex items-center"><span class="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>Mobile-responsive design</li>
            <li class="flex items-center"><span class="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>GPS tracking integration</li>
            <li class="flex items-center"><span class="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>Role-based access control</li>
          </ul>
        </div>

        <div class="bg-white p-8 border rounded-xl shadow-sm">
          <h4 class="text-xl font-semibold text-gray-800 mb-4">🎭 Your Role: ${userRole}</h4>
          <p class="text-gray-600 leading-relaxed">
            Based on your role, you have access to specific features and permissions. 
            This training is customized for your access level and responsibilities.
          </p>
          <div class="mt-4 p-4 bg-gray-50 rounded-lg">
            <p class="text-sm text-gray-500">
              <strong>Current Access:</strong> ${userRole} permissions allow you to view and manage 
              relevant sections of the CRM system.
            </p>
          </div>
        </div>
      </div>

      <div class="bg-gradient-to-r from-yellow-50 to-orange-50 p-8 rounded-xl border border-yellow-200">
        <h4 class="text-xl font-semibold text-yellow-800 mb-6">📊 Current System Statistics</h4>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div class="text-center p-6 bg-white rounded-lg shadow-sm">
            <div class="text-4xl font-bold text-yellow-700 mb-2">${safeLeads.length}</div>
            <div class="text-sm text-yellow-600 font-medium">Total Leads</div>
            <div class="text-xs text-gray-500 mt-1">Active in system</div>
          </div>
          <div class="text-center p-6 bg-white rounded-lg shadow-sm">
            <div class="text-4xl font-bold text-yellow-700 mb-2">${safeUsers.length}</div>
            <div class="text-sm text-yellow-600 font-medium">Team Members</div>
            <div class="text-xs text-gray-500 mt-1">Registered users</div>
          </div>
          <div class="text-center p-6 bg-white rounded-lg shadow-sm">
            <div class="text-4xl font-bold text-yellow-700 mb-2">${sampleFollowUps.length}</div>
            <div class="text-sm text-yellow-600 font-medium">Active Follow-ups</div>
            <div class="text-xs text-gray-500 mt-1">Pending actions</div>
          </div>
        </div>
      </div>
    </div>
  `;
};

const getLeadsContent = () => {
  return `
    <div class="space-y-8">
      <div class="bg-gradient-to-r from-green-50 to-emerald-50 p-8 rounded-xl border border-green-200">
        <h3 class="text-2xl font-bold text-green-800 mb-4">Leads Management Overview</h3>
        <p class="text-green-700 text-lg leading-relaxed">
          Leads are your primary business prospects. Each lead represents an agency or partner 
          you're working with to generate student applications.
        </p>
      </div>

      <div class="grid lg:grid-cols-2 gap-8">
        <div>
          <h4 class="text-xl font-semibold text-gray-800 mb-6">📋 Lead Status Types</h4>
          <div class="space-y-3">
            <div class="flex items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <span class="w-3 h-3 bg-blue-500 rounded-full mr-4"></span>
              <span class="text-gray-700 font-medium">New</span>
            </div>
            <div class="flex items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <span class="w-3 h-3 bg-blue-500 rounded-full mr-4"></span>
              <span class="text-gray-700 font-medium">In Pipeline</span>
            </div>
            <div class="flex items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <span class="w-3 h-3 bg-blue-500 rounded-full mr-4"></span>
              <span class="text-gray-700 font-medium">Onboarded</span>
            </div>
            <div class="flex items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <span class="w-3 h-3 bg-blue-500 rounded-full mr-4"></span>
              <span class="text-gray-700 font-medium">Lost</span>
            </div>
          </div>
        </div>

        <div>
          <h4 class="text-xl font-semibold text-gray-800 mb-6">🏆 Agent Categories</h4>
          <div class="space-y-3">
            <div class="flex items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <span class="w-3 h-3 bg-yellow-500 rounded-full mr-4"></span>
              <span class="text-gray-700 font-medium">Platinum</span>
            </div>
            <div class="flex items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <span class="w-3 h-3 bg-yellow-500 rounded-full mr-4"></span>
              <span class="text-gray-700 font-medium">Diamond</span>
            </div>
            <div class="flex items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <span class="w-3 h-3 bg-yellow-500 rounded-full mr-4"></span>
              <span class="text-gray-700 font-medium">Gold</span>
            </div>
            <div class="flex items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <span class="w-3 h-3 bg-yellow-500 rounded-full mr-4"></span>
              <span class="text-gray-700 font-medium">Silver</span>
            </div>
          </div>
        </div>
      </div>

      <div class="bg-blue-50 p-8 rounded-xl border border-blue-200">
        <h4 class="text-xl font-semibold text-blue-800 mb-4">✅ Lead Management Best Practices</h4>
        <ul class="text-blue-700 space-y-2">
          <li class="flex items-start"><span class="w-2 h-2 bg-blue-500 rounded-full mr-3 mt-2 flex-shrink-0"></span>Always add complete contact information</li>
          <li class="flex items-start"><span class="w-2 h-2 bg-blue-500 rounded-full mr-3 mt-2 flex-shrink-0"></span>Update status regularly to reflect current relationship</li>
          <li class="flex items-start"><span class="w-2 h-2 bg-blue-500 rounded-full mr-3 mt-2 flex-shrink-0"></span>Assign appropriate agent category based on performance</li>
          <li class="flex items-start"><span class="w-2 h-2 bg-blue-500 rounded-full mr-3 mt-2 flex-shrink-0"></span>Use tags to categorize leads (e.g., "High Potential", "UK Specialist")</li>
          <li class="flex items-start"><span class="w-2 h-2 bg-blue-500 rounded-full mr-3 mt-2 flex-shrink-0"></span>Keep contact details updated and verified</li>
        </ul>
      </div>
    </div>
  `;
};

const getFollowupsContent = () => {
  return `
    <div class="space-y-8">
      <div class="bg-gradient-to-r from-orange-50 to-red-50 p-8 rounded-xl border border-orange-200">
        <h3 class="text-2xl font-bold text-orange-800 mb-4">Follow-ups & Meeting Management</h3>
        <p class="text-orange-700 text-lg leading-relaxed">
          Follow-ups are crucial for maintaining relationships with your leads. Track calls, meetings, 
          and emails to ensure consistent communication and progress tracking.
        </p>
      </div>

      <div class="grid lg:grid-cols-3 gap-8">
        <div class="bg-white p-6 border rounded-xl shadow-sm">
          <h4 class="text-lg font-semibold text-gray-800 mb-4">📞 Follow-up Types</h4>
          <div class="space-y-3">
            <div class="flex items-center p-3 bg-gray-50 rounded-lg">
              <span class="w-3 h-3 bg-blue-500 rounded-full mr-3"></span>
              <span class="text-gray-700 font-medium">Call</span>
            </div>
            <div class="flex items-center p-3 bg-gray-50 rounded-lg">
              <span class="w-3 h-3 bg-blue-500 rounded-full mr-3"></span>
              <span class="text-gray-700 font-medium">Meeting</span>
            </div>
            <div class="flex items-center p-3 bg-gray-50 rounded-lg">
              <span class="w-3 h-3 bg-blue-500 rounded-full mr-3"></span>
              <span class="text-gray-700 font-medium">Email</span>
            </div>
          </div>
        </div>

        <div class="bg-white p-6 border rounded-xl shadow-sm">
          <h4 class="text-lg font-semibold text-gray-800 mb-4">📊 Follow-up Status</h4>
          <div class="space-y-3">
            <div class="flex items-center p-3 bg-gray-50 rounded-lg">
              <span class="w-3 h-3 bg-yellow-500 rounded-full mr-3"></span>
              <span class="text-gray-700 font-medium">Planned</span>
            </div>
            <div class="flex items-center p-3 bg-gray-50 rounded-lg">
              <span class="w-3 h-3 bg-green-500 rounded-full mr-3"></span>
              <span class="text-gray-700 font-medium">Done</span>
            </div>
          </div>
        </div>

        <div class="bg-white p-6 border rounded-xl shadow-sm">
          <h4 class="text-lg font-semibold text-gray-800 mb-4">📅 Meeting Features</h4>
          <div class="space-y-2">
            <div class="text-sm text-gray-600">• Meeting check-in/out</div>
            <div class="text-sm text-gray-600">• Photo uploads</div>
            <div class="text-sm text-gray-600">• GPS location tracking</div>
            <div class="text-sm text-gray-600">• Duration tracking</div>
            <div class="text-sm text-gray-600">• Meeting outcomes</div>
          </div>
        </div>
      </div>

      <div class="bg-green-50 p-8 rounded-xl border border-green-200">
        <h4 class="text-xl font-semibold text-green-800 mb-4">✅ Follow-up Best Practices</h4>
        <ul class="text-green-700 space-y-2">
          <li class="flex items-start"><span class="w-2 h-2 bg-green-500 rounded-full mr-3 mt-2 flex-shrink-0"></span>Schedule follow-ups immediately after initial contact</li>
          <li class="flex items-start"><span class="w-2 h-2 bg-green-500 rounded-full mr-3 mt-2 flex-shrink-0"></span>Use different types (Call/Meeting/Email) based on context</li>
          <li class="flex items-start"><span class="w-2 h-2 bg-green-500 rounded-full mr-3 mt-2 flex-shrink-0"></span>Always add detailed notes about the conversation</li>
          <li class="flex items-start"><span class="w-2 h-2 bg-green-500 rounded-full mr-3 mt-2 flex-shrink-0"></span>Mark follow-ups as "Done" when completed</li>
          <li class="flex items-start"><span class="w-2 h-2 bg-green-500 rounded-full mr-3 mt-2 flex-shrink-0"></span>Use meeting check-in for in-person meetings</li>
        </ul>
      </div>
    </div>
  `;
};

const getSOPContent = () => {
  return `
    <div class="space-y-8">
      <div class="bg-gradient-to-r from-emerald-50 to-teal-50 p-8 rounded-xl border border-emerald-200">
        <h3 class="text-2xl font-bold text-emerald-800 mb-4">Standard Operating Procedures (SOPs)</h3>
        <p class="text-emerald-700 text-lg leading-relaxed">
          Comprehensive procedures for common CRM tasks. Follow these SOPs to ensure consistency 
          and best practices across the organization.
        </p>
      </div>

      <div class="space-y-8">
        <div class="bg-white border-2 border-gray-200 rounded-xl p-8">
          <h4 class="text-xl font-semibold text-gray-800 mb-6">📝 Adding a New Lead</h4>
          <ol class="space-y-4">
            <li class="flex items-start">
              <span class="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold mr-4 mt-0.5">1</span>
              <span class="text-gray-700 leading-relaxed">Click 'Add Lead' button from the leads dashboard</span>
            </li>
            <li class="flex items-start">
              <span class="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold mr-4 mt-0.5">2</span>
              <span class="text-gray-700 leading-relaxed">Fill in agency name (required)</span>
            </li>
            <li class="flex items-start">
              <span class="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold mr-4 mt-0.5">3</span>
              <span class="text-gray-700 leading-relaxed">Add primary contact information (name, phone, email required)</span>
            </li>
            <li class="flex items-start">
              <span class="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold mr-4 mt-0.5">4</span>
              <span class="text-gray-700 leading-relaxed">Select appropriate agent category (Platinum, Diamond, Gold, Silver, Bronze, Beginner)</span>
            </li>
            <li class="flex items-start">
              <span class="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold mr-4 mt-0.5">5</span>
              <span class="text-gray-700 leading-relaxed">Choose lead status (default: New)</span>
            </li>
            <li class="flex items-start">
              <span class="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold mr-4 mt-0.5">6</span>
              <span class="text-gray-700 leading-relaxed">Add any relevant tags</span>
            </li>
            <li class="flex items-start">
              <span class="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold mr-4 mt-0.5">7</span>
              <span class="text-gray-700 leading-relaxed">Assign account manager and sales person if applicable</span>
            </li>
            <li class="flex items-start">
              <span class="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold mr-4 mt-0.5">8</span>
              <span class="text-gray-700 leading-relaxed">Save the lead</span>
            </li>
          </ol>
        </div>

        <div class="bg-white border-2 border-gray-200 rounded-xl p-8">
          <h4 class="text-xl font-semibold text-gray-800 mb-6">📞 Scheduling a Follow-up</h4>
          <ol class="space-y-4">
            <li class="flex items-start">
              <span class="flex-shrink-0 w-8 h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-sm font-bold mr-4 mt-0.5">1</span>
              <span class="text-gray-700 leading-relaxed">Open the lead details from the leads list</span>
            </li>
            <li class="flex items-start">
              <span class="flex-shrink-0 w-8 h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-sm font-bold mr-4 mt-0.5">2</span>
              <span class="text-gray-700 leading-relaxed">Navigate to the Follow-ups tab</span>
            </li>
            <li class="flex items-start">
              <span class="flex-shrink-0 w-8 h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-sm font-bold mr-4 mt-0.5">3</span>
              <span class="text-gray-700 leading-relaxed">Click 'Add Follow-up' button</span>
            </li>
            <li class="flex items-start">
              <span class="flex-shrink-0 w-8 h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-sm font-bold mr-4 mt-0.5">4</span>
              <span class="text-gray-700 leading-relaxed">Select follow-up type (Call, Meeting, Email)</span>
            </li>
            <li class="flex items-start">
              <span class="flex-shrink-0 w-8 h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-sm font-bold mr-4 mt-0.5">5</span>
              <span class="text-gray-700 leading-relaxed">Set date and time</span>
            </li>
            <li class="flex items-start">
              <span class="flex-shrink-0 w-8 h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-sm font-bold mr-4 mt-0.5">6</span>
              <span class="text-gray-700 leading-relaxed">Add detailed notes about the planned interaction</span>
            </li>
            <li class="flex items-start">
              <span class="flex-shrink-0 w-8 h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-sm font-bold mr-4 mt-0.5">7</span>
              <span class="text-gray-700 leading-relaxed">Assign to appropriate team member</span>
            </li>
            <li class="flex items-start">
              <span class="flex-shrink-0 w-8 h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-sm font-bold mr-4 mt-0.5">8</span>
              <span class="text-gray-700 leading-relaxed">Save the follow-up</span>
            </li>
          </ol>
        </div>
      </div>

      <div class="bg-blue-50 p-8 rounded-xl border border-blue-200">
        <h4 class="text-xl font-semibold text-blue-800 mb-4">📋 SOP Compliance Guidelines</h4>
        <ul class="text-blue-700 space-y-2">
          <li class="flex items-start"><span class="w-2 h-2 bg-blue-500 rounded-full mr-3 mt-2 flex-shrink-0"></span>Always follow SOPs for consistent data quality</li>
          <li class="flex items-start"><span class="w-2 h-2 bg-blue-500 rounded-full mr-3 mt-2 flex-shrink-0"></span>Update SOPs when processes change</li>
          <li class="flex items-start"><span class="w-2 h-2 bg-blue-500 rounded-full mr-3 mt-2 flex-shrink-0"></span>Train new team members on relevant SOPs</li>
          <li class="flex items-start"><span class="w-2 h-2 bg-blue-500 rounded-full mr-3 mt-2 flex-shrink-0"></span>Document any deviations with reasons</li>
          <li class="flex items-start"><span class="w-2 h-2 bg-blue-500 rounded-full mr-3 mt-2 flex-shrink-0"></span>Review SOPs quarterly for improvements</li>
        </ul>
      </div>
    </div>
  `;
};

// --- Component Implementation ---

export const UserProfile: React.FC<UserProfileProps> = ({ 
  userEmail, 
  onClose, 
  onLogout, 
  userRole = '', 
  leads = [], 
  availableUsers = [] 
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'password' | 'preferences'>('profile');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Profile fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [profilePictureFile, setProfilePictureFile] = useState<File | null>(null);
  
  // Password fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Preferences
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(false);
  
  // Default password
  const [defaultPassword, setDefaultPassword] = useState<string | null>(null);
  const [customPassword, setCustomPassword] = useState<string | null>(null);
  const [showDefaultPassword, setShowDefaultPassword] = useState(false);
  const [showCustomPassword, setShowCustomPassword] = useState(false);

  const [userId, setUserId] = useState<string | null>(null);

  React.useEffect(() => {
    const loadUserData = async () => {
      try {
        if (!userEmail) return;
        const { data: userData } = await apiClient.get('/users/by-email/' + encodeURIComponent(userEmail));
        if (userData && (userData as any).id) {
          const u = userData as any;
          setUserId(u.id);
          setName(u.name || '');
          setPhone(u.phone || '');
          setRole(u.role || '');
          setStatus(u.status || '');
          setProfilePicture(u.profile_picture || null);
          setEmailNotifications(u.email_notifications !== false);
          setSmsNotifications(u.sms_notifications === true);
          setDefaultPassword(u.default_password ?? u.defaultPassword ?? null);
          setCustomPassword(u.custom_password ?? u.customPassword ?? null);
        }
        const { data: prefs } = await apiClient.get('/preferences/' + encodeURIComponent(userEmail)).catch(() => ({ data: null }));
        if (prefs && (prefs as any).enabled !== undefined) {
          setEmailNotifications((prefs as any).enabled !== false);
        }
      } catch (error) {
        console.error('Error loading user data:', error);
      }
    };
    loadUserData();
  }, [userEmail]);

  const handleProfilePictureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB limit
        setError('Profile picture must be less than 2MB');
        return;
      }
      if (!file.type.startsWith('image/')) {
        setError('Please select a valid image file');
        return;
      }
      
      setProfilePictureFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setProfilePicture(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpdateProfile = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const id = userId || userEmail;
      if (id) {
        const payload: Record<string, any> = { name, phone };
        if (profilePictureFile) {
          const base64 = await new Promise<string>((res, rej) => {
            const reader = new FileReader();
            reader.onload = () => res(reader.result as string);
            reader.onerror = rej;
            reader.readAsDataURL(profilePictureFile!);
          });
          payload.profile_picture = base64;
        }
        await apiClient.put('/users/' + id, payload);
        await apiClient.post('/preferences/save', {
          userId: userEmail,
          enabled: emailNotifications,
          sound: true,
          vibrate: false,
          categories: {},
        });
      }
      setSuccess('Profile updated successfully!');
    } catch (error: any) {
      setError(error?.response?.data?.message || error.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleClearCache = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      console.log('🧹 Starting comprehensive cache clear...');
      
      localStorage.clear();
      console.log('✅ localStorage cleared');
      
      sessionStorage.clear();
      console.log('✅ sessionStorage cleared');
      
      if ('indexedDB' in window) {
        try {
          const databases = await indexedDB.databases();
          await Promise.all(
            databases.map(db => {
              if (db.name) {
                return indexedDB.deleteDatabase(db.name);
              }
            })
          );
          console.log('✅ IndexedDB cleared');
        } catch (indexedError) {
          console.warn('⚠️ IndexedDB clear failed:', indexedError);
        }
      }
      
      if ('caches' in window) {
        try {
          const cacheNames = await caches.keys();
          await Promise.all(
            cacheNames.map(cacheName => caches.delete(cacheName))
          );
          console.log('✅ Cache API cleared');
        } catch (cacheError) {
          console.warn('⚠️ Cache API clear failed:', cacheError);
        }
      }
      
      if ('serviceWorker' in navigator) {
        try {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(
            registrations.map(registration => registration.unregister())
          );
          console.log('✅ Service workers unregistered');
        } catch (swError) {
          console.warn('⚠️ Service worker unregister failed:', swError);
        }
      }
      
      setSuccess('Cache cleared successfully! The app will reload in 3 seconds...');
      
      setTimeout(() => {
        window.location.reload();
      }, 3000);
      
    } catch (error: any) {
      console.error('❌ Cache clear error:', error);
      setError('Failed to clear cache: ' + (error.message || 'Unknown error'));
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      setLoading(false);
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long');
      setLoading(false);
      return;
    }

    try {
      const res = await apiClient.post('/password/change', {
        email: userEmail,
        currentPassword,
        newPassword,
      });
      if ((res.data as any)?.success) {
        setSuccess('Password updated successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setError((res.data as any)?.message || 'Failed to change password');
      }
    } catch (error: any) {
      const msg = error?.response?.data?.message || error.message || 'Failed to change password';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSetInitialPassword = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long');
      setLoading(false);
      return;
    }

    try {
      await apiClient.post('/password/set-initial', {
        email: userEmail,
        newPassword,
      });
      setSuccess('Password set successfully! You can now login with email/password.');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      console.error('Error setting password:', error);
      setError(error.message || 'Failed to set password');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    }
    onClose();
  };

  const switchBackToAdmin = () => {
    const originalAdmin = localStorage.getItem('originalAdmin');
    if (originalAdmin) {
      if (confirm('Are you sure you want to switch back to admin?')) {
        const adminUserObject = {
          email: originalAdmin.toLowerCase(),
          id: originalAdmin.toLowerCase(),
          name: originalAdmin.split('@')[0],
          role: 'SuperAdmin',
          approved: true,
          status: 'Active',
          signup_method: 'google',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        localStorage.setItem('crmUser', JSON.stringify(adminUserObject));
        localStorage.removeItem('originalAdmin');
        window.location.reload();
      }
    } else {
      alert('No admin account found to switch back to. Please logout and login as admin again.');
    }
  };

  // 🟢 SAFE FIX: Direct window opening to prevent URL length issues with large datasets
  const handleOpenTraining = () => {
      // Create HTML content directly rather than passing via URL parameters
      const htmlContent = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>CRM Training & User Manual</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            body { font-family: 'Inter', sans-serif; margin: 0; padding: 0; background: #f8fafc; }
            .training-header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 2rem 0; }
            .training-content { max-width: 1200px; margin: 0 auto; padding: 2rem; }
            .nav-item { transition: all 0.2s; }
            .nav-item:hover { transform: translateX(4px); }
          </style>
        </head>
        <body>
          <div class="training-header">
            <div class="max-w-6xl mx-auto px-6">
              <h1 class="text-4xl font-bold mb-2">📚 CRM Training & User Manual</h1>
              <p class="text-lg opacity-90">Comprehensive training guide for ${userRole} role • ${new Date().toLocaleDateString()}</p>
            </div>
          </div>
          
          <div class="training-content">
            <div class="grid lg:grid-cols-4 gap-8">
              <div class="lg:col-span-1">
                <div class="bg-white rounded-xl shadow-sm border p-6 sticky top-6">
                  <h3 class="text-lg font-semibold text-gray-800 mb-6">Training Sections</h3>
                  <nav class="space-y-2">
                    <button onclick="showSection('overview')" class="nav-item w-full text-left px-4 py-3 rounded-lg text-sm bg-blue-100 text-blue-800 font-medium">🎯 CRM Overview & Navigation</button>
                    <button onclick="showSection('leads')" class="nav-item w-full text-left px-4 py-3 rounded-lg text-sm text-gray-600 hover:bg-gray-100">🌐 Leads Management</button>
                    <button onclick="showSection('followups')" class="nav-item w-full text-left px-4 py-3 rounded-lg text-sm text-gray-600 hover:bg-gray-100">📞 Follow-ups & Meetings</button>
                    <button onclick="showSection('sop')" class="nav-item w-full text-left px-4 py-3 rounded-lg text-sm text-gray-600 hover:bg-gray-100">📋 Standard Operating Procedures</button>
                  </nav>
                </div>
              </div>
              
              <div class="lg:col-span-3">
                <div class="bg-white rounded-xl shadow-sm border">
                  <div class="p-8" id="training-content">
                    ${getOverviewContent(userRole, leads || [], availableUsers || [])}
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <script>
            // Client-side navigation logic
            function showSection(section) {
              const content = document.getElementById('training-content');
              // Reset nav styles
              document.querySelectorAll('nav button').forEach(btn => {
                btn.className = btn.className.replace('bg-blue-100 text-blue-800 font-medium', 'text-gray-600 hover:bg-gray-100');
              });
              // Set active style
              event.target.className = event.target.className.replace('text-gray-600 hover:bg-gray-100', 'bg-blue-100 text-blue-800 font-medium');
              
              // Update content based on section
              switch(section) {
                case 'overview': content.innerHTML = \`${getOverviewContent(userRole, leads || [], availableUsers || [])}\`; break;
                case 'leads': content.innerHTML = \`${getLeadsContent()}\`; break;
                case 'followups': content.innerHTML = \`${getFollowupsContent()}\`; break;
                case 'sop': content.innerHTML = \`${getSOPContent()}\`; break;
                default: content.innerHTML = '<div class="text-center py-12">Section coming soon...</div>';
              }
            }
          </script>
        </body>
        </html>
      `;

      // Open new window
      const newWindow = window.open('', '_blank', `fullscreen=yes,scrollbars=yes,resizable=yes,width=${screen.width},height=${screen.height}`);
      if (newWindow) {
        newWindow.document.write(htmlContent);
        newWindow.document.close();
      } else {
        alert("Please allow popups to view the training manual.");
      }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h2 className="text-lg sm:text-xl font-semibold text-blue-800">User Profile & Settings</h2>
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <button
                onClick={handleClearCache}
                disabled={loading}
                className="flex items-center justify-center gap-2 px-4 py-3 sm:py-2 text-sm font-medium text-white bg-orange-500 rounded-md hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors w-full sm:w-auto"
                title="Clear all app cache and reload"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                {loading ? 'Clearing...' : 'Clear Cache'}
              </button>
              
              <div className="flex items-center gap-2">
                {localStorage.getItem('originalAdmin') && (
                  <button
                    onClick={switchBackToAdmin}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-purple-600 bg-purple-50 rounded-md hover:bg-purple-100"
                    title="Switch back to admin account"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                    <span className="hidden sm:inline">Switch Back to Admin</span>
                    <span className="sm:hidden">Switch</span>
                  </button>
                )}
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100"
                  title="Logout"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span className="hidden sm:inline">Logout</span>
                </button>
                <button
                  onClick={onClose}
                  className="text-slate-400 hover:text-slate-600 p-2"
                  title="Close"
                >
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b overflow-x-auto">
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-6 py-3 text-sm font-medium whitespace-nowrap ${
              activeTab === 'profile'
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Profile
          </button>
          <button
            onClick={() => setActiveTab('password')}
            className={`px-6 py-3 text-sm font-medium whitespace-nowrap ${
              activeTab === 'password'
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Password
          </button>
          <button
            onClick={() => setActiveTab('preferences')}
            className={`px-6 py-3 text-sm font-medium whitespace-nowrap ${
              activeTab === 'preferences'
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Preferences
          </button>
          <button
            onClick={handleOpenTraining}
            className="px-6 py-3 text-sm font-medium text-slate-500 hover:text-slate-700 hover:bg-blue-50 transition-colors whitespace-nowrap"
          >
            📚 CRM TRAINING
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-600">
              {error}
            </div>
          )}
          
          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-600">
              {success}
            </div>
          )}

          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-blue-800">Profile Information</h3>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={userEmail}
                  disabled
                  className="w-full px-3 py-2 border border-slate-300 rounded-md bg-slate-50 text-slate-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Enter your mobile number"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Profile Picture</label>
                <div className="flex items-center gap-4">
                  {profilePicture && (
                    <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-slate-200">
                      <img 
                        src={profilePicture} 
                        alt="Profile" 
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleProfilePictureChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <p className="text-xs text-slate-500 mt-1">Max size: 2MB. Supported formats: JPG, PNG, GIF</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                  <input
                    type="text"
                    value={role}
                    disabled
                    className="w-full px-3 py-2 border border-slate-300 rounded-md bg-slate-50 text-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                  <input
                    type="text"
                    value={status}
                    disabled
                    className="w-full px-3 py-2 border border-slate-300 rounded-md bg-slate-50 text-slate-500"
                  />
                </div>
              </div>

              <button
                onClick={handleUpdateProfile}
                disabled={loading}
                className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading ? 'Updating...' : 'Update Profile'}
              </button>
            </div>
          )}

          {/* Password Tab */}
          {activeTab === 'password' && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-blue-800">Password Management</h3>
              
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> You can set or change your custom password here. This will allow you to login using your email and password instead of Google. You can also use your system default password (shown above) to login.
                </p>
              </div>

              {/* Default Password Section */}
              {defaultPassword && (
                <div className="bg-green-50 border border-green-200 rounded-md p-4">
                  <h4 className="text-sm font-medium text-green-800 mb-2">🔑 System Default Password</h4>
                  <p className="text-sm text-green-700 mb-3">
                    You can use this default password to login with your email address:
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-white border border-green-300 rounded-md p-2">
                      <code className="text-sm font-mono text-green-800">
                        {showDefaultPassword ? defaultPassword : '••••••••••••'}
                      </code>
                    </div>
                    <button
                      onClick={() => setShowDefaultPassword(!showDefaultPassword)}
                      className="px-3 py-2 text-sm font-medium text-green-700 bg-green-100 border border-green-300 rounded-md hover:bg-green-200"
                    >
                      {showDefaultPassword ? 'Hide' : 'Show'}
                    </button>
                    <button
                      onClick={() => navigator.clipboard.writeText(defaultPassword)}
                      className="px-3 py-2 text-sm font-medium text-green-700 bg-green-100 border border-green-300 rounded-md hover:bg-green-200"
                      title="Copy to clipboard"
                    >
                      📋 Copy
                    </button>
                  </div>
                  <p className="text-xs text-green-600 mt-2">
                    💡 You can use this password along with your email to login to the system.
                  </p>
                </div>
              )}

              {/* Custom Password Section */}
              {customPassword && (
                <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                  <h4 className="text-sm font-medium text-blue-800 mb-2">🔐 Your Custom Password</h4>
                  <p className="text-sm text-blue-700 mb-3">
                    You have set a custom password. You can use this to login:
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-white border border-blue-300 rounded-md p-2">
                      <code className="text-sm font-mono text-blue-800">
                        {showCustomPassword ? customPassword : '••••••••••••'}
                      </code>
                    </div>
                    <button
                      onClick={() => setShowCustomPassword(!showCustomPassword)}
                      className="px-3 py-2 text-sm font-medium text-blue-700 bg-blue-100 border border-blue-300 rounded-md hover:bg-blue-200"
                    >
                      {showCustomPassword ? 'Hide' : 'Show'}
                    </button>
                    <button
                      onClick={() => navigator.clipboard.writeText(customPassword)}
                      className="px-3 py-2 text-sm font-medium text-blue-700 bg-blue-100 border border-blue-300 rounded-md hover:bg-blue-200"
                      title="Copy to clipboard"
                    >
                      📋 Copy
                    </button>
                  </div>
                  <p className="text-xs text-blue-600 mt-2">
                    💡 This is your personal password that you set. You can change it below.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Current Password (if you have one)</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Leave empty if setting password for the first time"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={currentPassword ? handleChangePassword : handleSetInitialPassword}
                  disabled={loading || !newPassword || !confirmPassword}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                >
                  {loading ? 'Processing...' : currentPassword ? 'Change Password' : 'Set Password'}
                </button>
              </div>
            </div>
          )}

          {/* Preferences Tab */}
          {activeTab === 'preferences' && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-blue-800">Notification Preferences</h3>
              
              {/* Notification Settings Section */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-4">
                <h4 className="text-base font-semibold text-slate-900">App Notifications</h4>
                
                {/* Allow Notifications Toggle */}
                <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-slate-200">
                  <div className="flex-1">
                    <label className="text-sm font-medium text-slate-900">Allow notifications</label>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={emailNotifications}
                      onChange={(e) => setEmailNotifications(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                {/* Notification Style */}
                {emailNotifications && (
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-slate-700">Notification style</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        className={`p-3 rounded-lg border-2 transition-colors ${
                          emailNotifications
                            ? 'border-indigo-600 bg-indigo-50'
                            : 'border-slate-200 bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                          </svg>
                          <div className="text-left">
                            <div className="text-sm font-medium text-slate-900">Default</div>
                            <div className="text-xs text-slate-500">May ring or vibrate</div>
                          </div>
                        </div>
                      </button>
                      <button
                        className={`p-3 rounded-lg border-2 transition-colors ${
                          !emailNotifications
                            ? 'border-indigo-600 bg-indigo-50'
                            : 'border-slate-200 bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                          </svg>
                          <div className="text-left">
                            <div className="text-sm font-medium text-slate-900">Silent</div>
                            <div className="text-xs text-slate-500">No sound</div>
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>
                )}

                {/* Alerts Section */}
                {emailNotifications && (
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-slate-700">Alerts</label>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-16 h-20 bg-slate-100 rounded-lg border border-slate-200 flex items-start justify-center p-2">
                          <div className="w-full h-2 bg-indigo-600 rounded"></div>
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={true}
                            readOnly
                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 rounded"
                          />
                          <span className="text-xs text-slate-700">Lock screen</span>
                        </label>
                      </div>
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-16 h-20 bg-slate-100 rounded-lg border border-slate-200 flex items-start justify-center p-2">
                          <div className="w-full h-2 bg-indigo-600 rounded"></div>
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={true}
                            readOnly
                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 rounded"
                          />
                          <span className="text-xs text-slate-700">Pop-up</span>
                        </label>
                      </div>
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-16 h-20 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center p-2">
                          <div className="w-8 h-8 bg-slate-200 rounded relative">
                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></div>
                          </div>
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={true}
                            readOnly
                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 rounded"
                          />
                          <span className="text-xs text-slate-700">Badges</span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Legacy Email/SMS Notifications */}
              <div className="space-y-4">
                <h4 className="text-base font-semibold text-slate-900">Other Preferences</h4>
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-slate-700">Email Notifications</label>
                    <p className="text-xs text-slate-500">Receive notifications via email</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={emailNotifications}
                    onChange={(e) => setEmailNotifications(e.target.checked)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 rounded"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-slate-700">SMS Notifications</label>
                    <p className="text-xs text-slate-500">Receive notifications via SMS</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={smsNotifications}
                    onChange={(e) => setSmsNotifications(e.target.checked)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 rounded"
                  />
                </div>
              </div>

              <button
                onClick={handleUpdateProfile}
                disabled={loading}
                className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading ? 'Updating...' : 'Update Preferences'}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};