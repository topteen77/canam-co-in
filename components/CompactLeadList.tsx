import React, { useState, useMemo } from 'react';
import type { Lead, FollowUpType, FollowUpStatus } from '../types';
import { trackCallAction, trackWhatsAppAction, trackEmailAction } from '../services/ctaTrackingService';
import { EmailTemplateSelector } from './EmailTemplateSelector';
import { createWhatsAppUrl } from '../utils/whatsappUtils';

interface CompactLeadListProps {
  leads: Lead[];
  onSelectLead: (lead: Lead, followUpId?: string) => void;
  onMeetingCheckIn: (leadId: string) => void;
  meetingCheckIns: any[];
  currentUser: string | null;
  isAdmin: boolean;
  userRole?: string | null;
  selectedLeads: string[];
  onToggleLeadSelection: (leadId: string) => void;
  onSelectAllLeads: () => void;
  availableUsers: Array<{id: string, name: string, email: string, role: string}>;
  onAssignLead?: (leadId: string, accountManager: string, salesPerson: string) => void;
  onBulkDeleteLeads?: (leadIds: string[]) => void;
  onBulkAssignLeads?: (leadIds: string[], accountManager: string, salesPerson: string) => void;
  onClearSelection?: () => void;
  onUpdateLead?: (leadId: string, updates: Partial<Lead>) => void;
}

interface ColumnConfig {
  id: string;
  label: string;
  width: string;
  visible: boolean;
  sortable?: boolean;
}

const getShortUserName = (email: string): string => {
  if (!email) return 'N/A';
  const name = email.split('@')[0];
  return name.length > 8 ? name.substring(0, 8) + '...' : name;
};

const getUserDisplayNameLocal = (email: string, availableUsers: Array<{id: string, name: string, email: string, role: string}>): string => {
  if (!email) return 'N/A';
  if (!availableUsers || availableUsers.length === 0) {
    return getShortUserName(email);
  }
  
  const user = availableUsers.find(u => u.email && u.email.toLowerCase() === email.toLowerCase());
  if (user && user.name && user.name.trim()) {
    return user.name.length > 8 ? user.name.substring(0, 8) + '...' : user.name;
  }
  
  return getShortUserName(email);
};

// Helper function to check if a follow-up is missed
const isMissedFollowUp = (followUp: any): boolean => {
  if (followUp.status !== 'Planned') return false;
  const followUpDate = new Date(followUp.date);
  const now = new Date();
  return followUpDate < now;
};

// 🟢 SAFE FIX: Rewritten getNextAction to handle null data safely
const getNextAction = (lead: Lead) => {
  // Ensure followUps is an array
  const safeFollowUps = Array.isArray(lead.followUps) ? lead.followUps : [];
  
  if (safeFollowUps.length === 0) {
    return { action: 'No follow-ups', date: '', time: '', isMissed: false };
  }
  
  // Find the next upcoming follow-up
  const upcomingFollowUps = safeFollowUps
    .filter(fu => fu.status === 'Planned')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  if (upcomingFollowUps.length > 0) {
    const nextFollowUp = upcomingFollowUps[0];
    const date = new Date(nextFollowUp.date);
    return {
      action: nextFollowUp.type,
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isMissed: isMissedFollowUp(nextFollowUp)
    };
  }
  
  // If no upcoming follow-ups, show the most recent one
  const recentFollowUp = [...safeFollowUps]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  
  if (recentFollowUp) {
    const date = new Date(recentFollowUp.date);
    return {
      action: recentFollowUp.type,
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isMissed: isMissedFollowUp(recentFollowUp)
    };
  }
  
  return { action: 'No follow-ups', date: '', time: '', isMissed: false };
};

const getColumnIcon = (columnId: string): string => {
  const icons: { [key: string]: string } = {
    'select': '☑️',
    'agencyName': '🏢',
    'status': '📊',
    'leadSource': '🔗',
    'contact': '👤',
    'phone': '📞',
    'email': '📧',
    'onboardedDate': '📅',
    'onboardingDate': '🚀',
    'remarks': '📝',
    'city': '📍',
    'accountManager': '👨‍💼',
    'salesPerson': '💼',
    'createdBy': '👤',
    'createdAt': '📅',
    'followUps': '🔄',
    'nextAction': '⏭️',
    'actions': '⚙️',
    'icpScore': '🎯'
  };
  return icons[columnId] || '📋';
};

const getStatusColor = (status: string) => {
  const colors = {
    'New': 'bg-blue-100 text-blue-800',
    'In Pipeline': 'bg-amber-100 text-amber-800',
    'ICP Qualified': 'bg-purple-100 text-purple-800',
    'Portal Deactivated': 'bg-orange-100 text-orange-800',
    'Onboarded': 'bg-green-100 text-green-800',
    'Lost': 'bg-red-100 text-red-800',
    'MOU Signature Pending': 'bg-yellow-100 text-yellow-800',
    'Agent Portal Created': 'bg-indigo-100 text-indigo-800',
    'Agent Portal Reactivated': 'bg-teal-100 text-teal-800'
  };
  return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
};

const getCategoryColor = (category: string) => {
  const colors = {
    'Diamond': 'bg-sky-100 text-sky-800',
    'Gold': 'bg-yellow-100 text-yellow-800',
    'Silver': 'bg-slate-200 text-slate-800',
    'Bronze': 'bg-orange-200 text-orange-800',
    'Beginner': 'bg-gray-100 text-gray-800',
  };
  return colors[category as keyof typeof colors] || 'bg-gray-100 text-gray-800';
};

// Email Link Icon Component for Compact View
const EmailLinkIconCompact: React.FC<{
  email: string;
  recipientName?: string;
  agencyName?: string;
  currentUser: string | null;
  leadId: string;
  leadName: string;
  getUserDisplayNameLocal: (email: string) => string;
}> = ({ email, recipientName, agencyName, currentUser, leadId, leadName, getUserDisplayNameLocal }) => {
  const [showEmailTemplateModal, setShowEmailTemplateModal] = useState(false);

  const handleEmailClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentUser) {
      trackEmailAction(
        currentUser,
        getUserDisplayNameLocal(currentUser),
        email,
        leadId,
        leadName,
        recipientName,
        leadName
      );
      setShowEmailTemplateModal(true);
    } else {
      window.open(`mailto:${email}`, '_self');
    }
  };

  return (
    <>
      <button
        onClick={handleEmailClick}
        className="p-1 text-orange-500 hover:text-orange-700 hover:bg-orange-100 rounded"
        title={`Email ${email}`}
      >
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
          <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
        </svg>
      </button>
      {currentUser && (
        <EmailTemplateSelector
          isOpen={showEmailTemplateModal}
          onClose={() => setShowEmailTemplateModal(false)}
          recipientEmail={email}
          recipientName={recipientName}
          agencyName={agencyName}
          currentUser={currentUser}
        />
      )}
    </>
  );
};

// Email Button for Mobile Card View
const EmailButtonMobile: React.FC<{
  email: string;
  recipientName?: string;
  agencyName?: string;
  currentUser: string | null;
  leadId: string;
  leadName: string;
  getUserDisplayNameLocal: (email: string) => string;
}> = ({ email, recipientName, agencyName, currentUser, leadId, leadName, getUserDisplayNameLocal }) => {
  const [showEmailTemplateModal, setShowEmailTemplateModal] = useState(false);

  const handleEmailClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentUser) {
      trackEmailAction(
        currentUser,
        getUserDisplayNameLocal(currentUser),
        email,
        leadId,
        leadName,
        recipientName,
        leadName
      );
      setShowEmailTemplateModal(true);
    } else {
      window.open(`mailto:${email}`, '_self');
    }
  };

  return (
    <>
      <button
        onClick={handleEmailClick}
        className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-orange-500 text-white rounded-xl text-base font-semibold hover:bg-orange-600 transition-colors shadow-sm"
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
        </svg>
        <span>Send Email</span>
      </button>
      {currentUser && (
        <EmailTemplateSelector
          isOpen={showEmailTemplateModal}
          onClose={() => setShowEmailTemplateModal(false)}
          recipientEmail={email}
          recipientName={recipientName}
          agencyName={agencyName}
          currentUser={currentUser}
        />
      )}
    </>
  );
};

// Email Button for Contact Details
const EmailButtonContact: React.FC<{
  email: string;
  recipientName?: string;
  agencyName?: string;
  currentUser: string | null;
  leadId: string;
  leadName: string;
  getUserDisplayNameLocal: (email: string) => string;
}> = ({ email, recipientName, agencyName, currentUser, leadId, leadName, getUserDisplayNameLocal }) => {
  const [showEmailTemplateModal, setShowEmailTemplateModal] = useState(false);

  const handleEmailClick = () => {
    if (currentUser) {
      trackEmailAction(
        currentUser,
        getUserDisplayNameLocal(currentUser),
        email,
        leadId,
        leadName,
        recipientName,
        leadName
      );
      setShowEmailTemplateModal(true);
    } else {
      window.open(`mailto:${email}`, '_self');
    }
  };

  return (
    <>
      <button
        onClick={handleEmailClick}
        className="px-3 py-1 bg-orange-500 text-white text-xs rounded hover:bg-orange-600"
      >
        Email
      </button>
      {currentUser && (
        <EmailTemplateSelector
          isOpen={showEmailTemplateModal}
          onClose={() => setShowEmailTemplateModal(false)}
          recipientEmail={email}
          recipientName={recipientName}
          agencyName={agencyName}
          currentUser={currentUser}
        />
      )}
    </>
  );
};

export const CompactLeadList: React.FC<CompactLeadListProps> = ({
  leads,
  onSelectLead,
  onMeetingCheckIn,
  meetingCheckIns,
  currentUser,
  isAdmin,
  userRole,
  selectedLeads,
  onToggleLeadSelection,
  onSelectAllLeads,
  availableUsers,
  onAssignLead,
  onUpdateLead
}) => {
  // Simple function to get user display name
  const getUserDisplayNameLocal = (email: string): string => {
    if (!email) return 'Unknown';
    
    // Try to find user in availableUsers first
    if (availableUsers && availableUsers.length > 0) {
      const user = availableUsers.find(u => u.email && u.email.toLowerCase() === (email || '').toLowerCase());
      if (user && user.name && user.name.trim()) {
        return user.name;
      }
    }
    
    const emailToNameMap: { [key: string]: string } = {
      'iapplyam2b2b@gmail.com': 'Nakul Kathota',
      'canamrakesh@gmail.com': 'Rakesh',
      'amit.iapply@gmail.com': 'Amit Kumar',
      'admin@iapply.com': 'Admin',
      'support@iapply.com': 'Support Team'
    };
    
    const mappedName = emailToNameMap[(email || '').toLowerCase()];
    if (mappedName) {
      return mappedName;
    }
    const safeEmail = email || '';
    const emailPrefix = safeEmail.split('@')[0] || 'Unknown';
    return emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
  };

  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [showContactPopup, setShowContactPopup] = useState(false);
  const [selectedLeadContacts, setSelectedLeadContacts] = useState<Lead | null>(null);
  const [showIcpScoreModal, setShowIcpScoreModal] = useState(false);
  const [selectedLeadForIcp, setSelectedLeadForIcp] = useState<Lead | null>(null);
  const [showReferenceTable, setShowReferenceTable] = useState(false);
  const [categoryScores, setCategoryScores] = useState<{[key: string]: number | ''}>({
    'Business Profile': '',
    'Services Portfolio': '',
    'Online Presence': '',
    'Operational Scale': '',
    'Applicant Volume': '',
    'Team Strength': '',
    'Network Strength': '',
    'Applicant Quality': '',
    'Physical Presence': ''
  });
  const [columnConfig, setColumnConfig] = useState<ColumnConfig[]>([
    { id: 'select', label: '', width: 'w-12', visible: isAdmin },
    { id: 'agencyName', label: 'Agency', width: 'w-48', visible: true, sortable: true },
    { id: 'status', label: 'Status', width: 'w-20', visible: true, sortable: true },
    { id: 'icpScore', label: 'ICP Score', width: 'w-16', visible: true, sortable: true },
    { id: 'leadSource', label: 'Source', width: 'w-20', visible: false, sortable: true },
    { id: 'contact', label: 'Contact', width: 'w-24', visible: true },
    { id: 'phone', label: 'Phone', width: 'w-20', visible: true },
    { id: 'onboardedDate', label: 'Account Created', width: 'w-24', visible: false, sortable: true },
    { id: 'onboardingDate', label: 'Onboarding Date', width: 'w-24', visible: true, sortable: true },
    { id: 'remarks', label: 'Remarks', width: 'w-32', visible: true },
    { id: 'city', label: 'City', width: 'w-16', visible: true },
    { id: 'salesPerson', label: 'Sales', width: 'w-16', visible: false },
    { id: 'createdBy', label: 'By', width: 'w-16', visible: true, sortable: true },
    { id: 'createdAt', label: 'Date', width: 'w-16', visible: true, sortable: true },
    { id: 'followUps', label: 'Follow-ups', width: 'w-40', visible: true },
    { id: 'nextAction', label: 'Next Action', width: 'w-40', visible: true },
    { id: 'actions', label: 'Act', width: 'w-16', visible: true }
  ]);

  const [showColumnSelector, setShowColumnSelector] = useState(false);

  const sortedLeads = useMemo(() => {
    if (!sortConfig) return leads;

    return [...leads].sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sortConfig.key) {
        case 'agencyName':
          aValue = (a.agencyName || '').toLowerCase();
          bValue = (b.agencyName || '').toLowerCase();
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        case 'icpScore':
          aValue = a.icpScore !== undefined && a.icpScore !== null ? a.icpScore : -1;
          bValue = b.icpScore !== undefined && b.icpScore !== null ? b.icpScore : -1;
          break;
        case 'category':
          aValue = a.agentCategory;
          bValue = b.agentCategory;
          break;
        case 'onboardingDate':
          aValue = a.onboardingDate ? new Date(a.onboardingDate).getTime() : 0;
          bValue = b.onboardingDate ? new Date(b.onboardingDate).getTime() : 0;
          break;
        case 'remarks':
          aValue = (a.remarks || '').toLowerCase();
          bValue = (b.remarks || '').toLowerCase();
          break;
        case 'createdBy':
          aValue = (a.createdBy || '').toLowerCase();
          bValue = (b.createdBy || '').toLowerCase();
          break;
        case 'createdAt':
          aValue = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          bValue = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [leads, sortConfig]);

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev?.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const toggleColumnVisibility = (columnId: string) => {
    setColumnConfig(prev => prev.map(col => 
      col.id === columnId ? { ...col, visible: !col.visible } : col
    ));
  };

  const visibleColumns = columnConfig.filter(col => col.visible);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const formatPhone = (phone: string) => {
    if (!phone) return 'N/A';
    const maxLength = phone.startsWith('+') ? 18 : 15;
    return phone.length > maxLength ? phone.substring(0, maxLength) + '...' : phone;
  };

  const formatEmail = (email: string) => {
    if (!email) return 'N/A';
    const [name, domain] = email.split('@');
    return name.length > 8 ? name.substring(0, 8) + '...' : name;
  };

  return (
    <div className="w-full">
      {/* Column Selector - wraps on small screens */}
      <div className="mb-3 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <button
            onClick={() => setShowColumnSelector(!showColumnSelector)}
            className="px-2 sm:px-3 py-1 text-xs sm:text-sm bg-slate-100 hover:bg-slate-200 rounded-md border"
          >
            📊 Columns ({visibleColumns.length})
          </button>
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                setColumnConfig(prev => prev.map(col => ({
                  ...col,
                  visible: ['select', 'agencyName', 'status', 'icpScore', 'contact', 'phone', 'followUps', 'nextAction', 'actions'].includes(col.id)
                })));
              }}
              className="px-1.5 sm:px-2 py-0.5 sm:py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
              title="Essential columns only"
            >
              Essential
            </button>
            <button
              onClick={() => {
                setColumnConfig(prev => prev.map(col => ({
                  ...col,
                  visible: ['select', 'agencyName', 'status', 'icpScore', 'contact', 'phone', 'city', 'createdBy', 'followUps', 'nextAction', 'actions'].includes(col.id)
                })));
              }}
              className="px-1.5 sm:px-2 py-0.5 sm:py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
              title="All important columns"
            >
              Full
            </button>
            <button
              onClick={() => {
                setColumnConfig(prev => prev.map(col => ({ ...col, visible: true })));
              }}
              className="px-1.5 sm:px-2 py-0.5 sm:py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
              title="Show all columns"
            >
              All
            </button>
          </div>
          <span className="text-xs sm:text-sm text-slate-600">
            {leads.length} leads • {selectedLeads.length} selected
          </span>
        </div>
        
        {isAdmin && (
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={onSelectAllLeads}
              className="px-2 sm:px-3 py-1 text-xs bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200"
            >
              Select All
            </button>
            <button
              onClick={() => onToggleLeadSelection('')}
              className="px-2 sm:px-3 py-1 text-xs bg-slate-100 text-slate-700 rounded hover:bg-slate-200"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Column Selector Dropdown */}
      {showColumnSelector && (
        <div className="mb-4 p-4 bg-white border border-slate-200 rounded-lg shadow-sm">
          <h4 className="font-medium text-blue-800 mb-3">Select Columns to Display</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {columnConfig.map(column => (
              <label key={column.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={column.visible}
                  onChange={() => toggleColumnVisibility(column.id)}
                  className="rounded border-slate-300"
                />
                <span className="text-slate-700">{column.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Compact Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto max-w-full">
          <table className="w-full table-fixed">
            {/* Frozen Header */}
            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
              <tr>
                {visibleColumns.map(column => (
                  <th
                    key={column.id}
                    className={`${column.width} px-0.5 sm:px-1 py-1.5 sm:py-2 text-left text-[10px] sm:text-xs font-medium text-slate-500 uppercase tracking-wider border-r border-slate-200 last:border-r-0 overflow-hidden min-w-0`}
                  >
                    {column.id === 'select' ? (
                      <input
                        type="checkbox"
                        checked={selectedLeads.length === leads.length && leads.length > 0}
                        onChange={onSelectAllLeads}
                        className="lead-list-checkbox rounded border-slate-300 h-3 w-3 sm:h-4 sm:w-4"
                      />
                    ) : column.sortable ? (
                      <button
                        onClick={() => handleSort(column.id)}
                        className="flex items-center gap-1 hover:text-slate-700"
                      >
                        <span className="text-xs">{getColumnIcon(column.id)}</span>
                        {column.label}
                        {sortConfig?.key === column.id && (
                          <span className="text-indigo-600">
                            {sortConfig.direction === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </button>
                    ) : (
                      <div className="flex items-center gap-1">
                        <span className="text-xs">{getColumnIcon(column.id)}</span>
                        {column.label}
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="bg-white divide-y divide-slate-200">
              {sortedLeads.map((lead) => {
                // 🟢 SAFE FIX: Pre-calculate safe lists for this row
                const safeContacts = Array.isArray(lead.contacts) ? lead.contacts : [];
                const safeFollowUps = Array.isArray(lead.followUps) ? lead.followUps : [];
                const firstContact = safeContacts[0] || {};
                
                return (
                  <tr
                    key={lead.id}
                    className={`hover:bg-slate-50 cursor-pointer ${selectedLeads.includes(lead.id) ? 'bg-indigo-50' : ''}`}
                    onClick={() => onSelectLead(lead)}
                  >
                    {visibleColumns.map(column => {
                      // Check if this column should prevent row click
                      const isClickableColumn = column.id === 'followUps' || column.id === 'nextAction';
                        return (
                        <td
                          key={column.id}
                          className={`${column.width} px-0.5 sm:px-1 py-0.5 sm:py-1 text-[10px] sm:text-xs border-r border-slate-100 last:border-r-0 overflow-hidden min-w-0`}
                          onClick={isClickableColumn ? (e) => e.stopPropagation() : undefined}
                        >
                        {column.id === 'select' && (
                          <input
                            type="checkbox"
                            checked={selectedLeads.includes(lead.id)}
                            onChange={(e) => {
                              e.stopPropagation();
                              onToggleLeadSelection(lead.id);
                            }}
                            className="lead-list-checkbox rounded border-slate-300 h-3 w-3 sm:h-4 sm:w-4"
                          />
                        )}
                        
                        {column.id === 'agencyName' && (
                          <div className="truncate" title={lead.agencyName}>
                            <div className="font-medium text-slate-900 text-xs flex items-center gap-1">
                              {lead.agencyName}
                              {(() => {
                                // 🟢 SAFE FIX: Force it to be an array
                                const rawInterest = lead.countryInterest;
                                const countryInterest = Array.isArray(rawInterest) ? rawInterest : ['Canada'];

                                const flagMap: Record<string, string> = {
                                  'Canada': '🇨🇦',
                                  'UK': '🇬🇧',
                                  'USA': '🇺🇸'
                                };
                                
                                return (
                                  <span className="flex items-center gap-0.5" title={countryInterest.join(' → ')}>
                                    {countryInterest.map((country, idx) => (
                                      <span key={idx} className="text-xs">
                                        {flagMap[country] || country}
                                      </span>
                                    ))}
                                  </span>
                                );
                              })()}
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              {lead.accountManager && (
                                <span className="inline-block mr-2 px-1.5 py-0.5 bg-orange-100 text-orange-800 rounded-full text-xs font-medium">
                                  AM: {getUserDisplayNameLocal(lead.accountManager)}
                                </span>
                              )}
                              <span className={`inline-flex px-1.5 py-0.5 text-xs font-medium rounded-full ${getCategoryColor(lead.agentCategory)}`}>
                                {lead.agentCategory}
                              </span>
                            </div>
                          </div>
                        )}
                        
                        {column.id === 'status' && (
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(lead.status)}`}>
                            {lead.status}
                          </span>
                        )}
                        
                        {column.id === 'icpScore' && (
                          <div className="text-center">
                            {lead.icpScore !== undefined && lead.icpScore !== null ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedLeadForIcp(lead);
                                  setShowIcpScoreModal(true);
                                }}
                                className="inline-flex items-center justify-center px-2 py-1 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-800 min-w-[2rem] hover:bg-indigo-200 cursor-pointer transition-colors"
                                title="Click to view ICP Score details"
                              >
                                🎯 {lead.icpScore}/10
                              </button>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedLeadForIcp(lead);
                                  setShowIcpScoreModal(true);
                                }}
                                className="inline-flex items-center justify-center px-2 py-1 text-xs font-medium rounded-full bg-slate-100 text-slate-500 min-w-[2rem] hover:bg-slate-200 cursor-pointer transition-colors"
                                title="Click to set ICP Score"
                              >
                                NA
                              </button>
                            )}
                          </div>
                        )}
                        
                        {column.id === 'leadSource' && (
                          <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                            {lead.leadSource || 'Website'}
                          </span>
                        )}
                        
                        {column.id === 'contact' && (
                          <div className="flex flex-col gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedLeadContacts(lead);
                                setShowContactPopup(true);
                              }}
                              className="text-slate-900 text-xs font-medium hover:text-blue-600 hover:underline text-left truncate"
                              title={`View all contacts for ${lead.agencyName}`}
                            >
                              {firstContact.name || 'N/A'}
                            </button>
                            <div className="flex items-center gap-1">
                              {firstContact.phone && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                    if (currentUser) {
                                      trackCallAction(
                                        currentUser,
                                        getUserDisplayNameLocal(currentUser),
                                        firstContact.phone || '',
                                        lead.id,
                                        lead.agencyName,
                                        firstContact.name,
                                        lead.agencyName
                                      );
                                    }
                                    window.open(`tel:${firstContact.phone}`, '_self');
                                }}
                                className="p-1 text-green-600 hover:text-green-800 hover:bg-green-100 rounded"
                                title={`Call ${firstContact.phone}`}
                              >
                                📞
                              </button>
                              )}
                              {firstContact.email && (
                                <EmailLinkIconCompact 
                                  email={firstContact.email || ''}
                                  recipientName={firstContact.name}
                                  agencyName={lead.agencyName}
                                  currentUser={currentUser}
                                  leadId={lead.id}
                                  leadName={lead.agencyName}
                                  getUserDisplayNameLocal={getUserDisplayNameLocal}
                                />
                              )}
                              {firstContact.phone && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (currentUser) {
                                      trackWhatsAppAction(
                                        currentUser,
                                        getUserDisplayNameLocal(currentUser),
                                        firstContact.phone || '',
                                        lead.id,
                                        lead.agencyName,
                                        firstContact.name,
                                        lead.agencyName
                                      );
                                    }
                                    const message = `Hi ${firstContact.name}, I hope you're doing well. I wanted to reach out regarding our business discussion.`;
                                    try {
                                      const whatsappUrl = createWhatsAppUrl(firstContact.phone || '', message);
                                      window.open(whatsappUrl, '_blank');
                                    } catch (error) {
                                      alert('Invalid phone number.');
                                    }
                                  }}
                                  className="p-1 text-green-500 hover:text-green-700 hover:bg-green-100 rounded"
                                  title={`WhatsApp ${firstContact.phone}`}
                                >
                                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
                                  </svg>
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {column.id === 'phone' && (
                          <div className="text-slate-600" title={firstContact.phone}>
                            {formatPhone(firstContact.phone || '')}
                          </div>
                        )}
                        
                        {column.id === 'onboardedDate' && (
                          <div className="text-slate-600 truncate" title={lead.onboardingDate ? new Date(lead.onboardingDate).toLocaleDateString() : 'Not onboarded'}>
                            {lead.onboardingDate ? formatDate(lead.onboardingDate) : 'N/A'}
                          </div>
                        )}
                        
                        {column.id === 'onboardingDate' && (
                          <div className="text-slate-600 truncate" title={lead.onboardingDate ? new Date(lead.onboardingDate).toLocaleDateString() : 'Not set'}>
                            {(() => {
                              if (lead.onboardingDate) {
                                try {
                                  const date = new Date(lead.onboardingDate);
                                  return isNaN(date.getTime()) ? 'Invalid date' : date.toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric'
                                  });
                                } catch (error) {
                                  return 'Invalid date';
                                }
                              }
                              return 'N/A';
                            })()}
                          </div>
                        )}
                        
                        {column.id === 'remarks' && (
                          <div className="text-slate-600 truncate" title={lead.remarks || 'No remarks'}>
                            {lead.remarks && lead.remarks.trim() ? (
                              lead.remarks.length > 20 ? lead.remarks.substring(0, 20) + '...' : lead.remarks
                            ) : 'N/A'}
                          </div>
                        )}
                        
                        {column.id === 'city' && (
                          <div className="text-slate-600 truncate" title={firstContact.city}>
                            {(() => {
                              const cityData = firstContact.city || 'N/A';
                              if (cityData.includes(',') && cityData.length > 20) {
                                const parts = cityData.split(',');
                                return parts[parts.length - 1].trim();
                              }
                              if (cityData.length > 15) {
                                return cityData.substring(0, 15) + '...';
                              }
                              return cityData;
                            })()}
                          </div>
                        )}
                        
                        
                        {column.id === 'salesPerson' && (
                          <div className="text-slate-600 truncate" title={lead.salesPerson}>
                            {getUserDisplayNameLocal(lead.salesPerson || '')}
                          </div>
                        )}
                        
                        {column.id === 'createdBy' && (
                          <div className="text-slate-600 truncate" title={lead.createdBy}>
                            {getUserDisplayNameLocal(lead.createdBy)}
                          </div>
                        )}
                        
                        {column.id === 'createdAt' && (
                          <div className="text-slate-600">
                            {formatDate(lead.createdAt)}
                          </div>
                        )}
                        
                        {column.id === 'followUps' && (
                          <div 
                            className={`text-slate-600 ${safeFollowUps.length > 0 ? 'cursor-pointer hover:text-indigo-600 hover:underline' : ''}`}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (safeFollowUps.length > 0) {
                                onSelectLead(lead, 'FOLLOWUPS_TAB');
                              }
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            title={safeFollowUps.length > 0 ? "Click to view all follow-ups" : "No follow-ups"}
                          >
                            {safeFollowUps.length > 0 ? (
                              <div>
                                <div className="text-xs font-medium">
                                  {safeFollowUps.length} follow-up{safeFollowUps.length !== 1 ? 's' : ''}
                                </div>
                                {/* 🟢 SAFE FIX: Use slice on safe array */}
                                {safeFollowUps.slice(0, 2).map((followUp, index) => {
                                  const date = new Date(followUp.date);
                                  const missed = isMissedFollowUp(followUp);
                                  return (
                                    <div key={index} className={`text-xs mt-0.5 ${missed ? 'text-red-600 font-semibold' : 'text-slate-500'}`}>
                                      {followUp.type} - {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                  );
                                })}
                                {safeFollowUps.length > 2 && (
                                  <div className="text-xs text-slate-400 mt-0.5">
                                    +{safeFollowUps.length - 2} more
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="text-xs text-slate-400">No follow-ups</div>
                            )}
                          </div>
                        )}
                        
                        {column.id === 'nextAction' && (
                          <div 
                            className={`text-slate-600 ${(() => {
                              const nextAction = getNextAction(lead);
                              return nextAction.action !== 'No follow-ups' ? 'cursor-pointer hover:text-indigo-600 hover:underline' : '';
                            })()}`}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const nextAction = getNextAction(lead);
                              if (nextAction.action !== 'No follow-ups' && safeFollowUps.length > 0) {
                                // 🟢 SAFE FIX: Safe filtering
                                const upcomingFollowUps = safeFollowUps
                                  .filter(fu => fu.status === 'Planned')
                                  .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                                
                                const nextFollowUpId = upcomingFollowUps.length > 0 
                                  ? upcomingFollowUps[0].id 
                                  : [...safeFollowUps].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]?.id;
                                
                                if (nextFollowUpId) {
                                  onSelectLead(lead, nextFollowUpId);
                                } else {
                                  onSelectLead(lead, '');
                                }
                              }
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            title={(() => {
                              const nextAction = getNextAction(lead);
                              return nextAction.action !== 'No follow-ups' ? "Click to view/edit this follow-up" : "No follow-ups";
                            })()}
                          >
                            {(() => {
                              const nextAction = getNextAction(lead);
                              return (
                                <div>
                                  <div className="text-xs font-medium text-slate-800">
                                    {nextAction.action}
                                  </div>
                                  {nextAction.date && (
                                    <div className={`text-xs mt-0.5 ${nextAction.isMissed ? 'text-red-600 font-semibold' : 'text-slate-500'}`}>
                                      {nextAction.date} {nextAction.time}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        )}
                        
                        {column.id === 'actions' && (
                          <div className="flex items-center gap-0.5 sm:gap-1 lead-row-actions" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => onSelectLead(lead)}
                              className="lead-row-action p-1 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-100 rounded min-w-0"
                              title="View Details"
                            >
                              👁️
                            </button>
                            {isAdmin && availableUsers.length > 0 && (
                              <button
                                onClick={() => {
                          const accountManagerOptions = availableUsers
                            .filter(user => user.role === 'Account Manager' || user.role === 'Admin' || user.role === 'SubAdmin')
                            .map(user => `<option value="${user.email}">${user.name} (${user.role})</option>`)
                            .join('');
                          
                          const salesPersonOptions = availableUsers
                            .filter(user => user.role === 'Sales' || user.role === 'Admin' || user.role === 'SubAdmin')
                            .map(user => `<option value="${user.email}">${user.name} (${user.role})</option>`)
                            .join('');
                                  
                                  const dialog = document.createElement('div');
                                  dialog.innerHTML = `
                                    <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; align-items: center; justify-content: center;">
                                      <div style="background: white; padding: 20px; border-radius: 8px; min-width: 400px;">
                                        <h3 style="margin: 0 0 15px 0; font-size: 18px; font-weight: bold;">Assign Lead: ${lead.agencyName}</h3>
                                        <div style="margin-bottom: 15px;">
                                          <label style="display: block; margin-bottom: 5px; font-weight: 500;">Account Manager:</label>
                                          <select id="accountManagerSelect" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
                                            <option value="">Select Account Manager</option>
                                            ${accountManagerOptions}
                                          </select>
                                        </div>
                                        <div style="margin-bottom: 20px;">
                                          <label style="display: block; margin-bottom: 5px; font-weight: 500;">Sales Person:</label>
                                          <select id="salesPersonSelect" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
                                            <option value="">Select Sales Person</option>
                                            ${salesPersonOptions}
                                          </select>
                                        </div>
                                        <div style="display: flex; gap: 10px; justify-content: flex-end;">
                                          <button id="cancelBtn" style="padding: 8px 16px; border: 1px solid #ccc; background: white; border-radius: 4px; cursor: pointer;">Cancel</button>
                                          <button id="assignBtn" style="padding: 8px 16px; background: #4f46e5; color: white; border: none; border-radius: 4px; cursor: pointer;">Assign Lead</button>
                                        </div>
                                      </div>
                                    </div>
                                  `;
                                  
                                  document.body.appendChild(dialog);
                                  
                                  const accountManagerSelect = dialog.querySelector('#accountManagerSelect') as HTMLSelectElement;
                                  const salesPersonSelect = dialog.querySelector('#salesPersonSelect') as HTMLSelectElement;
                                  accountManagerSelect.value = lead.accountManager || '';
                                  salesPersonSelect.value = lead.salesPerson || '';
                                  
                                  dialog.querySelector('#cancelBtn')?.addEventListener('click', () => {
                                    document.body.removeChild(dialog);
                                  });
                                  
                                  dialog.querySelector('#assignBtn')?.addEventListener('click', () => {
                                    const newAccountManager = accountManagerSelect.value;
                                    const newSalesPerson = salesPersonSelect.value;
                                    
                                    if (newAccountManager && newSalesPerson) {
                                      onAssignLead?.(lead.id, newAccountManager, newSalesPerson);
                                      document.body.removeChild(dialog);
                                    } else {
                                      alert('Please select both Account Manager and Sales Person');
                                    }
                                  });
                                }}
                                className="lead-row-action p-1 text-green-600 hover:text-green-800 hover:bg-green-100 rounded min-w-0"
                                title="Assign Lead"
                              >
                                🔄
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile View - Field Team Optimized */}
      <div className="md:hidden mt-4">
        <div className="space-y-4">
          {sortedLeads.map((lead) => {
             // 🟢 SAFE FIX: Pre-calculate safe lists for Mobile
             const safeContacts = Array.isArray(lead.contacts) ? lead.contacts : [];
             const safeFollowUps = Array.isArray(lead.followUps) ? lead.followUps : [];
             const firstContact = safeContacts[0] || {};
             
             return (
            <div
              key={lead.id}
              className="bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-all duration-200"
            >
              {/* Header with Agency Name and Status */}
              <div className="p-4 border-b border-slate-100">
                <div className="flex items-start justify-between mb-2">
                  {isAdmin && (
                    <input
                      type="checkbox"
                      checked={selectedLeads.includes(lead.id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        onToggleLeadSelection(lead.id);
                      }}
                      className="lead-list-checkbox rounded border-slate-300 flex-shrink-0 mt-1 h-3 w-3 sm:h-4 sm:w-4"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-900 text-lg leading-tight mb-2">{lead.agencyName}</h3>
                    <div className="flex flex-wrap gap-2 mb-2">
                      <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(lead.status)}`}>
                        {lead.status}
                      </span>
                      <span className="inline-flex px-3 py-1 text-sm font-semibold rounded-full bg-purple-100 text-purple-800">
                        {lead.leadSource || 'Website'}
                      </span>
                    </div>
                    {lead.accountManager && (
                      <div className="text-sm text-slate-600">
                        <span className="inline-block px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-medium">
                          AM: {getUserDisplayNameLocal(lead.accountManager)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Contact Information - Prominent Display */}
              <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50">
                <div className="text-base font-semibold text-blue-800 mb-3">📞 Contact Information</div>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <span className="text-green-600 text-lg">📞</span>
                    </div>
                    <div className="flex-1">
                      <div className="text-sm text-slate-600">Primary Phone</div>
                      <div className="font-semibold text-slate-900">{formatPhone(firstContact.phone || '')}</div>
                    </div>
                  </div>
                  
                  {firstContact.email && (
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 text-lg">📧</span>
                      </div>
                      <div className="flex-1">
                        <div className="text-sm text-slate-600">Email</div>
                        <div className="font-semibold text-slate-900 text-sm">{formatEmail(firstContact.email || '')}</div>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center">
                      <span className="text-slate-600 text-lg">📍</span>
                    </div>
                    <div className="flex-1">
                      <div className="text-sm text-slate-600">Location</div>
                      <div className="font-semibold text-slate-900">{firstContact.city || 'N/A'}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Action Buttons - Full Width */}
              <div className="p-4">
                <div className="text-base font-semibold text-blue-800 mb-3">⚡ Quick Actions</div>
                <div className="space-y-2">
                  {firstContact.phone && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                                  // Track call action
                                  if (currentUser) {
                                    trackCallAction(
                                      currentUser,
                            getUserDisplayNameLocal(currentUser),
                            firstContact.phone || '',
                            lead.id,
                            lead.agencyName,
                            firstContact.name,
                            lead.agencyName
                          );
                        }
                        window.open(`tel:${firstContact.phone}`, '_self');
                      }}
                      className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-green-600 text-white rounded-xl text-base font-semibold hover:bg-green-700 transition-colors shadow-sm"
                    >
                      <span className="text-xl">📞</span>
                      <span>Call Now</span>
                    </button>
                  )}
                  
                  {firstContact.phone && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // Track WhatsApp action
                        if (currentUser) {
                          trackWhatsAppAction(
                            currentUser,
                            getUserDisplayNameLocal(currentUser),
                            firstContact.phone || '',
                            lead.id,
                            lead.agencyName,
                            firstContact.name,
                            lead.agencyName
                          );
                        }
                        const message = `Hi ${firstContact.name}, I hope you're doing well. I wanted to reach out regarding our business discussion.



Regards

Team 

Iapply.io`;
                        try {
                          const whatsappUrl = createWhatsAppUrl(firstContact.phone || '', message);
                          window.open(whatsappUrl, '_blank');
                        } catch (error) {
                          alert('Invalid phone number.');
                        }
                      }}
                      className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-green-500 text-white rounded-xl text-base font-semibold hover:bg-green-600 transition-colors shadow-sm"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
                      </svg>
                      <span>WhatsApp</span>
                    </button>
                  )}
                  
                  {firstContact.email && (
                    <EmailButtonMobile 
                      email={firstContact.email || ''}
                      recipientName={firstContact.name}
                      agencyName={lead.agencyName}
                      currentUser={currentUser}
                      leadId={lead.id}
                      leadName={lead.agencyName}
                      getUserDisplayNameLocal={getUserDisplayNameLocal}
                    />
                  )}
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectLead(lead);
                    }}
                    className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-indigo-600 text-white rounded-xl text-base font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
                  >
                    <span className="text-xl">👁️</span>
                    <span>View Full Details</span>
                  </button>
                </div>
              </div>

              {/* Follow-up Information */}
              <div className="p-4 bg-slate-50 border-t border-slate-200">
                <div className="text-base font-semibold text-blue-800 mb-3">📋 Follow-up Status</div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Total Follow-ups:</span>
                    <span className="font-semibold text-slate-900">{safeFollowUps.length}</span>
                  </div>
                  
                  {(() => {
                    const nextAction = getNextAction(lead);
                    return (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">Next Action:</span>
                        <div className="text-right">
                          <div className="font-semibold text-slate-900 text-sm">{nextAction.action}</div>
                          {nextAction.date && (
                            <div className={`text-xs ${nextAction.isMissed ? 'text-red-600 font-semibold' : 'text-slate-500'}`}>{nextAction.date} {nextAction.time}</div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Footer with Creation Info */}
              <div className="px-4 py-3 bg-slate-100 border-t border-slate-200 rounded-b-xl">
                <div className="flex items-center justify-between text-sm text-slate-600">
                  <span>Created: {new Date(lead.createdAt).toLocaleDateString()}</span>
                  <span>By: {getUserDisplayNameLocal(lead.createdBy)}</span>
                </div>
              </div>
            </div>
             );
           })}
        </div>
      </div>

      {/* Contact Details Popup */}
      {showContactPopup && selectedLeadContacts && (() => {
        // 🟢 SAFE FIX: Pre-calculate safe lists for Contact Popup
        const safeContacts = Array.isArray(selectedLeadContacts.contacts) ? selectedLeadContacts.contacts : [];
        return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-blue-800">
                  Contact Details - {selectedLeadContacts.agencyName}
                </h3>
                <button
                  onClick={() => setShowContactPopup(false)}
                  className="text-slate-400 hover:text-slate-600 text-xl"
                >
                  ×
                </button>
              </div>
              
              <div className="space-y-4">
                {safeContacts.map((contact, index) => (
                  <div key={index} className="border border-slate-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-medium text-slate-900">
                          {contact.name || 'Unnamed Contact'}
                        </h4>
                        {contact.designation && (
                          <p className="text-sm text-slate-600">{contact.designation}</p>
                        )}
                      </div>
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                        {index === 0 ? 'Primary' : `Contact ${index + 1}`}
                      </span>
                    </div>
                    
                    <div className="space-y-2">
                      {contact.phone && (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-600 text-sm">📞</span>
                            <span className="text-slate-900 text-sm">{contact.phone}</span>
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={() => {
                                  // Track call action
                                  if (currentUser) {
                                    trackCallAction(
                                      currentUser,
                                      getUserDisplayNameLocal(currentUser),
                                      contact.phone || '',
                                      selectedLeadContacts?.id,
                                      selectedLeadContacts?.agencyName,
                                      contact.name,
                                      selectedLeadContacts?.agencyName
                                    );
                                  }
                                  window.open(`tel:${contact.phone}`, '_self');
                              }}
                              className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                            >
                              Call
                            </button>
                            <button
                              onClick={() => {
                                // Track WhatsApp action
                                if (currentUser) {
                                  trackWhatsAppAction(
                                    currentUser,
                                    getUserDisplayNameLocal(currentUser),
                                    contact.phone || '',
                                    selectedLeadContacts?.id,
                                    selectedLeadContacts?.agencyName,
                                    contact.name,
                                    selectedLeadContacts?.agencyName
                                  );
                                }
                                const message = `Hi ${contact.name}, I hope you're doing well. I wanted to reach out regarding our business discussion.



Regards

Team 

Iapply.io`;
                                try {
                                  const whatsappUrl = createWhatsAppUrl(contact.phone || '', message);
                                  window.open(whatsappUrl, '_blank');
                                } catch (error) {
                                  alert('Invalid phone number.');
                                }
                              }}
                              className="px-3 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600"
                            >
                              WhatsApp
                            </button>
                          </div>
                        </div>
                      )}
                      
                      {contact.email && (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-600 text-sm">📧</span>
                            <span className="text-slate-900 text-sm">{contact.email}</span>
                          </div>
                          <EmailButtonContact 
                            email={contact.email || ''}
                            recipientName={contact.name}
                            agencyName={selectedLeadContacts?.agencyName}
                            currentUser={currentUser}
                            leadId={selectedLeadContacts?.id || ''}
                            leadName={selectedLeadContacts?.agencyName || ''}
                            getUserDisplayNameLocal={getUserDisplayNameLocal}
                          />
                        </div>
                      )}
                      
                      {contact.alternateMobile && (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-600 text-sm">📱</span>
                            <span className="text-slate-900 text-sm">{contact.alternateMobile}</span>
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={() => {
                                  // Track call action
                                  if (currentUser) {
                                    trackCallAction(
                                      currentUser,
                                      getUserDisplayNameLocal(currentUser),
                                      contact.alternateMobile || '',
                                      selectedLeadContacts?.id,
                                      selectedLeadContacts?.agencyName,
                                      contact.name,
                                      selectedLeadContacts?.agencyName
                                    );
                                  }
                                  window.open(`tel:${contact.alternateMobile}`, '_self');
                              }}
                              className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                            >
                              Call
                            </button>
                            <button
                              onClick={() => {
                                // Track WhatsApp action
                                if (currentUser) {
                                  trackWhatsAppAction(
                                    currentUser,
                                    getUserDisplayNameLocal(currentUser),
                                    contact.alternateMobile || '',
                                    selectedLeadContacts?.id,
                                    selectedLeadContacts?.agencyName,
                                    contact.name,
                                    selectedLeadContacts?.agencyName
                                  );
                                }
                                const message = `Hi ${contact.name}, I hope you're doing well. I wanted to reach out regarding our business discussion.



Regards

Team 

Iapply.io`;
                                try {
                                  const whatsappUrl = createWhatsAppUrl(contact.alternateMobile || '', message);
                                  window.open(whatsappUrl, '_blank');
                                } catch (error) {
                                  alert('Invalid phone number.');
                                }
                              }}
                              className="px-3 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600"
                            >
                              WhatsApp
                            </button>
                          </div>
                        </div>
                      )}
                      
                      {contact.city && (
                        <div className="flex items-center gap-2">
                          <span className="text-slate-600 text-sm">📍</span>
                          <span className="text-slate-900 text-sm">{contact.city}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowContactPopup(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded hover:bg-slate-200"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
        );
      })()}
      
      {/* ICP Score Modal */}
      {showIcpScoreModal && selectedLeadForIcp && (() => {
        // 🟢 SAFE FIX: Pre-calculate safe lists for ICP Modal
        const safeContacts = Array.isArray(selectedLeadForIcp.contacts) ? selectedLeadForIcp.contacts : [];
        const firstContact = safeContacts[0] || {};

        // Calculate average score
        const scores = Object.values(categoryScores).filter(s => s !== '') as number[];
        const average = scores.length > 0 
          ? Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 10) / 10 
          : null;
        
        const handleCategoryScoreChange = (category: string, value: string) => {
          const numValue = value === '' ? '' : Math.max(0, Math.min(10, parseInt(value) || 0));
          setCategoryScores(prev => ({ ...prev, [category]: numValue }));
        };
        
        return (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]" onClick={() => setShowIcpScoreModal(false)}>
            <div className="bg-white rounded-xl shadow-2xl max-w-[95vw] w-full max-h-[95vh] mx-4 my-4 flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
              {/* Lead Details Banner */}
              <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 text-white p-6 flex-shrink-0">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold mb-2">{selectedLeadForIcp.agencyName}</h2>
                    <div className="flex flex-wrap gap-3 items-center">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">Status:</span>
                        <span className="px-3 py-1 bg-white/20 rounded-full text-sm font-medium">{selectedLeadForIcp.status}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">Category:</span>
                        <span className="px-3 py-1 bg-white/20 rounded-full text-sm font-medium">{selectedLeadForIcp.agentCategory}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">Current ICP Score:</span>
                        <span className="px-3 py-1 bg-white/20 rounded-full text-sm font-bold">
                          {selectedLeadForIcp.icpScore !== undefined && selectedLeadForIcp.icpScore !== null ? `${selectedLeadForIcp.icpScore}/10` : 'Not Set'}
                        </span>
                      </div>
                      {firstContact.name && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">Contact:</span>
                          <span className="text-sm">{firstContact.name}</span>
                          {firstContact.phone && (
                            <span className="text-sm">• {firstContact.phone}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setShowIcpScoreModal(false)}
                    className="text-white hover:text-gray-200 text-3xl font-bold ml-4"
                  >
                    ×
                  </button>
                </div>
              </div>
              
              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="mb-4">
                  <p className="text-sm text-slate-600 mb-4">
                    Use this scoring system to assess agencies/partners. Enter a score (0-10) for each category, and the average will be calculated automatically.
                  </p>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <p className="text-sm font-semibold text-blue-800 mb-2">💡 How to Use:</p>
                    <ol className="text-sm text-blue-700 list-decimal list-inside space-y-1">
                      <li>Review each category and assessment parameter</li>
                      <li>Evaluate the agency based on the scoring logic</li>
                      <li>Enter a score (0-10) for each category in the "Your Score" column</li>
                      <li>The average will be calculated automatically and can be applied to the ICP Score field</li>
                    </ol>
                  </div>
                  {average !== null && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                      <p className="text-sm font-semibold text-green-800">
                        📊 Calculated Average: <span className="text-lg font-bold text-green-900">{average.toFixed(1)}/10</span>
                        {average >= 1 && average <= 10 && (
                          <span className="ml-2 text-xs">(Rounded: {Math.round(average)}/10)</span>
                        )}
                      </p>
                    </div>
                  )}
                </div>
                
                <div className="mb-4 flex justify-end">
                  <button
                    onClick={() => setShowReferenceTable(true)}
                    className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    📖 View Reference Examples
                  </button>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-slate-300 text-sm">
                    <thead>
                      <tr className="bg-indigo-100">
                        <th className="border border-slate-300 px-3 py-2 text-left font-bold text-slate-800">Category</th>
                        <th className="border border-slate-300 px-3 py-2 text-left font-bold text-slate-800">Assessment Parameter</th>
                        <th className="border border-slate-300 px-3 py-2 text-left font-bold text-slate-800">Scoring Logic (0–10)</th>
                        <th className="border border-slate-300 px-3 py-2 text-center font-bold text-slate-800 bg-indigo-200">Your Score (0-10)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Business Profile */}
                      <tr className="bg-white">
                        <td className="border border-slate-300 px-3 py-2 font-semibold text-slate-700">Business Profile</td>
                        <td className="border border-slate-300 px-3 py-2">Business Age</td>
                        <td className="border border-slate-300 px-3 py-2">
                          <ul className="list-disc list-inside space-y-1 text-xs">
                            <li>24+ months = 10</li>
                            <li>12–24 = 7</li>
                            <li>6–12 = 5</li>
                            <li>&lt;6 = 2</li>
                          </ul>
                        </td>
                        <td className="border border-slate-300 px-3 py-2 text-center">
                          <input
                            type="number"
                            min="0"
                            max="10"
                            value={categoryScores['Business Profile']}
                            onChange={(e) => handleCategoryScoreChange('Business Profile', e.target.value)}
                            className="w-16 px-2 py-1 text-sm border border-slate-300 rounded text-center focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200"
                            placeholder="0-10"
                          />
                        </td>
                      </tr>
                      {/* Services Portfolio */}
                      <tr className="bg-slate-50">
                        <td className="border border-slate-300 px-3 py-2 font-semibold text-slate-700">Services Portfolio</td>
                        <td className="border border-slate-300 px-3 py-2">Main Study Destinations</td>
                        <td className="border border-slate-300 px-3 py-2">
                          <ul className="list-disc list-inside space-y-1 text-xs">
                            <li>Canada focus = 3</li>
                            <li>UK = 2</li>
                            <li>Others = 1</li>
                          </ul>
                        </td>
                        <td className="border border-slate-300 px-3 py-2 text-center">
                          <input
                            type="number"
                            min="0"
                            max="10"
                            value={categoryScores['Services Portfolio']}
                            onChange={(e) => handleCategoryScoreChange('Services Portfolio', e.target.value)}
                            className="w-16 px-2 py-1 text-sm border border-slate-300 rounded text-center focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200"
                            placeholder="0-10"
                          />
                        </td>
                      </tr>
                      {/* Online Presence */}
                      <tr className="bg-white">
                        <td className="border border-slate-300 px-3 py-2 font-semibold text-slate-700">Online Presence</td>
                        <td className="border border-slate-300 px-3 py-2">Digital & Social Media Reputation</td>
                        <td className="border border-slate-300 px-3 py-2">
                          <ul className="list-disc list-inside space-y-1 text-xs">
                            <li>Strong (≥4.5 & &gt;100 reviews) = 10</li>
                            <li>Moderate = 7</li>
                            <li>Weak = 3</li>
                          </ul>
                        </td>
                        <td className="border border-slate-300 px-3 py-2 text-center">
                          <input
                            type="number"
                            min="0"
                            max="10"
                            value={categoryScores['Online Presence']}
                            onChange={(e) => handleCategoryScoreChange('Online Presence', e.target.value)}
                            className="w-16 px-2 py-1 text-sm border border-slate-300 rounded text-center focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200"
                            placeholder="0-10"
                          />
                        </td>
                      </tr>
                      {/* Operational Scale */}
                      <tr className="bg-slate-50">
                        <td className="border border-slate-300 px-3 py-2 font-semibold text-slate-700">Operational Scale</td>
                        <td className="border border-slate-300 px-3 py-2">Visa Success Cases (Last 6 months)</td>
                        <td className="border border-slate-300 px-3 py-2">
                          <ul className="list-disc list-inside space-y-1 text-xs">
                            <li>&gt;20 = 10</li>
                            <li>15–20 = 7</li>
                            <li>10–15 = 5</li>
                            <li>&lt;10 = 3</li>
                          </ul>
                        </td>
                        <td className="border border-slate-300 px-3 py-2 text-center">
                          <input
                            type="number"
                            min="0"
                            max="10"
                            value={categoryScores['Operational Scale']}
                            onChange={(e) => handleCategoryScoreChange('Operational Scale', e.target.value)}
                            className="w-16 px-2 py-1 text-sm border border-slate-300 rounded text-center focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200"
                            placeholder="0-10"
                          />
                        </td>
                      </tr>
                      {/* Applicant Volume */}
                      <tr className="bg-white">
                        <td className="border border-slate-300 px-3 py-2 font-semibold text-slate-700">Applicant Volume</td>
                        <td className="border border-slate-300 px-3 py-2">No. of successful submissions</td>
                        <td className="border border-slate-300 px-3 py-2">
                          <ul className="list-disc list-inside space-y-1 text-xs">
                            <li>&gt;50 = 10</li>
                            <li>25–50 = 7</li>
                            <li>&lt;25 = 5</li>
                          </ul>
                        </td>
                        <td className="border border-slate-300 px-3 py-2 text-center">
                          <input
                            type="number"
                            min="0"
                            max="10"
                            value={categoryScores['Applicant Volume']}
                            onChange={(e) => handleCategoryScoreChange('Applicant Volume', e.target.value)}
                            className="w-16 px-2 py-1 text-sm border border-slate-300 rounded text-center focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200"
                            placeholder="0-10"
                          />
                        </td>
                      </tr>
                      {/* Team Strength */}
                      <tr className="bg-slate-50">
                        <td className="border border-slate-300 px-3 py-2 font-semibold text-slate-700">Team Strength</td>
                        <td className="border border-slate-300 px-3 py-2">Staff Count</td>
                        <td className="border border-slate-300 px-3 py-2">
                          <ul className="list-disc list-inside space-y-1 text-xs">
                            <li>Well-staffed = 10</li>
                            <li>Moderate = 7</li>
                            <li>Small = 5</li>
                          </ul>
                        </td>
                        <td className="border border-slate-300 px-3 py-2 text-center">
                          <input
                            type="number"
                            min="0"
                            max="10"
                            value={categoryScores['Team Strength']}
                            onChange={(e) => handleCategoryScoreChange('Team Strength', e.target.value)}
                            className="w-16 px-2 py-1 text-sm border border-slate-300 rounded text-center focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200"
                            placeholder="0-10"
                          />
                        </td>
                      </tr>
                      {/* Network Strength */}
                      <tr className="bg-white">
                        <td className="border border-slate-300 px-3 py-2 font-semibold text-slate-700">Network Strength</td>
                        <td className="border border-slate-300 px-3 py-2">Direct / Indirect Tie-ups</td>
                        <td className="border border-slate-300 px-3 py-2">
                          <ul className="list-disc list-inside space-y-1 text-xs">
                            <li>&gt;10 Canada = 10</li>
                            <li>5–10 = 7</li>
                            <li>&lt;5 = 5</li>
                          </ul>
                        </td>
                        <td className="border border-slate-300 px-3 py-2 text-center">
                          <input
                            type="number"
                            min="0"
                            max="10"
                            value={categoryScores['Network Strength']}
                            onChange={(e) => handleCategoryScoreChange('Network Strength', e.target.value)}
                            className="w-16 px-2 py-1 text-sm border border-slate-300 rounded text-center focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200"
                            placeholder="0-10"
                          />
                        </td>
                      </tr>
                      {/* Applicant Quality */}
                      <tr className="bg-slate-50">
                        <td className="border border-slate-300 px-3 py-2 font-semibold text-slate-700">Applicant Quality</td>
                        <td className="border border-slate-300 px-3 py-2">Genuine vs Fake Ratio</td>
                        <td className="border border-slate-300 px-3 py-2">
                          <ul className="list-disc list-inside space-y-1 text-xs">
                            <li>&lt;5% fake = 10</li>
                            <li>5–10% = 7</li>
                            <li>10–20% = 5</li>
                          </ul>
                        </td>
                        <td className="border border-slate-300 px-3 py-2 text-center">
                          <input
                            type="number"
                            min="0"
                            max="10"
                            value={categoryScores['Applicant Quality']}
                            onChange={(e) => handleCategoryScoreChange('Applicant Quality', e.target.value)}
                            className="w-16 px-2 py-1 text-sm border border-slate-300 rounded text-center focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200"
                            placeholder="0-10"
                          />
                        </td>
                      </tr>
                      {/* Physical Presence */}
                      <tr className="bg-white">
                        <td className="border border-slate-300 px-3 py-2 font-semibold text-slate-700">Physical Presence</td>
                        <td className="border border-slate-300 px-3 py-2">Branches (India / Abroad)</td>
                        <td className="border border-slate-300 px-3 py-2">
                          <ul className="list-disc list-inside space-y-1 text-xs">
                            <li>Multi-city = 10</li>
                            <li>Single-city = 7</li>
                          </ul>
                        </td>
                        <td className="border border-slate-300 px-3 py-2 text-center">
                          <input
                            type="number"
                            min="0"
                            max="10"
                            value={categoryScores['Physical Presence']}
                            onChange={(e) => handleCategoryScoreChange('Physical Presence', e.target.value)}
                            className="w-16 px-2 py-1 text-sm border border-slate-300 rounded text-center focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200"
                            placeholder="0-10"
                          />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              
              {/* Reference Table Modal */}
              {showReferenceTable && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[110]" onClick={() => setShowReferenceTable(false)}>
                  <div className="bg-white rounded-xl shadow-2xl max-w-[90vw] w-full max-h-[85vh] mx-4 my-4 flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
                    <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-4 flex-shrink-0 flex justify-between items-center">
                      <h3 className="text-xl font-bold">📖 Reference Examples</h3>
                      <button
                        onClick={() => setShowReferenceTable(false)}
                        className="text-white hover:text-gray-200 text-2xl font-bold"
                      >
                        ×
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6">
                      <p className="text-sm text-slate-600 mb-4">
                        This table shows example answers and verification sources for reference. Use this as a guide when scoring each category.
                      </p>
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse border border-slate-300 text-sm">
                          <thead>
                            <tr className="bg-blue-100">
                              <th className="border border-slate-300 px-3 py-2 text-left font-bold text-slate-800">Category</th>
                              <th className="border border-slate-300 px-3 py-2 text-left font-bold text-slate-800">Assessment Parameter</th>
                              <th className="border border-slate-300 px-3 py-2 text-left font-bold text-slate-800">Expected / Example Answer</th>
                              <th className="border border-slate-300 px-3 py-2 text-left font-bold text-slate-800">Verification Source</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="bg-white">
                              <td className="border border-slate-300 px-3 py-2 font-semibold text-slate-700">Business Profile</td>
                              <td className="border border-slate-300 px-3 py-2">Business Age</td>
                              <td className="border border-slate-300 px-3 py-2">6 months, 2 years, 5+ years</td>
                              <td className="border border-slate-300 px-3 py-2">Zauba, Google reviews</td>
                            </tr>
                            <tr className="bg-slate-50">
                              <td className="border border-slate-300 px-3 py-2 font-semibold text-slate-700">Services Portfolio</td>
                              <td className="border border-slate-300 px-3 py-2">Main Study Destinations</td>
                              <td className="border border-slate-300 px-3 py-2">Canada, US, UK, Australia</td>
                              <td className="border border-slate-300 px-3 py-2">Website, Social media</td>
                            </tr>
                            <tr className="bg-white">
                              <td className="border border-slate-300 px-3 py-2 font-semibold text-slate-700">Online Presence</td>
                              <td className="border border-slate-300 px-3 py-2">Digital & Social Media Reputation</td>
                              <td className="border border-slate-300 px-3 py-2">Google rating 4.5+, 200+ reviews</td>
                              <td className="border border-slate-300 px-3 py-2">Google, FB, Instagram</td>
                            </tr>
                            <tr className="bg-slate-50">
                              <td className="border border-slate-300 px-3 py-2 font-semibold text-slate-700">Operational Scale</td>
                              <td className="border border-slate-300 px-3 py-2">Visa Success Cases (Last 6 months)</td>
                              <td className="border border-slate-300 px-3 py-2">10–30</td>
                              <td className="border border-slate-300 px-3 py-2">Internal data / Ref call</td>
                            </tr>
                            <tr className="bg-white">
                              <td className="border border-slate-300 px-3 py-2 font-semibold text-slate-700">Applicant Volume</td>
                              <td className="border border-slate-300 px-3 py-2">No. of successful submissions</td>
                              <td className="border border-slate-300 px-3 py-2">25–100+</td>
                              <td className="border border-slate-300 px-3 py-2">CRM / Reference</td>
                            </tr>
                            <tr className="bg-slate-50">
                              <td className="border border-slate-300 px-3 py-2 font-semibold text-slate-700">Team Strength</td>
                              <td className="border border-slate-300 px-3 py-2">Staff Count</td>
                              <td className="border border-slate-300 px-3 py-2">Counselors: 5–10<br/>Visa: 2–3<br/>Ops: 2–5</td>
                              <td className="border border-slate-300 px-3 py-2">LinkedIn / Office call</td>
                            </tr>
                            <tr className="bg-white">
                              <td className="border border-slate-300 px-3 py-2 font-semibold text-slate-700">Network Strength</td>
                              <td className="border border-slate-300 px-3 py-2">Direct / Indirect Tie-ups</td>
                              <td className="border border-slate-300 px-3 py-2">Canada: 10–20, USA: 5</td>
                              <td className="border border-slate-300 px-3 py-2">Partner list / Call</td>
                            </tr>
                            <tr className="bg-slate-50">
                              <td className="border border-slate-300 px-3 py-2 font-semibold text-slate-700">Applicant Quality</td>
                              <td className="border border-slate-300 px-3 py-2">Genuine vs Fake Ratio</td>
                              <td className="border border-slate-300 px-3 py-2">&lt;5% fake cases</td>
                              <td className="border border-slate-300 px-3 py-2">Record audit / Referral</td>
                            </tr>
                            <tr className="bg-white">
                              <td className="border border-slate-300 px-3 py-2 font-semibold text-slate-700">Physical Presence</td>
                              <td className="border border-slate-300 px-3 py-2">Branches (India / Abroad)</td>
                              <td className="border border-slate-300 px-3 py-2">e.g., Delhi, Punjab, Dubai</td>
                              <td className="border border-slate-300 px-3 py-2">Website / Call</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                    <div className="flex-shrink-0 border-t border-slate-200 bg-slate-50 p-4 flex justify-end">
                      <button
                        onClick={() => setShowReferenceTable(false)}
                        className="px-6 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Footer with Buttons */}
              <div className="flex-shrink-0 border-t border-slate-200 bg-slate-50 p-4 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setCategoryScores({
                      'Business Profile': '',
                      'Services Portfolio': '',
                      'Online Presence': '',
                      'Operational Scale': '',
                      'Applicant Volume': '',
                      'Team Strength': '',
                      'Network Strength': '',
                      'Applicant Quality': '',
                      'Physical Presence': ''
                    });
                    setShowIcpScoreModal(false);
                  }}
                  className="px-6 py-2 text-sm font-semibold bg-slate-400 text-white rounded-lg hover:bg-slate-500 transition-colors"
                >
                  Close
                </button>
                {average !== null && average >= 1 && average <= 10 && (
                  <button
                    onClick={async () => {
                      if (selectedLeadForIcp && onUpdateLead) {
                        try {
                          await onUpdateLead(selectedLeadForIcp.id, { icpScore: Math.round(average) });
                          alert(`✅ ICP Score updated to ${Math.round(average)}/10`);
                          setShowIcpScoreModal(false);
                          setCategoryScores({
                            'Business Profile': '',
                            'Services Portfolio': '',
                            'Online Presence': '',
                            'Operational Scale': '',
                            'Applicant Volume': '',
                            'Team Strength': '',
                            'Network Strength': '',
                            'Applicant Quality': '',
                            'Physical Presence': ''
                          });
                        } catch (error) {
                          alert(`❌ Failed to update ICP Score: ${error}`);
                        }
                      } else {
                        alert(`ICP Score would be updated to ${Math.round(average)}/10. Please update the lead manually.`);
                        setShowIcpScoreModal(false);
                      }
                    }}
                    className="px-6 py-2 text-sm font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    ✅ Apply Score ({Math.round(average)}/10)
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};