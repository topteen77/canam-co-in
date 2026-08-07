import React, { useState, useMemo, useEffect } from 'react';
import type { Lead, FollowUp } from '../types';
import { AGENT_CATEGORIES } from '../types';
import { Modal } from './Modal';
import { getUserDisplayName as utilGetUserDisplayName, cleanCorruptedData } from '../utils/dataCleaning';
import { exportLeadsToCSV } from '../services/exportService';
import { DetailedFollowUpReport } from './DetailedFollowUpReport';
import { SimplePagination } from './SimplePagination';
import { CustomDateTimePicker } from './CustomDateTimePicker';


interface FollowUpsProps {
  leads: Lead[];
  currentUser: string;
  isAdmin: boolean;
  availableUsers: Array<{ id: string, name: string, email: string, role: string }>;
  onUpdateLead?: (leadId: string, updates: Partial<Lead>) => void;
  onAddFollowUp?: (leadId: string, followUp: any) => Promise<void>;
}

const FollowUpsInner: React.FC<FollowUpsProps> = ({
  leads,
  currentUser,
  isAdmin,
  availableUsers,
  onUpdateLead,
  onAddFollowUp
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'planned' | 'completed' | 'detailed-report'>('all');
  const [dateFilter, setDateFilter] = useState({
    startDate: new Date().toISOString().split('T')[0], // Today
    endDate: new Date().toISOString().split('T')[0]    // Today
  });

  // Filter states
  const [userFilter, setUserFilter] = useState<string>('all');
  const [agencyCategoryFilter, setAgencyCategoryFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // New filters
  const [agencyNameFilter, setAgencyNameFilter] = useState<string>('');
  const todayDateStr = new Date().toISOString().split('T')[0];
  const [dateRangeFilter, setDateRangeFilter] = useState<{
    from: string;
    to: string;
  }>({ from: '', to: '' });

  const [lastUpdatedRangeFilter, setLastUpdatedRangeFilter] = useState<{
    from: string;
    to: string;
  }>({ from: todayDateStr, to: todayDateStr });

  // Sort by filter
  const [sortBy, setSortBy] = useState<'date' | 'type' | 'status' | 'agency' | 'assignedTo' | 'lastUpdated'>('lastUpdated');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Edit modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingFollowUp, setEditingFollowUp] = useState<(FollowUp & { leadId: string; agencyName: string; leadStatus: string }) | null>(null);
  const [editForm, setEditForm] = useState({
    type: 'Call',
    date: '',
    time: '',
    notes: '',
    status: 'Planned' as 'Planned' | 'Done',
    assignedTo: ''
  });

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [followUpsPerPage, setFollowUpsPerPage] = useState(100);


  // Lead edit modal state
  const [isLeadEditModalOpen, setIsLeadEditModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [leadEditForm, setLeadEditForm] = useState({
    agencyName: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    status: 'New' as 'New' | 'Contacted' | 'Qualified' | 'Onboarded' | 'Rejected',
    assignedTo: '',
    notes: ''
  });

  // Apply dashboard navigation filters when navigating from dashboard
  useEffect(() => {
    const navFilters = localStorage.getItem('dashboardNavFilters');
    const navTimestamp = localStorage.getItem('dashboardNavTimestamp');

    if (navFilters && navTimestamp) {
      try {
        const parsedFilters = JSON.parse(navFilters);
        const timestamp = parseInt(navTimestamp);
        const now = Date.now();

        // Only apply if navigation happened recently (within 5 seconds)
        if (now - timestamp < 5000) {
          // Apply leadIds filter to show specific leads
          if (parsedFilters.leadIds && parsedFilters.leadIds.length > 0) {
            // Filter leads by leadIds - this will be handled in the rendering logic
            // Store for use in filtering
            (window as any).dashboardNavLeadIds = parsedFilters.leadIds;
          }

          // Apply follow-up type filter
          if (parsedFilters.followUpType) {
            setTypeFilter(parsedFilters.followUpType);
          }

          // Apply follow-up status filter
          if (parsedFilters.followUpStatus) {
            if (parsedFilters.followUpStatus === 'Planned') {
              setActiveTab('planned');
            } else if (parsedFilters.followUpStatus === 'Done') {
              setActiveTab('completed');
            }
          }

          // Clear the stored filters after applying
          localStorage.removeItem('dashboardNavFilters');
          localStorage.removeItem('dashboardNavTimestamp');
          setTimeout(() => {
            delete (window as any).dashboardNavLeadIds;
          }, 10000);
        }
      } catch (e) {
        console.error('Error applying dashboard navigation filters:', e);
      }
    }
  }, []);

  // New follow-up modal state
  const [isNewFollowUpModalOpen, setIsNewFollowUpModalOpen] = useState(false);
  const [isAddingNewFollowUp, setIsAddingNewFollowUp] = useState(false);
  const [newFollowUpForm, setNewFollowUpForm] = useState({
    type: 'Call',
    date: '',
    time: '',
    notes: '',
    assignedTo: ''
  });

  // History modal state
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  // Debug information visibility state
  const [showDebugInfo, setShowDebugInfo] = useState(false);

  // Reset pagination when filters or tab change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, userFilter, agencyCategoryFilter, typeFilter, agencyNameFilter, dateRangeFilter, lastUpdatedRangeFilter, dateFilter]);


  // Function to ensure follow-up has proper timestamps
  const ensureFollowUpTimestamps = (followUp: any) => {
    if (!followUp.createdAt) {
      followUp.createdAt = new Date().toISOString();
    }
    if (!followUp.updatedAt) {
      followUp.updatedAt = followUp.createdAt;
    }
    return followUp;
  };

  // Simple function to get user display name
  const getUserDisplayName = (email: string): string => {
    if (!email) return 'N/A';

    // Try to find user in availableUsers first
    if (availableUsers && availableUsers.length > 0) {
      const user = availableUsers.find(u => u.email && u.email.toLowerCase() === email.toLowerCase());
      if (user && user.name && user.name.trim()) {
        return user.name;
      }
    }

    // Simple mapping for common emails to names
    const emailToNameMap: { [key: string]: string } = {
      'iapplyam2b2b@gmail.com': 'Nakul Kathota',
      'canamrakesh@gmail.com': 'Rakesh',
      'amit.iapply@gmail.com': 'Amit Kumar',
      'admin@iapply.com': 'Admin',
      'support@iapply.com': 'Support Team'
    };

    // Check if we have a mapping for this email
    const mappedName = emailToNameMap[email.toLowerCase()];
    if (mappedName) {
      return mappedName;
    }

    // Fallback: Extract name from email (before @ symbol)
    const emailPrefix = email.split('@')[0];
    return emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
  };

  // Sort function for follow-ups
  const sortFollowUps = (followUps: (FollowUp & { leadId: string; agencyName: string; leadStatus: string })[]) => {
    return [...followUps].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'date':
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case 'type':
          comparison = a.type.localeCompare(b.type);
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'agency':
          comparison = a.agencyName.localeCompare(b.agencyName);
          break;
        case 'assignedTo':
          const aAssigned = a.assignedTo || '';
          const bAssigned = b.assignedTo || '';
          comparison = aAssigned.localeCompare(bAssigned);
          break;
        case 'lastUpdated':
          const aLastUpdate = a.updatedAt || a.createdAt || a.date;
          const bLastUpdate = b.updatedAt || b.createdAt || b.date;
          comparison = new Date(aLastUpdate).getTime() - new Date(bLastUpdate).getTime();
          break;
        default:
          comparison = 0;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  };

  // Get all follow-ups from all leads
  const allFollowUps = useMemo(() => {
    const followUps: (FollowUp & { leadId: string; agencyName: string; leadStatus: string })[] = [];

    // 🟢 SAFE FIX: Ensure leads is an array
    const safeLeads = Array.isArray(leads) ? leads : [];

    safeLeads.forEach(lead => {
      // 🟢 SAFE FIX: Ensure followUps exists
      const safeLeadFollowUps = Array.isArray(lead.followUps) ? lead.followUps : [];

      safeLeadFollowUps.forEach(followUp => {
        followUps.push({
          ...followUp,
          leadId: lead.id,
          agencyName: lead.agencyName || 'Unknown',
          leadStatus: lead.status || 'Unknown'
        });
      });
    });

    return followUps.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [leads, currentUser, isAdmin]);

  // Filter follow-ups based on current user (if not admin)
  // Since displayedLeads already filters leads properly, we just need to show follow-ups from those leads
  const filteredFollowUps = useMemo(() => {
    if (isAdmin) {
      return allFollowUps;
    }

    // For non-admin users, show all follow-ups from leads they have access to
    // The displayedLeads filtering already handles this correctly
    return allFollowUps.filter(followUp => {
      const lead = leads.find(l => l.id === followUp.leadId);
      if (!lead) return false;

      // Show follow-ups if user is assigned to the follow-up, manages the lead, or created it
      const isAssignedToFollowUp = followUp.assignedTo === currentUser || followUp.createdBy === currentUser;
      const managesLead = lead.accountManager === currentUser || lead.salesPerson === currentUser || lead.createdBy === currentUser;

      const shouldShow = isAssignedToFollowUp || managesLead;

      return shouldShow;
    });
  }, [allFollowUps, isAdmin, currentUser, leads]);

  // All follow-ups with simple filtering
  const allFollowUpsFiltered = useMemo(() => {
    return filteredFollowUps.filter(followUp => {
      // User filter
      const userMatches = userFilter === 'all' ||
        (followUp.assignedTo && followUp.assignedTo.toLowerCase().includes(userFilter.toLowerCase())) ||
        (followUp.leadId && leads.find(l => l.id === followUp.leadId)?.createdBy?.toLowerCase().includes(userFilter.toLowerCase()));

      // Agency Category filter
      const agencyCategoryMatches = agencyCategoryFilter === 'all' ||
        (followUp.leadId && leads.find(l => l.id === followUp.leadId)?.agentCategory === agencyCategoryFilter);

      // Type filter
      const typeMatches = typeFilter === 'all' || followUp.type.toLowerCase() === typeFilter.toLowerCase();

      // Agency/Agent Name filter
      const agencyNameMatches = !agencyNameFilter ||
        (followUp.agencyName || '').toLowerCase().includes(agencyNameFilter.toLowerCase());

      // Date Range filter
      const dateRangeMatches = !dateRangeFilter.from || !dateRangeFilter.to ||
        (() => {
          const followUpDate = new Date(followUp.date);
          if (Number.isNaN(followUpDate.getTime())) {
            return false;
          }

          const fromDate = new Date(dateRangeFilter.from);
          const toDate = new Date(dateRangeFilter.to);

          if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
            return false;
          }

          fromDate.setHours(0, 0, 0, 0);
          toDate.setHours(23, 59, 59, 999);

          return followUpDate >= fromDate && followUpDate <= toDate;
        })();

      // Last Updated Range filter
      const lastUpdatedMatches = !lastUpdatedRangeFilter.from || !lastUpdatedRangeFilter.to ||
        (() => {
          const lastUpdateDateStr = followUp.updatedAt || followUp.createdAt || followUp.date;
          const lastUpdateDate = new Date(lastUpdateDateStr);
          if (Number.isNaN(lastUpdateDate.getTime())) {
            return false;
          }

          const fromDate = new Date(lastUpdatedRangeFilter.from);
          const toDate = new Date(lastUpdatedRangeFilter.to);

          if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
            return false;
          }

          fromDate.setHours(0, 0, 0, 0);
          toDate.setHours(23, 59, 59, 999);

          return lastUpdateDate >= fromDate && lastUpdateDate <= toDate;
        })();

      return userMatches && agencyCategoryMatches && typeMatches && agencyNameMatches && dateRangeMatches && lastUpdatedMatches;
    });
  }, [filteredFollowUps, userFilter, agencyCategoryFilter, typeFilter, agencyNameFilter, dateRangeFilter, lastUpdatedRangeFilter, leads]);

  // Planned follow-ups (simplified)
  const plannedFollowUps = useMemo(() => {
    return allFollowUpsFiltered.filter(followUp => followUp.status === 'Planned');
  }, [allFollowUpsFiltered]);

  // Completed follow-ups within date range (simplified)
  const completedFollowUps = useMemo(() => {
    return allFollowUpsFiltered.filter(followUp => {
      const followUpDate = new Date(followUp.date).toISOString().split('T')[0];
      const isInDateRange = followUpDate >= dateFilter.startDate && followUpDate <= dateFilter.endDate;
      return followUp.status === 'Done' && isInDateRange;
    });
  }, [allFollowUpsFiltered, dateFilter]);

  // Get the current tab's follow-ups
  const currentTabFollowUps = useMemo(() => {
    switch (activeTab) {
      case 'all':
        return sortFollowUps(allFollowUpsFiltered);
      case 'planned':
        return sortFollowUps(plannedFollowUps);
      case 'completed':
        return sortFollowUps(completedFollowUps);
      case 'detailed-report':
        return []; // No follow-ups needed for detailed report tab
      default:
        return sortFollowUps(allFollowUpsFiltered);
    }
  }, [activeTab, allFollowUpsFiltered, plannedFollowUps, completedFollowUps, sortBy, sortOrder]);

  // Paginated follow-ups
  const paginatedFollowUps = useMemo(() => {
    const startIndex = (currentPage - 1) * followUpsPerPage;
    return currentTabFollowUps.slice(startIndex, startIndex + followUpsPerPage);
  }, [currentTabFollowUps, currentPage, followUpsPerPage]);

  const totalPages = Math.ceil(currentTabFollowUps.length / followUpsPerPage);


  // Statistics
  const stats = useMemo(() => {
    const totalPlanned = plannedFollowUps.length;
    const totalCompleted = completedFollowUps.length;
    const totalAll = allFollowUpsFiltered.length;

    return {
      totalAll,
      totalPlanned,
      totalCompleted,
      totalOverdue: plannedFollowUps.filter(f => new Date(f.date) < new Date()).length
    };
  }, [allFollowUpsFiltered, plannedFollowUps, completedFollowUps]);

  // Handle follow-up status update
  const handleUpdateFollowUpStatus = async (leadId: string, followUpId: string, newStatus: 'Planned' | 'Done') => {
    if (!onUpdateLead) return;

    try {
      const lead = leads.find(l => l.id === leadId);
      if (!lead) return;

      // 🟢 SAFE FIX: Ensure followUps array exists
      const currentFollowUps = Array.isArray(lead.followUps) ? lead.followUps : [];

      const updatedFollowUps = currentFollowUps.map(fu =>
        fu.id === followUpId ? {
          ...fu,
          status: newStatus,
          updatedAt: new Date().toISOString(),
          updatedBy: currentUser
        } : fu
      );

      await onUpdateLead(leadId, { followUps: updatedFollowUps });
    } catch (error) {
      console.error('Error updating follow-up status:', error);
      alert('Failed to update follow-up status');
    }
  };

  // Handle marking follow-up as updated
  const handleMarkAsUpdated = async (leadId: string, followUpId: string) => {
    if (!onUpdateLead) return;

    try {
      const lead = leads.find(l => l.id === leadId);
      if (!lead) return;

      // 🟢 SAFE FIX: Ensure followUps array exists
      const currentFollowUps = Array.isArray(lead.followUps) ? lead.followUps : [];

      const updatedFollowUps = currentFollowUps.map(fu =>
        fu.id === followUpId ? {
          ...fu,
          updatedAt: new Date().toISOString(),
          updatedBy: currentUser
        } : fu
      );

      await onUpdateLead(leadId, { followUps: updatedFollowUps });
      alert('✅ Follow-up marked as updated!');
    } catch (error) {
      console.error('Error marking follow-up as updated:', error);
      alert('Failed to mark follow-up as updated');
    }
  };

  // Handle lead name click - open lead edit modal
  const handleLeadNameClick = (lead: Lead) => {
    try {
      console.log('🔧 Opening lead edit modal for:', lead);
      setEditingLead(lead);
      // 🟢 SAFE FIX: Safe contact access
      const firstContact = Array.isArray(lead.contacts) ? lead.contacts[0] : null;

      setLeadEditForm({
        agencyName: lead.agencyName || '',
        contactPerson: firstContact?.name || '',
        email: firstContact?.email || '',
        phone: firstContact?.phone || '',
        address: firstContact?.address || '',
        status: lead.status || 'New',
        assignedTo: lead.accountManager || lead.salesPerson || '',
        notes: ''
      });
      setIsLeadEditModalOpen(true);
      console.log('✅ Lead edit modal opened successfully');
    } catch (error) {
      console.error('❌ Error opening lead edit modal:', error);
      alert('Error opening lead edit modal. Please try again.');
    }
  };

  // Download function for Excel export
  const handleDownloadExcel = () => {
    try {
      exportLeadsToCSV(leads);
    } catch (error) {
      console.error('Error exporting data:', error);
      alert('Error exporting data. Please try again.');
    }
  };

  // Handle edit follow-up click
  const handleEditFollowUp = (followUp: FollowUp & { leadId: string; agencyName: string; leadStatus: string }) => {
    try {
      console.log('🔧 Opening edit modal for follow-up:', followUp);
      const followUpDate = new Date(followUp.date);
      setEditingFollowUp(followUp);
      setEditForm({
        type: followUp.type,
        date: followUpDate.toISOString().split('T')[0],
        time: followUpDate.toTimeString().slice(0, 5),
        notes: followUp.notes || '',
        status: followUp.status,
        assignedTo: (followUp as any).assignedTo || ''
      });
      setIsEditModalOpen(true);
      console.log('✅ Edit modal opened successfully');
    } catch (error) {
      console.error('❌ Error opening edit modal:', error);
      alert('Error opening edit modal. Please try again.');
    }
  };

  // Handle save edited lead
  const handleSaveLead = async () => {
    if (!editingLead || !onUpdateLead) return;

    try {
      const existingContacts = Array.isArray(editingLead.contacts) ? editingLead.contacts : [];

      const updatedLead = {
        ...editingLead,
        agencyName: leadEditForm.agencyName,
        status: leadEditForm.status as any,
        accountManager: leadEditForm.assignedTo,
        contacts: [{
          id: existingContacts[0]?.id || `contact_${Date.now()}`,
          name: leadEditForm.contactPerson,
          role: existingContacts[0]?.role || 'Primary Contact',
          phone: leadEditForm.phone,
          email: leadEditForm.email,
          address: leadEditForm.address
        }, ...existingContacts.slice(1)]
      };

      await onUpdateLead(editingLead.id, updatedLead);
      setIsLeadEditModalOpen(false);
      setEditingLead(null);
      alert('Lead updated successfully!');
    } catch (error) {
      console.error('Error updating lead:', error);
      alert('Failed to update lead');
    }
  };

  // Handle save edited follow-up
  const handleSaveFollowUp = async () => {
    if (!editingFollowUp || !onUpdateLead) return;

    try {
      const lead = leads.find(l => l.id === editingFollowUp.leadId);
      if (!lead) return;

      // Combine date and time
      const newDateTime = new Date(`${editForm.date}T${editForm.time}`);

      // 🟢 SAFE FIX: Ensure followUps array exists
      const currentFollowUps = Array.isArray(lead.followUps) ? lead.followUps : [];

      const updatedFollowUps = currentFollowUps.map(fu =>
        fu.id === editingFollowUp.id ? {
          ...fu,
          type: editForm.type,
          date: newDateTime.toISOString(),
          notes: editForm.notes,
          status: editForm.status,
          assignedTo: editForm.assignedTo
        } : fu
      );

      await onUpdateLead(editingFollowUp.leadId, { followUps: updatedFollowUps });
      setIsEditModalOpen(false);
      setEditingFollowUp(null);
    } catch (error) {
      console.error('Error updating follow-up:', error);
      alert('Failed to update follow-up');
    }
  };

  // Handle create new follow-up
  const handleCreateNewFollowUp = async () => {
    if (!editingLead || !onUpdateLead) return;

    setIsAddingNewFollowUp(true);

    try {
      const newDateTime = new Date(`${newFollowUpForm.date}T${newFollowUpForm.time}`);

      const newFollowUp: FollowUp = {
        id: `followup_${Date.now()}`,
        type: newFollowUpForm.type as any,
        date: newDateTime.toISOString(),
        notes: newFollowUpForm.notes,
        status: 'Planned',
        createdAt: new Date().toISOString(),
        createdBy: currentUser,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser
      };

      // 🟢 ATOMIC FIX: Use onAddFollowUp if available (server-side atomic append)
      if (onAddFollowUp) {
        await onAddFollowUp(editingLead.id, newFollowUp);
      } else if (onUpdateLead) {
        const currentFollowUps = Array.isArray(editingLead.followUps) ? editingLead.followUps : [];
        const updatedFollowUps = [...currentFollowUps, newFollowUp];
        await onUpdateLead(editingLead.id, { followUps: updatedFollowUps });
      } else {
        throw new Error('No update method available');
      }

      setIsNewFollowUpModalOpen(false);
      setNewFollowUpForm({
        type: 'Call',
        date: '',
        time: '',
        notes: '',
        assignedTo: ''
      });
      alert('New follow-up created successfully!');
    } catch (error) {
      console.error('Error creating follow-up:', error);
      alert('Failed to create follow-up');
    } finally {
      setIsAddingNewFollowUp(false);
    }
  };

  // Handle delete follow-up
  const handleDeleteFollowUp = async (leadId: string, followUpId: string) => {
    if (!onUpdateLead) return;

    if (!confirm('Are you sure you want to delete this follow-up?')) return;

    try {
      const lead = leads.find(l => l.id === leadId);
      if (!lead) return;

      // 🟢 SAFE FIX: Ensure followUps array exists
      const currentFollowUps = Array.isArray(lead.followUps) ? lead.followUps : [];

      const updatedFollowUps = currentFollowUps.filter(fu => fu.id !== followUpId);
      await onUpdateLead(leadId, { followUps: updatedFollowUps });
    } catch (error) {
      console.error('Error deleting follow-up:', error);
      alert('Failed to delete follow-up');
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        console.warn('Invalid date string:', dateString);
        return 'Invalid Date';
      }
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.error('Error formatting date:', dateString, error);
      return 'Invalid Date';
    }
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Done': return 'bg-green-100 text-green-800';
      case 'Planned': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Get type icon
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'Call': return '📞';
      case 'Email': return '📧';
      case 'Meeting': return '🤝';
      default: return '📋';
    }
  };

  // Get agent category color
  const getAgentCategoryColor = (category: string) => {
    switch (category) {
      case 'Platinum': return 'bg-gradient-to-r from-gray-300 to-gray-500 text-white';
      case 'Diamond': return 'bg-gradient-to-r from-cyan-300 to-cyan-500 text-white';
      case 'Gold': return 'bg-gradient-to-r from-yellow-400 to-yellow-600 text-white';
      case 'Silver': return 'bg-gradient-to-r from-gray-200 to-gray-400 text-gray-800';
      case 'Bronze': return 'bg-gradient-to-r from-orange-400 to-orange-600 text-white';
      case 'Beginner': return 'bg-gradient-to-r from-green-400 to-green-600 text-white';
      default: return 'bg-gradient-to-r from-blue-400 to-blue-600 text-white';
    }
  };

  return (
    <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-100 min-h-full pb-20">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-800 mb-2 flex items-center gap-3">
            📞 Follow-ups Management - LIVE VERSION
          </h1>
          <p className="text-slate-600">Track and manage all your follow-ups in one place</p>

          {/* Debug Information Toggle Button */}
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => setShowDebugInfo(!showDebugInfo)}
              className="px-3 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              title="Toggle Debug Information"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Debug Info
            </button>
          </div>

          {/* Debug Information - Hidden by default */}
          {showDebugInfo && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="text-sm font-semibold text-blue-800 mb-2">🔍 Debug Information</h3>
              <div className="text-xs text-blue-700 space-y-1">
                <p><strong>Current User:</strong> {currentUser}</p>
                <p><strong>Is Admin:</strong> {isAdmin ? 'Yes' : 'No'}</p>
                <p><strong>Total Follow-ups in System:</strong> {allFollowUps.length}</p>
                <p><strong>Visible to You:</strong> {filteredFollowUps.length}</p>
                <p><strong>Your Assigned Follow-ups:</strong> {allFollowUps.filter(f => f.assignedTo === currentUser || f.createdBy === currentUser).length}</p>
                <p><strong>Leads with Your Follow-ups:</strong> {Array.from(new Set(allFollowUps.filter(f => f.assignedTo === currentUser || f.createdBy === currentUser).map(f => f.leadId))).length}</p>

                {/* Show sample follow-ups for debugging */}
                {allFollowUps.filter(f => f.assignedTo === currentUser || f.createdBy === currentUser).length > 0 && (
                  <div className="mt-2 p-2 bg-white rounded border">
                    <p className="font-semibold">Your Follow-ups Sample:</p>
                    {allFollowUps.filter(f => f.assignedTo === currentUser || f.createdBy === currentUser).slice(0, 3).map(f => (
                      <div key={f.id} className="text-xs">
                        • {f.agencyName} - {f.type} ({f.status}) - Assigned: {f.assignedTo}
                      </div>
                    ))}
                  </div>
                )}

                {/* Show all follow-ups for debugging */}
                <div className="mt-2 p-2 bg-white rounded border">
                  <p className="font-semibold">All Follow-ups in System:</p>
                  {allFollowUps.length === 0 ? (
                    <div className="text-xs text-gray-500">No follow-ups found in the system</div>
                  ) : (
                    <>
                      {allFollowUps.slice(0, 5).map(f => (
                        <div key={f.id} className="text-xs">
                          • {f.agencyName} - {f.type} ({f.status}) - Assigned: {f.assignedTo || 'None'} - Created: {f.createdBy || 'None'}
                        </div>
                      ))}
                      {allFollowUps.length > 5 && <div className="text-xs text-gray-500">... and {allFollowUps.length - 5} more</div>}
                    </>
                  )}
                </div>

                {/* Quick Test Button */}
                <div className="mt-2 p-2 bg-green-50 rounded border border-green-200">
                  <p className="font-semibold text-green-800 mb-2">Quick Test:</p>
                  <button
                    onClick={() => {
                      console.log('🧪 Test button clicked - Current state:', {
                        currentUser,
                        isAdmin,
                        totalLeads: leads.length,
                        totalFollowUps: allFollowUps.length,
                        visibleFollowUps: filteredFollowUps.length
                      });
                      alert(`Debug Info:\nCurrent User: ${currentUser}\nIs Admin: ${isAdmin}\nTotal Leads: ${leads.length}\nTotal Follow-ups: ${allFollowUps.length}\nVisible Follow-ups: ${filteredFollowUps.length}`);
                    }}
                    className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                  >
                    🧪 Test Debug Info
                  </button>
                </div>

                {allFollowUps.filter(f => f.assignedTo === currentUser || f.createdBy === currentUser).length > filteredFollowUps.length && (
                  <p className="text-red-600 font-semibold">⚠️ Some of your follow-ups may not be visible due to lead permissions</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div
            className="bg-white rounded-xl shadow-lg p-6 border border-blue-200 cursor-pointer hover:shadow-xl hover:border-blue-300 transition-all duration-200"
            onClick={() => setActiveTab('all')}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">All Follow-ups</p>
                <p className="text-2xl font-bold text-blue-600">{stats.totalAll}</p>
              </div>
              <div className="text-3xl">📋</div>
            </div>
          </div>

          <div
            className="bg-white rounded-xl shadow-lg p-6 border border-orange-200 cursor-pointer hover:shadow-xl hover:border-orange-300 transition-all duration-200"
            onClick={() => setActiveTab('planned')}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Planned</p>
                <p className="text-2xl font-bold text-orange-600">{stats.totalPlanned}</p>
              </div>
              <div className="text-3xl">⏰</div>
            </div>
          </div>

          <div
            className="bg-white rounded-xl shadow-lg p-6 border border-red-200 cursor-pointer hover:shadow-xl hover:border-red-300 transition-all duration-200"
            onClick={() => setActiveTab('planned')}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Overdue</p>
                <p className="text-2xl font-bold text-red-600">{stats.totalOverdue}</p>
              </div>
              <div className="text-3xl">⚠️</div>
            </div>
          </div>

          <div
            className="bg-white rounded-xl shadow-lg p-6 border border-green-200 cursor-pointer hover:shadow-xl hover:border-green-300 transition-all duration-200"
            onClick={() => setActiveTab('completed')}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Completed</p>
                <p className="text-2xl font-bold text-green-600">{stats.totalCompleted}</p>
              </div>
              <div className="text-3xl">✅</div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-xl shadow-lg border border-blue-200 mb-6">
          <div className="flex border-b border-slate-200">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-6 py-4 font-semibold text-sm transition-colors ${activeTab === 'all'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-slate-600 hover:text-blue-600'
                }`}
            >
              📋 All Follow-ups ({stats.totalAll})
            </button>
            <button
              onClick={() => setActiveTab('planned')}
              className={`px-6 py-4 font-semibold text-sm transition-colors ${activeTab === 'planned'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-slate-600 hover:text-blue-600'
                }`}
            >
              ⏰ Planned ({stats.totalPlanned})
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`px-6 py-4 font-semibold text-sm transition-colors ${activeTab === 'completed'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-slate-600 hover:text-blue-600'
                }`}
            >
              ✅ Completed ({stats.totalCompleted})
            </button>
            <button
              onClick={() => setActiveTab('detailed-report')}
              className={`px-6 py-4 font-semibold text-sm transition-colors ${activeTab === 'detailed-report'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-slate-600 hover:text-blue-600'
                }`}
            >
              📊 Detailed Report
            </button>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'detailed-report' ? (
              <DetailedFollowUpReport
                currentUser={currentUser}
                isAdmin={isAdmin}
                availableUsers={availableUsers}
              />
            ) : (
              /* Unified Follow-ups Display */
              <div>
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <h2 className="text-xl font-bold text-slate-800">
                      {activeTab === 'all' && 'All Follow-ups'}
                      {activeTab === 'planned' && 'Planned Follow-ups'}
                      {activeTab === 'completed' && 'Completed Follow-ups'}
                      {activeTab === 'detailed-report' && 'Detailed Report'}
                    </h2>
                    <div className="text-sm text-slate-600">
                      {currentTabFollowUps.length} follow-ups
                      {userFilter !== 'all' && (
                        <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                          User: {userFilter}
                        </span>
                      )}
                      {agencyCategoryFilter !== 'all' && (
                        <span className="ml-2 px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs">
                          Category: {agencyCategoryFilter}
                        </span>
                      )}
                      {typeFilter !== 'all' && (
                        <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">
                          Type: {typeFilter}
                        </span>
                      )}
                      {activeTab === 'completed' && (
                        <span className="ml-2 px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs">
                          {dateFilter.startDate} to {dateFilter.endDate}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Filters and Download */}
                  <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4">
                    {/* Filter Buttons */}
                    <div className="flex flex-wrap gap-2">
                      {/* User Filter */}
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-slate-600">User:</label>
                        <select
                          value={userFilter}
                          onChange={(e) => setUserFilter(e.target.value)}
                          className="px-3 py-1 border border-slate-300 rounded-lg text-sm bg-white"
                        >
                          <option value="all">All Users</option>
                          {availableUsers.map(user => (
                            <option key={user.id} value={user.email}>
                              {user.name || user.email}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Agency Category Filter */}
                      <div className="flex items-center gap-2 bg-yellow-50 px-2 py-1 rounded-lg border border-yellow-200">
                        <label className="text-sm font-medium text-yellow-800">Agency Category:</label>
                        <select
                          value={agencyCategoryFilter}
                          onChange={(e) => {
                            console.log('Agency Category filter changed to:', e.target.value);
                            setAgencyCategoryFilter(e.target.value);
                          }}
                          className="px-3 py-1 border border-yellow-300 rounded-lg text-sm bg-white text-slate-800"
                          style={{ minWidth: '120px' }}
                        >
                          <option value="all">All Categories</option>
                          {AGENT_CATEGORIES.map(category => (
                            <option key={category} value={category}>
                              {category}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Type Filter */}
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-slate-600">Type:</label>
                        <select
                          value={typeFilter}
                          onChange={(e) => setTypeFilter(e.target.value)}
                          className="px-3 py-1 border border-slate-300 rounded-lg text-sm bg-white"
                        >
                          <option value="all">All Types</option>
                          <option value="call">Call</option>
                          <option value="meeting">Meeting</option>
                          <option value="email">Email</option>
                          <option value="new assessment">New Assessment</option>
                          <option value="assessment follow-up">Assessment Follow-up</option>
                          <option value="whatsapp">WhatsApp</option>
                          <option value="follow-up">Follow-up</option>
                        </select>
                      </div>

                      {/* Agency/Agent Name Filter */}
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-slate-600">Agency/Agent:</label>
                        <input
                          type="text"
                          placeholder="Search agency or agent name..."
                          value={agencyNameFilter}
                          onChange={(e) => setAgencyNameFilter(e.target.value)}
                          className="px-3 py-1 border border-slate-300 rounded-lg text-sm bg-white min-w-[200px]"
                        />
                      </div>

                      {/* Date Range Filter */}
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-slate-600">Date Range:</label>
                        <input
                          type="date"
                          placeholder="From"
                          value={dateRangeFilter.from}
                          onChange={(e) => setDateRangeFilter(prev => ({ ...prev, from: e.target.value }))}
                          className="px-3 py-1 border border-slate-300 rounded-lg text-sm bg-white"
                        />
                        <span className="text-slate-600">to</span>
                        <input
                          type="date"
                          placeholder="To"
                          value={dateRangeFilter.to}
                          onChange={(e) => setDateRangeFilter(prev => ({ ...prev, to: e.target.value }))}
                          className="px-3 py-1 border border-slate-300 rounded-lg text-sm bg-white"
                        />
                      </div>

                      {/* Last Updated Date Range Filter */}
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-slate-600">Last Updated:</label>
                        <input
                          type="date"
                          placeholder="From"
                          value={lastUpdatedRangeFilter.from}
                          onChange={(e) => setLastUpdatedRangeFilter(prev => ({ ...prev, from: e.target.value }))}
                          className="px-3 py-1 border border-slate-300 rounded-lg text-sm bg-white"
                        />
                        <span className="text-slate-600">to</span>
                        <input
                          type="date"
                          placeholder="To"
                          value={lastUpdatedRangeFilter.to}
                          onChange={(e) => setLastUpdatedRangeFilter(prev => ({ ...prev, to: e.target.value }))}
                          className="px-3 py-1 border border-slate-300 rounded-lg text-sm bg-white"
                        />
                      </div>

                      {/* Sort By Filter */}
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-slate-600">Sort:</label>
                        <select
                          value={sortBy}
                          onChange={(e) => setSortBy(e.target.value as 'date' | 'type' | 'status' | 'agency' | 'assignedTo' | 'lastUpdated')}
                          className="px-3 py-1 border border-slate-300 rounded-lg text-sm bg-white"
                        >
                          <option value="date">Date</option>
                          <option value="type">Type</option>
                          <option value="status">Status</option>
                          <option value="agency">Agency</option>
                          <option value="assignedTo">Assigned To</option>
                          <option value="lastUpdated">Last Updated Date</option>
                        </select>
                        <button
                          onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                          className="px-2 py-1 border border-slate-300 rounded-lg text-sm bg-white hover:bg-slate-50"
                          title={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
                        >
                          {sortOrder === 'asc' ? '↑' : '↓'}
                        </button>
                      </div>

                      {/* Clear Filters Button */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setUserFilter('all');
                            setAgencyCategoryFilter('all');
                            setTypeFilter('all');
                            setAgencyNameFilter('');
                            setDateRangeFilter({ from: '', to: '' });
                            setLastUpdatedRangeFilter({ from: '', to: '' });
                          }}
                          className="px-3 py-1 bg-gray-500 text-white text-sm rounded-lg hover:bg-gray-600 transition-colors"
                          title="Clear all filters"
                        >
                          Clear Filters
                        </button>
                      </div>
                    </div>

                    {/* Date Filters for Completed Tab */}
                    {activeTab === 'completed' && (
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <label className="text-sm font-medium text-slate-600">From:</label>
                          <input
                            type="date"
                            value={dateFilter.startDate}
                            onChange={(e) => setDateFilter(prev => ({ ...prev, startDate: e.target.value }))}
                            className="px-3 py-1 border border-slate-300 rounded-lg text-sm"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-sm font-medium text-slate-600">To:</label>
                          <input
                            type="date"
                            value={dateFilter.endDate}
                            onChange={(e) => setDateFilter(prev => ({ ...prev, endDate: e.target.value }))}
                            className="px-3 py-1 border border-slate-300 rounded-lg text-sm"
                          />
                        </div>
                      </div>
                    )}

                    {/* Download Button */}
                    <button
                      onClick={handleDownloadExcel}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Download Excel
                    </button>
                  </div>
                </div>

                {currentTabFollowUps.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">
                      {activeTab === 'all' && '📋'}
                      {activeTab === 'planned' && '⏰'}
                      {activeTab === 'completed' && '✅'}
                    </div>
                    <h3 className="text-lg font-semibold text-slate-600 mb-2">
                      {activeTab === 'all' && 'No follow-ups found'}
                      {activeTab === 'planned' && 'No planned follow-ups'}
                      {activeTab === 'completed' && 'No completed follow-ups in this date range'}
                    </h3>
                    <p className="text-slate-500">
                      {activeTab === 'all' && 'Try adjusting your filters or check if follow-ups exist.'}
                      {activeTab === 'planned' && 'All your follow-ups are completed or you have none planned.'}
                      {activeTab === 'completed' && 'Try adjusting the date filter to see completed follow-ups.'}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-4 mb-8">
                      {paginatedFollowUps.map((followUp, index) => (

                        <div key={index} className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer group">
                          <div className="flex items-center justify-between">
                            <div
                              className="flex-1 cursor-pointer hover:bg-blue-50 p-2 rounded-lg transition-colors"
                              onClick={() => {
                                const lead = leads.find(l => l.id === followUp.leadId);
                                if (lead) {
                                  handleLeadNameClick(lead);
                                }
                              }}
                            >
                              <div className="flex items-center gap-3 mb-2">
                                <span className="text-2xl">{getTypeIcon(followUp.type)}</span>
                                <div>
                                  <h3 className="font-semibold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer transition-all duration-200 border-b border-transparent hover:border-blue-300 inline-flex items-center gap-2">
                                    <svg className="w-4 h-4 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                    {followUp.agencyName}
                                    {(() => {
                                      // Get the assigned user name from the lead
                                      const lead = leads.find(l => l.id === followUp.leadId);
                                      const assignedUser = lead?.accountManager || followUp.assignedTo;
                                      if (assignedUser) {
                                        const userName = getUserDisplayName(assignedUser);
                                        return (
                                          <span className="ml-2 px-2 py-1 bg-purple-100 text-purple-800 text-xs font-semibold rounded-full">
                                            👤 {userName}
                                          </span>
                                        );
                                      }
                                      return null;
                                    })()}
                                    <span className="text-xs opacity-60">(Click to edit lead)</span>
                                  </h3>
                                  <p className={`text-sm ${new Date(followUp.date) < new Date() && followUp.status === 'Planned' ? 'text-red-600 font-semibold' : 'text-slate-600'}`}>
                                    {followUp.type} - {formatDate(followUp.date)}
                                  </p>
                                  {new Date(followUp.date) < new Date() && followUp.status === 'Planned' && (
                                    <span className="inline-block px-2 py-1 bg-red-100 text-red-800 text-xs font-semibold rounded-full mt-1">
                                      ⚠️ Overdue
                                    </span>
                                  )}
                                </div>
                              </div>
                              {followUp.notes && (
                                <p className="text-sm text-slate-600 mb-2">{followUp.notes}</p>
                              )}
                              <div className="flex items-center gap-4 text-xs text-slate-500">
                                <span>Lead Status: {followUp.leadStatus}</span>
                                {(() => {
                                  const lead = leads.find(l => l.id === followUp.leadId);
                                  return lead ? (
                                    <span>Assigned to: {getUserDisplayName(lead.accountManager || followUp.assignedTo)}</span>
                                  ) : followUp.assignedTo ? (
                                    <span>Assigned to: {getUserDisplayName(followUp.assignedTo)}</span>
                                  ) : null;
                                })()}
                                {(() => {
                                  const lead = leads.find(l => l.id === followUp.leadId);
                                  return lead ? (
                                    <>
                                      {lead.agentCategory && (
                                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getAgentCategoryColor(lead.agentCategory)}`}>
                                          {lead.agentCategory}
                                        </span>
                                      )}
                                      {lead.onboardingDate && (
                                        <span>Onboarded: {formatDate(lead.onboardingDate)}</span>
                                      )}
                                    </>
                                  ) : null;
                                })()}
                                <span>Last update: {formatDate(ensureFollowUpTimestamps({ ...followUp }).updatedAt)}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(followUp.status)}`}>
                                {followUp.status}
                              </span>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditFollowUp(followUp);
                                  }}
                                  className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="Edit follow-up"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                                {onUpdateLead && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteFollowUp(followUp.leadId, followUp.id);
                                    }}
                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Delete follow-up"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                )}
                                {followUp.status === 'Planned' && onUpdateLead && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleUpdateFollowUpStatus(followUp.leadId, followUp.id, 'Done');
                                    }}
                                    className="px-3 py-1 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 transition-colors"
                                  >
                                    Mark Done
                                  </button>
                                )}
                                {onUpdateLead && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleMarkAsUpdated(followUp.leadId, followUp.id);
                                    }}
                                    className="px-3 py-1 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                                    title="Mark this follow-up as updated"
                                  >
                                    Mark Updated
                                  </button>
                                )}
                                {followUp.status === 'Done' && onUpdateLead && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleUpdateFollowUpStatus(followUp.leadId, followUp.id, 'Planned');
                                    }}
                                    className="px-3 py-1 bg-orange-600 text-white text-xs font-semibold rounded-lg hover:bg-orange-700 transition-colors"
                                  >
                                    Reopen
                                  </button>
                                )}

                                {/* Follow-up History Button for each lead */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setIsHistoryModalOpen(true);
                                    setEditingFollowUp(followUp);
                                  }}
                                  className="px-3 py-1 bg-purple-600 text-white text-xs font-semibold rounded-lg hover:bg-purple-700 transition-colors"
                                  title="View Follow-up History"
                                >
                                  History
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Pagination */}
                    {currentTabFollowUps.length > 0 && (
                      <div className="mt-6 mb-12 border-t border-slate-100 pt-6">
                        <SimplePagination
                          currentPage={currentPage}
                          totalPages={totalPages}
                          totalItems={currentTabFollowUps.length}
                          itemsPerPage={followUpsPerPage}
                          onPageChange={setCurrentPage}
                          onItemsPerPageChange={setFollowUpsPerPage}
                          startIndex={(currentPage - 1) * followUpsPerPage}
                          endIndex={Math.min(currentPage * followUpsPerPage, currentTabFollowUps.length)}
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Follow-up Modal */}
      {isEditModalOpen && (
        <Modal
          onClose={() => setIsEditModalOpen(false)}
          title="Edit Follow-up"
          maxWidth="max-w-4xl"
        >
          {editingFollowUp && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Follow-up Type
                  </label>
                  <select
                    value={editForm.type}
                    onChange={(e) => setEditForm(prev => ({ ...prev, type: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="Call">📞 Call</option>
                    <option value="Email">📧 Email</option>
                    <option value="Meeting">🤝 Meeting</option>
                    <option value="WhatsApp">💬 WhatsApp</option>
                    <option value="Visit">🏢 Visit</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Status
                  </label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm(prev => ({ ...prev, status: e.target.value as 'Planned' | 'Done' }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="Planned">🔵 Planned</option>
                    {/* <option value="Done">✅ Done</option> */}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Scheduled Date & Time
                </label>
                <CustomDateTimePicker
                  value={editForm.date && editForm.time ? `${editForm.date}T${editForm.time}` : ''}
                  onChange={(val) => {
                    const [d, t] = val.split('T');
                    setEditForm(prev => ({ ...prev, date: d, time: t }));
                  }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Assigned To
                </label>
                <select
                  value={editForm.assignedTo}
                  onChange={(e) => setEditForm(prev => ({ ...prev, assignedTo: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select User</option>
                  {availableUsers.map(user => (
                    <option key={user.email} value={user.email}>
                      {getUserDisplayName(user.email)} ({cleanCorruptedData(user.email)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Notes
                </label>
                <textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                  rows={4}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Add notes about this follow-up..."
                />
              </div>

              <div className="bg-slate-50 p-4 rounded-lg">
                <h4 className="font-medium text-slate-800 mb-2">Follow-up Details</h4>
                <div className="text-sm text-slate-600 space-y-1">
                  <p><strong>Agency:</strong> {editingFollowUp.agencyName}</p>
                  <p><strong>Lead Status:</strong> {editingFollowUp.leadStatus}</p>
                  <p><strong>Created:</strong> {new Date(ensureFollowUpTimestamps({ ...editingFollowUp }).createdAt).toLocaleString()}</p>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveFollowUp}
                  className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* Lead Edit Modal */}
      {isLeadEditModalOpen && (
        <Modal
          onClose={() => setIsLeadEditModalOpen(false)}
          title="Edit Lead"
          maxWidth="max-w-4xl"
        >
          {editingLead && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Agency Name
                  </label>
                  <input
                    type="text"
                    value={leadEditForm.agencyName}
                    onChange={(e) => setLeadEditForm(prev => ({ ...prev, agencyName: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter agency name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    value={leadEditForm.contactPerson}
                    onChange={(e) => setLeadEditForm(prev => ({ ...prev, contactPerson: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter contact person name"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={leadEditForm.email}
                    onChange={(e) => setLeadEditForm(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter email address"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={leadEditForm.phone}
                    onChange={(e) => setLeadEditForm(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter phone number"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Address
                </label>
                <textarea
                  value={leadEditForm.address}
                  onChange={(e) => setLeadEditForm(prev => ({ ...prev, address: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter address"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Status
                  </label>
                  <select
                    value={leadEditForm.status}
                    onChange={(e) => setLeadEditForm(prev => ({ ...prev, status: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="New">🆕 New</option>
                    <option value="Contacted">📞 Contacted</option>
                    <option value="Qualified">✅ Qualified</option>
                    <option value="Onboarded">🚀 Onboarded</option>
                    <option value="Rejected">❌ Rejected</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Assigned To
                  </label>
                  <select
                    value={leadEditForm.assignedTo}
                    onChange={(e) => setLeadEditForm(prev => ({ ...prev, assignedTo: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select User</option>
                    {availableUsers.map(user => (
                      <option key={user.email} value={user.email}>
                        {getUserDisplayName(user.email)} ({cleanCorruptedData(user.email)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Notes
                </label>
                <textarea
                  value={leadEditForm.notes}
                  onChange={(e) => setLeadEditForm(prev => ({ ...prev, notes: e.target.value }))}
                  rows={4}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Add notes about this lead..."
                />
              </div>

              <div className="flex justify-between pt-4 border-t border-slate-200">
                <button
                  onClick={() => {
                    setIsLeadEditModalOpen(false);
                    setIsNewFollowUpModalOpen(true);
                  }}
                  className="px-4 py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg transition-colors"
                >
                  ➕ Add New Follow-up
                </button>

                <div className="flex gap-3">
                  <button
                    onClick={() => setIsLeadEditModalOpen(false)}
                    className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveLead}
                    className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors"
                  >
                    Save Lead
                  </button>
                </div>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* New Follow-up Modal */}
      {isNewFollowUpModalOpen && (
        <Modal
          onClose={() => setIsNewFollowUpModalOpen(false)}
          title="Add New Follow-up"
          maxWidth="max-w-2xl"
        >
          {editingLead && (
            <div className="space-y-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium text-blue-800 mb-2">Adding follow-up for:</h4>
                <p className="text-blue-700">{editingLead.agencyName}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Follow-up Type
                  </label>
                  <select
                    value={newFollowUpForm.type}
                    onChange={(e) => setNewFollowUpForm(prev => ({ ...prev, type: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="Call">📞 Call</option>
                    <option value="Email">📧 Email</option>
                    <option value="Meeting">🤝 Meeting</option>
                    <option value="New Assessment">📋 New Assessment</option>
                    <option value="Assessment Follow-up">🔄 Assessment Follow-up</option>
                    <option value="WhatsApp">💬 WhatsApp</option>
                    <option value="Visit">🏢 Visit</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Assigned To
                  </label>
                  <select
                    value={newFollowUpForm.assignedTo}
                    onChange={(e) => setNewFollowUpForm(prev => ({ ...prev, assignedTo: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select User</option>
                    {availableUsers.map(user => (
                      <option key={user.email} value={user.email}>
                        {getUserDisplayName(user.email)} ({cleanCorruptedData(user.email)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Scheduled Date & Time
                </label>
                <CustomDateTimePicker
                  value={newFollowUpForm.date && newFollowUpForm.time ? `${newFollowUpForm.date}T${newFollowUpForm.time}` : ''}
                  onChange={(val) => {
                    const [d, t] = val.split('T');
                    setNewFollowUpForm(prev => ({ ...prev, date: d, time: t }));
                  }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Notes
                </label>
                <textarea
                  value={newFollowUpForm.notes}
                  onChange={(e) => setNewFollowUpForm(prev => ({ ...prev, notes: e.target.value }))}
                  rows={4}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Add notes about this follow-up..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  onClick={() => setIsNewFollowUpModalOpen(false)}
                  className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateNewFollowUp}
                  disabled={isAddingNewFollowUp}
                  className={`px-4 py-2 text-white rounded-lg transition-colors flex items-center justify-center min-w-[150px] ${
                    isAddingNewFollowUp
                      ? 'bg-green-400 cursor-not-allowed opacity-70'
                      : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  {isAddingNewFollowUp ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Creating...
                    </>
                  ) : (
                    'Create Follow-up'
                  )}
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* Follow-up History Modal */}
      {isHistoryModalOpen && editingFollowUp && (
        <Modal
          onClose={() => {
            setIsHistoryModalOpen(false);
            setEditingFollowUp(null);
          }}
          title={`Follow-up History - ${editingFollowUp.agencyName}`}
          maxWidth="max-w-4xl"
        >
          <div className="space-y-6">
            {/* Current Follow-up Details */}
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h3 className="text-lg font-semibold text-blue-800 mb-3">Current Follow-up Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-blue-700">Type:</span>
                  <span className="ml-2 text-blue-800">{editingFollowUp.type}</span>
                </div>
                <div>
                  <span className="font-medium text-blue-700">Status:</span>
                  <span className="ml-2 text-blue-800">{editingFollowUp.status}</span>
                </div>
                <div>
                  <span className="font-medium text-blue-700">Scheduled Date:</span>
                  <span className="ml-2 text-blue-800">{formatDate(editingFollowUp.date)}</span>
                </div>
                <div>
                  <span className="font-medium text-blue-700">Assigned To:</span>
                  <span className="ml-2 text-blue-800">{getUserDisplayName(editingFollowUp.assignedTo)}</span>
                </div>
                <div className="md:col-span-2">
                  <span className="font-medium text-blue-700">Notes:</span>
                  <p className="ml-2 text-blue-800 mt-1">{editingFollowUp.notes}</p>
                </div>
              </div>
            </div>

            {/* History Timeline */}
            <div className="bg-white p-4 rounded-lg border border-slate-200">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Follow-up History Timeline</h3>

              {/* Find the lead to get all its follow-ups */}
              {(() => {
                const lead = leads.find(l => l.id === editingFollowUp.leadId);
                // 🟢 SAFE FIX: Robust history check
                if (!lead || !Array.isArray(lead.followUps) || lead.followUps.length === 0) {
                  return (
                    <div className="text-center py-8 text-slate-500">
                      <p>No follow-up history found for this lead.</p>
                    </div>
                  );
                }

                // Sort follow-ups by date (most recent first)
                const sortedFollowUps = [...lead.followUps].sort((a, b) => {
                  const aDate = a.updatedAt || a.createdAt || '1900-01-01T00:00:00.000Z';
                  const bDate = b.updatedAt || b.createdAt || '1900-01-01T00:00:00.000Z';
                  return new Date(bDate).getTime() - new Date(aDate).getTime();
                });

                return (
                  <div className="space-y-4">
                    {sortedFollowUps.map((followUp, index) => (
                      <div key={followUp.id} className="border-l-4 border-purple-400 pl-4 py-3 bg-purple-50 rounded-r-lg">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <span className="font-semibold text-purple-800">{followUp.type}</span>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${followUp.status === 'Done' ? 'bg-green-100 text-green-800' :
                                followUp.status === 'Planned' ? 'bg-blue-100 text-blue-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                {followUp.status}
                              </span>
                              {followUp.id === editingFollowUp.id && (
                                <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full">
                                  Current
                                </span>
                              )}
                            </div>

                            <div className="text-sm text-slate-600 space-y-1">
                              <p><span className="font-medium">Scheduled:</span> <span className={new Date(followUp.date) < new Date() && followUp.status === 'Planned' ? 'text-red-600 font-semibold' : ''}>{formatDate(followUp.date)}</span></p>
                              <p><span className="font-medium">Created:</span> {formatDate(ensureFollowUpTimestamps({ ...followUp }).createdAt)}</p>
                              {followUp.updatedAt && followUp.updatedAt !== followUp.createdAt && (
                                <p><span className="font-medium">Last Updated:</span> {formatDate(followUp.updatedAt)}</p>
                              )}
                              <p><span className="font-medium">Assigned To:</span> {getUserDisplayName(followUp.assignedTo)}</p>
                              {followUp.createdBy && (
                                <p><span className="font-medium">Created By:</span> {getUserDisplayName(followUp.createdBy)}</p>
                              )}
                            </div>

                            {followUp.notes && (
                              <div className="mt-3 p-3 bg-white rounded border">
                                <p className="text-sm font-medium text-slate-700 mb-1">Remarks:</p>
                                <p className="text-sm text-slate-600">{followUp.notes}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Close Button */}
            <div className="flex justify-end">
              <button
                onClick={() => {
                  setIsHistoryModalOpen(false);
                  setEditingFollowUp(null);
                }}
                className="px-6 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export const FollowUps = React.memo(FollowUpsInner);