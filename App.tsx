import React, { useState, useMemo, useEffect, useCallback, lazy, Suspense } from 'react';
import { ItineraryForm as LeadsDashboard } from './components/ItineraryForm';
import { ItineraryDisplay as MeetingPlanner } from './components/ItineraryDisplay';
import { Reports } from './components/Reports';
import AttendanceTracker from './components/AttendanceTracker';

const FollowUps = lazy(() => import('./components/FollowUps').then(m => ({ default: m.FollowUps })));
// SQL Services
import { getAllLeads, addLead, updateLead, subscribeToLeads, deleteLead, appendFollowUp } from './services/leadsService';
import { getLeadTags, addLeadTag, subscribeToLeadTags } from './services/leadTagService';
import { 
  subscribeToAttendanceRecords, 
  subscribeToMeetingCheckInRecords, 
  addAttendanceRecord 
} from './services/attendanceService';
import apiClient from './services/apiClient';
import { restoreAuth, logout as authLogout, getStoredUser } from './services/authService';
import { getUserDisplayName as utilGetUserDisplayName } from './utils/dataCleaning';
import type { Lead, AttendanceRecord, MeetingCheckInRecord } from './types';
import { LEAD_STATUSES, AGENT_CATEGORIES, LEAD_SOURCES, COUNTRY_OPTIONS } from './types';

// Components
import { Login } from './components/Login';
import { NotificationBell } from './components/NotificationBell';
import NotificationsCenter from './components/NotificationsCenter';
import AdminUsers from './components/AdminUsers';
import { DatabaseAdmin } from './components/DatabaseAdmin';
import { PendingApproval } from './components/PendingApproval';
import { UserProfile } from './components/UserProfile';
import { AddLeadModal } from './components/AddLeadModal';
import { Modal } from './components/Modal';
import { LeadDetailsModal } from './components/LeadDetailsModal';
import { CallLoggingModal } from './components/CallLoggingModal';
import { CallsReport } from './components/CallsReport';
import { UsageReport } from './components/UsageReport';
import { DataExport } from './components/DataExport';
import TravelClaims from './components/TravelClaims';
import BulkEmailMarketing from './components/BulkEmailMarketing';
import SimpleGoogleMaps from './components/SimpleGoogleMaps';
import { MeetingPhotosAdmin } from './components/MeetingPhotosAdmin';
import { SimpleMeetingCheckIn } from './components/SimpleMeetingCheckIn';
import { PlanMeetingModal } from './components/PlanMeetingModal';
import { ImportLeadsModal } from './components/ImportLeadsModal';
import { ImportResultsModal } from './components/ImportResultsModal';
import WebsiteControlPanel from './components/WebsiteControlPanel';
import Sidebar from './components/Sidebar';
import MobileCacheButton from './components/MobileCacheButton';
import UpdateService from './services/updateService';
import CompletedMeetings from './components/CompletedMeetings';
import WebsiteSignupLeads from './components/WebsiteSignupLeads';
import SuperAdminDashboard from './components/SuperAdminDashboard';
import NotificationSettings from './components/NotificationSettings';
import {
  buildNotifications,
  defaultNotificationPreferences,
  type NotificationPreferences
} from './utils/notifications';
import { pwaNotificationService } from './services/pwaNotificationService';
import SubdomainRouter from './components/SubdomainRouter';
import { useSessionTimeout } from './hooks/useSessionTimeout';

const CONFIGURED_SUPER_ADMINS = ['canamrakesh@gmail.com', 'manchandapranjal01@gmail.com'];
const CONFIGURED_ADMINS = ['qs.iapply@gmail.com', 'rtsolutiontesting@gmail.com'];
const CONFIGURED_SUB_ADMINS = ['qs.iapply@gmail.com'];
const ALL_ADMIN_EMAILS = Array.from(new Set([...CONFIGURED_SUPER_ADMINS, ...CONFIGURED_ADMINS]));

const App: React.FC = () => {
  // --- STATE ---
  const [leads, setLeads] = useState<Lead[]>([]);
  const [view, setView] = useState<string>('leads');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  
  // Modals
  const [isAddLeadModalOpen, setAddLeadModalOpen] = useState(false);
  const [isImportModalOpen, setImportModalOpen] = useState(false);
  const [isNotificationSettingsOpen, setIsNotificationSettingsOpen] = useState(false);
  const [isImportResultsModalOpen, setIsImportResultsModalOpen] = useState(false);
  const [importResults, setImportResults] = useState<{
    successCount: number;
    duplicateCount?: number;
    errorCount: number;
    allResults: Array<{ index: number; agencyName: string; success: boolean; error?: string; isDuplicate?: boolean }>;
    importDate: string;
    importedBy: string;
  } | null>(null);
  const [isPlanMeetingModalOpen, setPlanMeetingModalOpen] = useState(false);
  const [isLeadDetailsModalOpen, setIsLeadDetailsModalOpen] = useState(false);
  const [isUserProfileOpen, setUserProfileOpen] = useState(false); // ✅ Profile Modal State
  const [isCallLoggingModalOpen, setIsCallLoggingModalOpen] = useState(false);
  const [isMeetingCheckInModalOpen, setIsMeetingCheckInModalOpen] = useState(false);
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Data
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [meetingCheckIns, setMeetingCheckIns] = useState<MeetingCheckInRecord[]>([]);
  const [availableUsers, setAvailableUsers] = useState<Array<{id: string, name: string, email: string, role: string}>>([]);
  const [leadTags, setLeadTags] = useState<string[]>([]);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  
  // User & Auth
  const [currentUser, setCurrentUser] = useState<string | null>(() => {
    restoreAuth();
    const u = getStoredUser();
    return u?.email ?? null;
  });
  const [userRole, setUserRole] = useState<string>('User');
  const [isLoadingLeads, setIsLoadingLeads] = useState(false);

  // Notifications
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>(defaultNotificationPreferences);
  const [readNotificationIds, setReadNotificationIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem('crm_read_notification_ids');
      if (raw) {
        const arr = JSON.parse(raw);
        return Array.isArray(arr) ? new Set(arr) : new Set();
      }
    } catch (_) {}
    return new Set();
  });
  useEffect(() => {
    try {
      localStorage.setItem('crm_read_notification_ids', JSON.stringify([...readNotificationIds]));
    } catch (_) {}
  }, [readNotificationIds]);
  const [showSessionTimeoutModal, setShowSessionTimeoutModal] = useState(false);
  const [dismissedNotificationIds, setDismissedNotificationIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem('crm_dismissed_notification_ids');
      if (raw) {
        const arr = JSON.parse(raw);
        return Array.isArray(arr) ? new Set(arr) : new Set();
      }
    } catch (_) {}
    return new Set();
  });

  // --- 1. INITIAL DATA LOADING (SQL) ---
  useEffect(() => {
    if (!currentUser) return;

    // Load Attendance
    const unsubAtt = subscribeToAttendanceRecords(setAttendanceRecords);
    
    // Load Meetings
    const unsubMeet = subscribeToMeetingCheckInRecords(setMeetingCheckIns);

    // Load Leads (always clear loading even if API fails)
    setIsLoadingLeads(true);
    const unsubLeads = subscribeToLeads((data) => {
        setLeads(data);
        setIsLoadingLeads(false);
        pwaNotificationService.setCurrentUser(currentUser);
        pwaNotificationService.updateScheduledNotifications(data, currentUser, ['Admin', 'SuperAdmin'].includes(userRole));
    });
    // Safety: clear loading after 15s in case subscription never fires
    const loadingTimeout = setTimeout(() => setIsLoadingLeads(false), 15000);

    // Load Users
    apiClient.get('/users').then(res => setAvailableUsers(res.data)).catch(console.error);

    // Load Tags
    getLeadTags().then(setLeadTags).catch(console.error);

    return () => {
        clearTimeout(loadingTimeout);
        unsubAtt();
        unsubMeet();
        unsubLeads();
    };
  }, [currentUser]);

  // --- 2. ROLE CHECK ---
  useEffect(() => {
    if (!currentUser) return;
    const stored = getStoredUser();
    if (stored?.role) setUserRole(stored.role);
    if (CONFIGURED_SUPER_ADMINS.includes(currentUser)) {
        setUserRole('SuperAdmin');
    } else {
        apiClient.get(`/users/by-email/${encodeURIComponent(currentUser)}`)
            .then(res => setUserRole(res.data.role || 'User'))
            .catch(() => setUserRole(stored?.role || 'Pending'));
    }
  }, [currentUser]);

  // --- 3. DERIVED STATE ---
  const isAdmin = ['Admin', 'SuperAdmin', 'superadmin'].includes(userRole);
  const isSubAdmin = userRole === 'SubAdmin';
  
  const displayedLeads = useMemo(() => {
    if (isAdmin) return leads;
    const email = (currentUser || '').toLowerCase();
    if (!email) return [];
    return leads.filter(l =>
      (l.accountManager && String(l.accountManager).toLowerCase() === email) ||
      (l.salesPerson && String(l.salesPerson).toLowerCase() === email) ||
      (l.createdBy && String(l.createdBy).toLowerCase() === email)
    );
  }, [leads, isAdmin, currentUser]);

  /** Pipeline = same layout as Leads but only leads with status "In Pipeline" */
  const pipelineLeads = useMemo(() =>
    displayedLeads.filter(l => l.status === 'In Pipeline'),
    [displayedLeads]
  );

  const canViewAllDashboardData = isAdmin; 
  const leadsForReports = canViewAllDashboardData ? leads : displayedLeads;

  const activeNotifications = useMemo(() => buildNotifications({
      currentUser: currentUser,
      isAdmin,
      leads,
      meetingCheckInRecords: meetingCheckIns,
      preferences: notificationPreferences
  }), [leads, meetingCheckIns, currentUser, isAdmin, notificationPreferences]);

  const visibleNotifications = useMemo(
    () => activeNotifications.filter((n) => !dismissedNotificationIds.has(n.id)),
    [activeNotifications, dismissedNotificationIds]
  );

  // Derive current attendance state from latest record (same logic as AttendanceTracker)
  const attendanceHeaderState = useMemo(() => {
    if (!currentUser) return null;
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
    const localDate = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const todayRecords = attendanceRecords
      .filter(r => r.username === currentUser && (r.date === localDate || (r.checkInTime && String(r.checkInTime).startsWith(localDate))))
      .sort((a, b) => new Date(b.checkInTime).getTime() - new Date(a.checkInTime).getTime());
    if (todayRecords.length === 0) return null;
    const latest = todayRecords[0];
    const isEnded = latest.status === 'ended' || latest.action === 'end-day' || !!latest.checkOutTime;
    const isOnBreak = String(latest.status || '').toLowerCase() === 'on-break' || String(latest.action || '').toLowerCase() === 'on-break';
    const status = isEnded ? 'ended' as const : isOnBreak ? 'on-break' as const : 'started' as const;
    const startDayRecord = todayRecords.find(r => String(r.action || '').toLowerCase() === 'start-day');
    const startDayTime = startDayRecord?.checkInTime;
    const displayTime = latest.checkInTime ? new Date(latest.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
    const checkedInTime = startDayTime ? new Date(startDayTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : displayTime;
    return { status, displayTime, checkedInTime };
  }, [attendanceRecords, currentUser]);

  const userAttendanceToday = useMemo(() => {
      if (!currentUser) return null;
      const today = new Date().toISOString().split('T')[0];
      return attendanceRecords.find(r => r.username === currentUser && (r.date === today || (r.checkInTime && String(r.checkInTime).startsWith(today))));
  }, [attendanceRecords, currentUser]);

  const hasActiveMeeting = useMemo(() => 
    meetingCheckIns.some(m => m.username === currentUser && !m.checkOutTime),
    [meetingCheckIns, currentUser]
  );

  // --- 4. HANDLERS ---
  const handleLogout = useCallback(async () => {
      await UpdateService.getInstance().handleLogout();
      authLogout();
      setCurrentUser(null);
  }, []);

    // --- SESSION TIMEOUT ---
  useSessionTimeout(currentUser, () => {
    handleLogout();
    setShowSessionTimeoutModal(true);
  });

  const handleLogin = (email: string) => {
      const u = getStoredUser();
      setCurrentUser(u?.email ?? email);
      return true;
  };

  const handleCreateLeadTag = useCallback(async (tagName: string) => {
      await addLeadTag(tagName);
      setLeadTags(prev => [...prev, tagName]);
      return tagName;
  }, []);

  const handleViewLead = (lead: Lead, followUpId?: string) => {
    setSelectedLead(lead);
    // Simple logic for tabs, usually handled inside modal but state kept here for simplicity
    setIsLeadDetailsModalOpen(true);
  };

  const handleNavigateToLead = (leadId: string, followUpId?: string) => {
      const lead = leads.find(l => l.id === leadId);
      if(lead) handleViewLead(lead, followUpId);
  };

  /** Update lead and refetch from server so changes persist (fixes revert on refresh) */
  const handleUpdateLead = useCallback(async (id: string, data: Partial<Lead>) => {
      await updateLead(id, data);
      const list = await getAllLeads();
      setLeads(list);
      if (selectedLead && (String(selectedLead.id) === String(id))) {
          const updated = list.find(l => String(l.id) === String(id));
          if (updated) setSelectedLead(updated);
      }
  }, [selectedLead?.id]);

  const handleAddMeeting = useCallback(async (leadId: string, meetingDetails: { date: string; notes?: string; durationMinutes?: number }) => {
      const lead = leads.find(l => String(l.id) === String(leadId));
      if (!lead) return;
      const safeFollowUps = Array.isArray(lead.followUps) ? lead.followUps : [];
      const durationNote = meetingDetails.durationMinutes ? `Duration: ${meetingDetails.durationMinutes} min.\n` : '';
      const newMeeting = {
          id: String(Date.now()),
          type: 'Meeting' as const,
          status: 'Planned' as const,
          date: meetingDetails.date,
          notes: durationNote + (meetingDetails.notes || ''),
      };
      await updateLead(leadId, { followUps: [...safeFollowUps, newMeeting] });
      const list = await getAllLeads();
      setLeads(list);
      setPlanMeetingModalOpen(false);
  }, [leads]);

  const handleBulkAddLeads = useCallback(async (newLeads: Array<Partial<Lead>>) => {
    const allResults: Array<{ index: number; agencyName: string; success: boolean; error?: string; isDuplicate?: boolean }> = [];
    let successCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;
    for (let i = 0; i < newLeads.length; i++) {
      const lead = newLeads[i];
      const agencyName = (lead?.agencyName as string) || `Row ${i + 1}`;
      try {
        await addLead(lead);
        allResults.push({ index: i, agencyName, success: true });
        successCount++;
      } catch (err: any) {
        const msg = err?.response?.data?.error ?? err?.message ?? String(err);
        const isDuplicate = /duplicate|already exists|unique/i.test(msg);
        if (isDuplicate) duplicateCount++;
        else errorCount++;
        allResults.push({ index: i, agencyName, success: false, error: msg, isDuplicate });
      }
    }
    const list = await getAllLeads();
    setLeads(list);
    setImportModalOpen(false);
    setImportResults({
      successCount,
      duplicateCount,
      errorCount,
      allResults,
      importDate: new Date().toLocaleString(),
      importedBy: currentUser || 'Unknown',
    });
    setIsImportResultsModalOpen(true);
  }, [currentUser]);

  // --- 5. RENDER ---
  const renderTimeoutModal = () => showSessionTimeoutModal && (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[9999]">
      <div className="bg-white rounded-lg p-6 max-w-sm w-full text-center shadow-xl">
        <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">Session Expired</h3>
        <p className="text-gray-600 mb-6">You have been logged out due to 30 minutes of inactivity. Please log in again to continue.</p>
        <button
          onClick={() => setShowSessionTimeoutModal(false)}
          className="w-full bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Okay
        </button>
      </div>
    </div>
  );
  if (!currentUser) return (
    <>
      <Login onLogin={handleLogin} />
      {renderTimeoutModal()}
    </>
  );
  
  if (userRole === 'Pending' && !isAdmin) return (
    <>
      <PendingApproval userEmail={currentUser} onLogout={handleLogout} />
      {renderTimeoutModal()}
    </>
  );

  const handleCreateTag = async (tagName: string): Promise<string> => {
    await addLeadTag(tagName);
    const tags = await getLeadTags();
    setLeadTags(tags);
    return tagName;
  };

  if (false) {
  const _removedInlineAddLeadModal = ({ onClose, onAddLead }: { onClose: () => void; onAddLead: (data: Partial<Lead>) => Promise<void> }) => {
      const [formData, setFormData] = useState({
          agencyName: '', contactName: '', phone: '', email: '', address: '', city: '',
          status: 'New' as Lead['status'],
          agentCategory: 'Beginner' as Lead['agentCategory'],
          leadSource: 'Website' as Lead['leadSource'],
          accountManager: '', salesPerson: '', remarks: '', websiteLink: '',
          countryInterest: [] as string[],
          icpScore: 0 as number | undefined,
          tags: [] as string[]
      });
      const [submitting, setSubmitting] = useState(false);
      const [error, setError] = useState<string | null>(null);

      const handleSubmit = async (e: React.FormEvent) => {
          e.preventDefault();
          setError(null);
          setSubmitting(true);
          try {
              const contactId = `new-${Date.now()}`;
              await onAddLead({
                  agencyName: formData.agencyName.trim(),
                  status: formData.status,
                  agentCategory: formData.agentCategory,
                  leadSource: formData.leadSource,
                  tags: formData.tags || [],
                  followUps: [],
                  accountManager: formData.accountManager.trim() || undefined,
                  salesPerson: formData.salesPerson.trim() || undefined,
                  remarks: formData.remarks.trim() || undefined,
                  websiteLink: formData.websiteLink.trim() || undefined,
                  countryInterest: formData.countryInterest.length ? formData.countryInterest : undefined,
                  icpScore: formData.icpScore ?? undefined,
                  contacts: [{
                      id: contactId,
                      name: formData.contactName.trim() || formData.agencyName.trim(),
                      phone: formData.phone.trim(),
                      email: formData.email.trim() || undefined,
                      role: 'POC',
                      address: formData.address.trim() || undefined,
                      city: formData.city.trim() || undefined
                  }]
              });
              onClose();
          } catch (err: any) {
              setError(err?.message || 'Failed to add lead. Please try again.');
          } finally {
              setSubmitting(false);
          }
      };

      const toggleCountry = (country: string) => {
          setFormData(prev => ({
              ...prev,
              countryInterest: prev.countryInterest.includes(country)
                  ? prev.countryInterest.filter(c => c !== country)
                  : [...prev.countryInterest, country]
          }));
      };

      return (
          <Modal title="Add New Agency/Partner" onClose={onClose} maxWidth="max-w-5xl">
              <form onSubmit={handleSubmit} className="space-y-4 bg-gradient-to-br from-blue-50 to-indigo-50 p-4 sm:p-6 rounded-lg max-h-[85vh] overflow-y-auto">
                  {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
                  <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm border border-blue-200">
                      <label className="block text-sm font-bold text-slate-800 mb-1">Agency / Partner Name *</label>
                      <input value={formData.agencyName} onChange={e => setFormData({ ...formData, agencyName: e.target.value })}
                          className="block w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg focus:border-indigo-500 bg-white" placeholder="Enter agency or partner name" required />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
                      <div className="bg-white p-3 rounded-lg shadow-sm border border-blue-200">
                          <label className="block text-sm font-bold text-slate-800 mb-1">Account Manager</label>
                          <select value={formData.accountManager} onChange={e => setFormData({ ...formData, accountManager: e.target.value })}
                              className="block w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg bg-white">
                              <option value="">Select (Optional)</option>
                              <option value={currentUser ?? ''}>Me</option>
                              {availableUsers.map(u => <option key={u.id} value={u.email}>{u.name || u.email}</option>)}
                          </select>
                      </div>
                      <div className="bg-white p-3 rounded-lg shadow-sm border border-blue-200">
                          <label className="block text-sm font-bold text-slate-800 mb-1">Sales Person</label>
                          <select value={formData.salesPerson} onChange={e => setFormData({ ...formData, salesPerson: e.target.value })}
                              className="block w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg bg-white">
                              <option value="">Select (Optional)</option>
                              <option value={currentUser ?? ''}>Me</option>
                              {availableUsers.map(u => <option key={u.id} value={u.email}>{u.name || u.email}</option>)}
                          </select>
                      </div>
                      <div className="bg-white p-3 rounded-lg shadow-sm border border-blue-200">
                          <label className="block text-sm font-bold text-slate-800 mb-1">Status</label>
                          <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value as Lead['status'] })}
                              className="block w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg bg-white">
                              {LEAD_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                      </div>
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow-sm border border-blue-200">
                      <h3 className="text-base font-bold text-slate-800 mb-3">Contact Information</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          <div>
                              <label className="block text-sm font-bold text-slate-800 mb-1">Primary Contact Name</label>
                              <input value={formData.contactName} onChange={e => setFormData({ ...formData, contactName: e.target.value })}
                                  className="block w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg" placeholder="Contact person" />
                          </div>
                          <div>
                              <label className="block text-sm font-bold text-slate-800 mb-1">Primary Mobile *</label>
                              <input type="tel" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                                  className="block w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg" placeholder="10 digits" required maxLength={10} />
                          </div>
                          <div>
                              <label className="block text-sm font-bold text-slate-800 mb-1">Primary Email</label>
                              <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })}
                                  className="block w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg" placeholder="email@example.com" />
                          </div>
                          <div className="sm:col-span-2">
                              <label className="block text-sm font-bold text-slate-800 mb-1">Address</label>
                              <input value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })}
                                  className="block w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg" placeholder="Full address" />
                          </div>
                          <div>
                              <label className="block text-sm font-bold text-slate-800 mb-1">City</label>
                              <input value={formData.city} onChange={e => setFormData({ ...formData, city: e.target.value })}
                                  className="block w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg" placeholder="City" />
                          </div>
                      </div>
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow-sm border border-blue-200">
                      <h3 className="text-base font-bold text-slate-800 mb-3">Lead Classification</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                              <label className="block text-sm font-bold text-slate-800 mb-1">Agent Category</label>
                              <select value={formData.agentCategory} onChange={e => setFormData({ ...formData, agentCategory: e.target.value as Lead['agentCategory'] })}
                                  className="block w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg bg-white">
                                  {AGENT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                          </div>
                          <div>
                              <label className="block text-sm font-bold text-slate-800 mb-1">Lead Source</label>
                              <select value={formData.leadSource} onChange={e => setFormData({ ...formData, leadSource: e.target.value as Lead['leadSource'] })}
                                  className="block w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg bg-white">
                                  {LEAD_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                          </div>
                          <div>
                              <label className="block text-sm font-bold text-slate-800 mb-1">ICP Score (1-10)</label>
                              <input type="number" min={1} max={10} value={formData.icpScore ?? ''} onChange={e => setFormData({ ...formData, icpScore: e.target.value === '' ? undefined : parseInt(e.target.value, 10) || undefined })}
                                  className="block w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg" placeholder="1-10" />
                          </div>
                      </div>
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow-sm border border-blue-200">
                      <label className="block text-sm font-bold text-slate-800 mb-1">Country Interest</label>
                      <div className="flex flex-wrap gap-2">
                          {COUNTRY_OPTIONS.map(c => (
                              <label key={c} className="inline-flex items-center gap-1 cursor-pointer text-sm">
                                  <input type="checkbox" checked={formData.countryInterest.includes(c)} onChange={() => toggleCountry(c)} className="rounded" />
                                  <span>{c}</span>
                              </label>
                          ))}
                      </div>
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow-sm border border-blue-200">
                      <label className="block text-sm font-bold text-slate-800 mb-1">Website / Link</label>
                      <input type="url" value={formData.websiteLink} onChange={e => setFormData({ ...formData, websiteLink: e.target.value })}
                          className="block w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg" placeholder="https://..." />
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow-sm border border-blue-200">
                      <label className="block text-sm font-bold text-slate-800 mb-1">Remarks</label>
                      <textarea value={formData.remarks} onChange={e => setFormData({ ...formData, remarks: e.target.value })}
                          rows={3} className="block w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg" placeholder="Additional notes..." />
                  </div>
                  <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4">
                      <button type="button" onClick={onClose} className="px-6 py-2.5 min-h-[44px] text-sm font-bold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 border-2 border-slate-300">
                          Cancel
                      </button>
                      <button type="submit" disabled={submitting} className={`px-6 py-2.5 min-h-[44px] text-sm font-bold text-white rounded-lg border-2 shadow-lg ${submitting ? 'bg-gray-400 border-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 border-indigo-600'}`}>
                          {submitting ? 'Adding Lead...' : 'Add Lead'}
                      </button>
                  </div>
              </form>
          </Modal>
      );
  };
  }

  return (
    <SubdomainRouter>
      <div className="min-h-screen w-full bg-slate-100 text-slate-900 flex overflow-hidden">
        {/* Sidebar */}
        <div className="hidden md:flex md:flex-col flex-none">
          <Sidebar
            currentView={view}
            onViewChange={setView}
            isAdmin={isAdmin}
            isSubAdmin={isSubAdmin}
            currentUser={currentUser}
            onSignOut={handleLogout}
          />
        </div>

        {/* Mobile Sidebar - same look as Firebase */}
        {isMobileSidebarOpen && (
          <div className="md:hidden fixed inset-0 z-50 bg-black bg-opacity-50" onClick={() => setIsMobileSidebarOpen(false)}>
            <div className="fixed top-0 left-0 h-full w-64 bg-slate-800 text-white shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="p-4">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold">Menu</h2>
                  <button
                    onClick={() => setIsMobileSidebarOpen(false)}
                    className="p-2 hover:bg-slate-700 rounded-lg text-white"
                  >
                    ✕
                  </button>
                </div>
                <Sidebar
                  currentView={view}
                  onViewChange={(v) => { setView(v); setIsMobileSidebarOpen(false); }}
                  isAdmin={isAdmin}
                  isSubAdmin={isSubAdmin}
                  currentUser={currentUser}
                  onSignOut={handleLogout}
                  forceExpanded
                />
              </div>
            </div>
          </div>
        )}

        {/* Main Content - mobile-first layout */}
        <div className="flex-1 flex flex-col min-w-0 app-shell main-content-wrap">
          {/* Top Header Bar - mobile: compact to avoid congestion */}
          <header className="bg-white shadow-sm border-b border-slate-200 flex-shrink-0">
            <div className="px-2 sm:px-4 py-1.5 sm:py-2">
              <div className="flex items-center justify-between gap-1 sm:gap-2 min-w-0">
                <div className="flex items-center gap-1 sm:gap-3 min-w-0 flex-1">
                  <button
                    onClick={() => setIsMobileSidebarOpen(true)}
                    className="md:hidden p-1.5 hover:bg-slate-100 rounded text-slate-600 flex-shrink-0"
                    title="Open Menu"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                  </button>
                  <h1 className="text-xs sm:text-lg font-semibold text-slate-900 truncate min-w-0">
                    {view === 'leads' && <><span className="sm:hidden">Leads</span><span className="hidden sm:inline">Leads Dashboard</span></>}
                    {view === 'pipeline' && <><span className="sm:hidden">Pipeline</span><span className="hidden sm:inline">Pipeline View</span></>}
                    {view === 'meetings' && 'Meetings'}
                    {view === 'followups' && 'Follow-ups'}
                    {view === 'live-tracking' && (isAdmin || isSubAdmin ? (<> <span className="sm:hidden">GPS</span><span className="hidden sm:inline">Live GPS Tracking</span></>) : (<> <span className="sm:hidden">Location</span><span className="hidden sm:inline">My Location</span></>))}
                    {view === 'travel-claims' && (<> <span className="sm:hidden">Claims</span><span className="hidden sm:inline">Travel Claims</span></>)}
                    {view === 'reports' && 'Reports'}
                    {view === 'calls-report' && (<> <span className="sm:hidden">Calls</span><span className="hidden sm:inline">Calls Report</span></>)}
                    {view === 'bulk-email' && (<> <span className="sm:hidden">Email</span><span className="hidden sm:inline">Bulk Email</span></>)}
                    {view === 'notifications' && (<> <span className="sm:hidden">Alerts</span><span className="hidden sm:inline">Notifications</span></>)}
                    {view === 'admin-users' && (<> <span className="sm:hidden">Users</span><span className="hidden sm:inline">User Management</span></>)}
                    {view === 'usage-report' && (<> <span className="sm:hidden">Usage</span><span className="hidden sm:inline">Usage Report</span></>)}
                    {view === 'database-admin' && (<> <span className="sm:hidden">DB</span><span className="hidden sm:inline">Database</span></>)}
                    {view === 'data-export' && (<> <span className="sm:hidden">Export</span><span className="hidden sm:inline">Data Export</span></>)}
                    {view === 'meeting-photos' && <><span className="sm:hidden">Photos</span><span className="hidden sm:inline">Meeting Photos Gallery</span></>}
                    {view === 'website-control' && (<> <span className="sm:hidden">Site</span><span className="hidden sm:inline">Website Control</span></>)}
                    {!['leads', 'pipeline', 'meetings', 'followups', 'live-tracking', 'travel-claims', 'reports', 'calls-report', 'bulk-email', 'notifications', 'admin-users', 'usage-report', 'database-admin', 'data-export', 'meeting-photos', 'website-control'].includes(view) && view.replace(/-/g, ' ')}
                  </h1>
                  <button
                    onClick={() => setAddLeadModalOpen(true)}
                    className="flex items-center gap-0.5 sm:gap-2 px-1.5 sm:px-4 py-1.5 sm:py-2 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm flex-shrink-0"
                  >
                    <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    <span className="hidden sm:inline">Add Lead</span>
                    <span className="sm:hidden">Add</span>
                  </button>
                </div>
                <div className="flex items-center gap-0.5 sm:gap-2 flex-shrink-0">
                  {attendanceHeaderState && attendanceHeaderState.status !== 'ended' ? (
                    attendanceHeaderState.status === 'on-break' ? (
                      <button onClick={() => setIsAttendanceModalOpen(true)} className="px-1.5 sm:px-3 py-1.5 text-xs font-medium text-amber-800 bg-amber-100 rounded-lg hover:bg-amber-200 min-h-[36px] sm:min-h-0">
                        <span className="hidden sm:inline">On Break @ {attendanceHeaderState.displayTime}</span>
                        <span className="sm:hidden">Break</span>
                      </button>
                    ) : (
                      <button onClick={() => setIsAttendanceModalOpen(true)} className="px-1.5 sm:px-3 py-1.5 text-xs font-medium text-green-800 bg-green-100 rounded-lg hover:bg-green-200 min-h-[36px] sm:min-h-0">
                        <span className="hidden sm:inline">Checked In @ {attendanceHeaderState.checkedInTime}</span>
                        <span className="sm:hidden">✓</span>
                      </button>
                    )
                  ) : (
                    <button onClick={() => setIsAttendanceModalOpen(true)} className="px-1.5 sm:px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 min-h-[36px] sm:min-h-0">
                      <span className="hidden sm:inline">Mark Attendance</span>
                      <span className="sm:hidden">In</span>
                    </button>
                  )}
                  <button
                    onClick={() => setIsMeetingCheckInModalOpen(true)}
                    className={`px-1.5 sm:px-3 py-1.5 text-xs font-medium text-white rounded-lg transition-colors min-h-[36px] sm:min-h-0 ${hasActiveMeeting ? 'bg-orange-600 hover:bg-orange-700 border border-orange-400' : 'bg-purple-600 hover:bg-purple-700'}`}
                  >
                    <span className="hidden sm:inline">{hasActiveMeeting ? '🟠 Meeting' : 'Meeting'}</span>
                    <span className="sm:hidden">Meet</span>
                  </button>
                  <NotificationBell
                    notifications={visibleNotifications}
                    readNotificationIds={readNotificationIds}
                    onMarkAsRead={(id) => setReadNotificationIds(prev => new Set(prev).add(id))}
                    onMarkAllAsRead={() => setReadNotificationIds(prev => new Set([...prev, ...visibleNotifications.map((n) => n.id)]))}
                    onNavigateToLead={handleNavigateToLead}
                    onOpenNotificationsCenter={() => setView('notifications')}
                  />
                  <button onClick={() => setUserProfileOpen(true)} title="Profile" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-700 flex-shrink-0">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  </button>
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto overflow-x-hidden min-w-0">
            <div className="p-3 sm:p-4 pb-8 w-full max-w-full min-w-0">
              {isLoadingLeads && ['leads', 'pipeline'].includes(view) && (
                <div className="flex justify-center items-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                  <span className="ml-2 text-slate-600">Loading leads...</span>
                </div>
              )}
              {(view !== 'leads' && view !== 'pipeline') || !isLoadingLeads ? (
                 <>
                    {view === 'leads' && !isLoadingLeads && (
                        <LeadsDashboard
                            key="leads"
                            defaultViewMode="compact"
                            leads={displayedLeads}
                            onSelectLead={handleViewLead}
                            onAddLead={() => setAddLeadModalOpen(true)}
                            onImportLeads={() => setImportModalOpen(true)}
                            onMeetingCheckIn={() => setIsMeetingCheckInModalOpen(true)}
                            meetingCheckIns={meetingCheckIns}
                            currentUser={currentUser}
                            isAdmin={isAdmin}
                            userRole={userRole}
                            selectedLeads={selectedLeads}
                            onToggleLeadSelection={(id) => { if (id === '' || id == null) { setSelectedLeads([]); return; } setSelectedLeads(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]); }}
                            onSelectAllLeads={() => setSelectedLeads(leads.map(l => l.id))}
                            onSelectVisibleLeads={(ids) => setSelectedLeads(ids)}
                            onClearSelection={() => setSelectedLeads([])}
                            onBulkDeleteLeads={async (ids) => { for(const id of ids) await deleteLead(id); }}
                            onBulkAssignLeads={async (ids, am, sp) => { for(const id of ids) await updateLead(id, {accountManager: am, salesPerson: sp}); }}
                            availableUsers={availableUsers}
                            onAssignLead={(id, am, sp) => updateLead(id, {accountManager: am, salesPerson: sp})}
                            onUpdateLead={(id, data) => updateLead(id, data)}
                        />
                    )}

                    {view === 'reports' && (
                        <Reports 
                            attendanceRecords={attendanceRecords}
                            meetingCheckInRecords={meetingCheckIns}
                            currentUser={currentUser}
                            isAdmin={isAdmin}
                            availableUsers={availableUsers}
                            leads={leadsForReports}
                            canViewAllDashboardData={canViewAllDashboardData}
                        />
                    )}

                    {view === 'pipeline' && !isLoadingLeads && (
                        <div className="space-y-6">
                            <WebsiteSignupLeads onConvertToLead={() => setAddLeadModalOpen(true)} />
                            <div>
                                <h3 className="text-xl font-bold text-slate-800 mb-4">In Pipeline Leads</h3>
                                <LeadsDashboard
                                    key="pipeline"
                                    title="In Pipeline Leads"
                                    leads={pipelineLeads}
                                    onSelectLead={handleViewLead}
                                    onAddLead={() => setAddLeadModalOpen(true)}
                                    onImportLeads={() => setImportModalOpen(true)}
                                    onMeetingCheckIn={() => setIsMeetingCheckInModalOpen(true)}
                                    meetingCheckIns={meetingCheckIns}
                                    currentUser={currentUser}
                                    isAdmin={isAdmin}
                                    userRole={userRole}
                                    selectedLeads={selectedLeads}
                                    onToggleLeadSelection={(id) => { if (id === '' || id == null) { setSelectedLeads([]); return; } setSelectedLeads(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]); }}
                                    onSelectAllLeads={() => setSelectedLeads(leads.map(l => l.id))}
                                    onSelectVisibleLeads={(ids) => setSelectedLeads(ids)}
                                    onClearSelection={() => setSelectedLeads([])}
                                    onBulkDeleteLeads={async (ids) => { for(const id of ids) await deleteLead(id); setLeads(await getAllLeads()); }}
                                    onBulkAssignLeads={async (ids, am, sp) => { for(const id of ids) await updateLead(id, {accountManager: am, salesPerson: sp}); setLeads(await getAllLeads()); }}
                                    availableUsers={availableUsers}
                                    onAssignLead={(id, am, sp) => handleUpdateLead(id, {accountManager: am, salesPerson: sp})}
                                    onUpdateLead={handleUpdateLead}
                                    onAddFollowUp={async (id, f) => {
                                        await appendFollowUp(id, { ...f, id: Date.now().toString() });
                                        const list = await getAllLeads();
                                        setLeads(list);
                                    }}
                                />
                            </div>
                        </div>
                    )}
                    {view === 'meetings' && (
                        <>
                            <MeetingPlanner leads={displayedLeads} meetingCheckInRecords={meetingCheckIns} onUpdateLead={(lead) => handleUpdateLead(lead.id, { followUps: lead.followUps })} onPlanNewMeeting={() => setPlanMeetingModalOpen(true)} />
                            <div className="mt-10">
                                <CompletedMeetings meetingCheckIns={meetingCheckIns} leads={displayedLeads} currentUser={currentUser} availableUsers={availableUsers} />
                            </div>
                        </>
                    )}
                    {view === 'followups' && (
                        <Suspense fallback={<div className="flex justify-center items-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /><span className="ml-2 text-slate-600">Loading Follow-ups…</span></div>}>
                            <FollowUps leads={displayedLeads} currentUser={currentUser} isAdmin={isAdmin} availableUsers={availableUsers} onUpdateLead={handleUpdateLead} />
                        </Suspense>
                    )}
                    {view === 'notifications' && (
                        <NotificationsCenter
                            notifications={visibleNotifications}
                            readNotificationIds={readNotificationIds}
                            onMarkRead={(id) => setReadNotificationIds(prev => new Set(prev).add(id))}
                            onMarkUnread={(id) => setReadNotificationIds(prev => { const next = new Set(prev); next.delete(id); return next; })}
                            onMarkAllRead={() => setReadNotificationIds(prev => new Set([...prev, ...visibleNotifications.map((n) => n.id)]))}
                            onDismissNotification={(id) => {
                              setDismissedNotificationIds((prev) => {
                                const next = new Set(prev);
                                next.add(id);
                                try { localStorage.setItem('crm_dismissed_notification_ids', JSON.stringify([...next])); } catch (_) {}
                                return next;
                              });
                            }}
                            onNavigateToLead={handleNavigateToLead}
                            preferences={notificationPreferences}
                            onMuteCategory={() => {}}
                            onUnmuteCategory={() => {}}
                            onMuteNotification={() => {}}
                            onUnmuteNotification={() => {}}
                            onSnoozeNotification={() => {}}
                            onClearSnooze={() => {}}
                            onBack={() => setView('leads')}
                            onOpenSettings={() => setIsNotificationSettingsOpen(true)}
                        />
                    )}
                    {view === 'calls-report' && <CallsReport currentUser={currentUser!} isAdmin={isAdmin} availableUsers={availableUsers} />}
                    {view === 'travel-claims' && <TravelClaims currentUser={currentUser} isAdmin={isAdmin} />}
                    {view === 'bulk-email' && <BulkEmailMarketing currentUser={currentUser!} isAdmin={isAdmin} />}
                    {view === 'live-tracking' && <SimpleGoogleMaps isAdmin={isAdmin || isSubAdmin} />}
                    {view === 'admin-users' && isAdmin && <AdminUsers isAdmin={isAdmin} isSubAdmin={isSubAdmin} userRole={userRole} currentUser={currentUser} />}
                    {view === 'usage-report' && isAdmin && <UsageReport currentUser={currentUser} isAdmin={isAdmin} />}
                    {view === 'database-admin' && isAdmin && <DatabaseAdmin />}
                    {view === 'data-export' && isAdmin && <DataExport leads={leadsForReports} isAdmin={isAdmin} />}
                    {view === 'meeting-photos' && <MeetingPhotosAdmin isOpen={true} onClose={() => setView('leads')} />}
                    {view === 'website-control' && isAdmin && (
                        <div className="bg-white p-4 rounded-xl shadow">
                            <WebsiteControlPanel isAdmin={isAdmin} />
                        </div>
                    )}
                    {!['leads', 'pipeline', 'reports', 'meetings', 'followups', 'notifications', 'calls-report', 'travel-claims', 'bulk-email', 'live-tracking', 'website-control', 'admin-users', 'usage-report', 'database-admin', 'data-export', 'meeting-photos'].includes(view) && (
                        <div className="text-slate-600 text-center py-8">Select a section from the sidebar.</div>
                    )}
                </>
              ) : null}
            </div>
          </main>
        </div>

        {/* Modals */}
        {isAddLeadModalOpen && currentUser && (
            <AddLeadModal
                onClose={() => setAddLeadModalOpen(false)}
                onAddLead={async (data) => {
                    await addLead({ ...data, createdBy: currentUser ?? undefined });
                    const list = await getAllLeads();
                    setLeads(list);
                }}
                currentUser={currentUser}
                isAdmin={isAdmin}
                availableUsers={availableUsers}
                availableTags={leadTags}
                onCreateTag={isAdmin ? handleCreateTag : undefined}
            />
        )}

        {isAttendanceModalOpen && (
            <AttendanceTracker 
                currentUser={currentUser} 
                isOpen={isAttendanceModalOpen} 
                onClose={() => setIsAttendanceModalOpen(false)} 
                onAttendanceUpdate={() => {}} 
                attendanceRecords={attendanceRecords}
            />
        )}

        {isMeetingCheckInModalOpen && (
            <SimpleMeetingCheckIn
                isOpen={isMeetingCheckInModalOpen}
                onClose={() => setIsMeetingCheckInModalOpen(false)}
                availableUsers={availableUsers}
                userLeads={displayedLeads}
                currentUser={currentUser!}
            />
        )}

        {isPlanMeetingModalOpen && (
            <PlanMeetingModal
                leads={displayedLeads}
                onClose={() => setPlanMeetingModalOpen(false)}
                onSchedule={handleAddMeeting}
            />
        )}

        {/* User Profile Modal */}
        {isUserProfileOpen && currentUser && (
            <UserProfile 
                userEmail={currentUser} 
                onClose={() => setUserProfileOpen(false)} 
                onLogout={handleLogout} 
                userRole={userRole} 
                leads={leads} 
                availableUsers={availableUsers} 
            />
        )}

        {isLeadDetailsModalOpen && selectedLead && (
            <LeadDetailsModal
                lead={selectedLead}
                isOpen={isLeadDetailsModalOpen}
                onClose={() => setIsLeadDetailsModalOpen(false)}
                currentUser={currentUser}
                isAdmin={isAdmin}
                userRole={userRole || ''}
                onUpdateLead={handleUpdateLead}
                onAddFollowUp={async (id, f) => {
                    await appendFollowUp(id, { ...f, id: Date.now().toString() });
                    const list = await getAllLeads();
                    setLeads(list);
                }}
                availableUsers={availableUsers}
                meetingCheckIns={meetingCheckIns}
                availableTags={leadTags}
                onCreateTag={handleCreateLeadTag}
            />
        )}

        {isImportModalOpen && (
          <ImportLeadsModal
            onClose={() => setImportModalOpen(false)}
            onImport={handleBulkAddLeads}
          />
        )}
        {isImportResultsModalOpen && importResults && (
          <ImportResultsModal
            isOpen={isImportResultsModalOpen}
            onClose={() => { setIsImportResultsModalOpen(false); setImportResults(null); }}
            results={importResults}
          />
        )}
        
        <MobileCacheButton />

        {renderTimeoutModal()}
      </div>
    </SubdomainRouter>
  );
};

export default App;