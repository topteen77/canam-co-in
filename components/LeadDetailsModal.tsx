import React, { useState, useEffect, useRef } from 'react';
import type { Lead, FollowUp, FollowUpType, FollowUpStatus, LeadStatus, Contact, MeetingCheckInRecord } from '../types';
import { LEAD_STATUSES, FOLLOW_UP_TYPES, COUNTRY_OPTIONS } from '../types';
import { CountryFlag } from './CountryFlag';
import { Modal } from './Modal';
import { ContactEditModal } from './ContactEditModal';
import { SimpleDocUpload } from './SimpleDocUpload';
import { SimpleDocViewer } from './SimpleDocViewer';
import { getDocumentsByType } from '../services/documentService';
import MeetingRemarksIntegration from './MeetingRemarksIntegration';
import { MultiSelect } from './MultiSelect';
import { CustomDateTimePicker } from './CustomDateTimePicker';
import { SimplePagination } from './SimplePagination';

interface LeadDetailsModalProps {
  lead: Lead | null;
  isOpen: boolean;
  onClose: () => void;
  currentUser: string;
  isAdmin: boolean;
  userRole?: string;
  onUpdateLead?: (leadId: string, updates: Partial<Lead>) => void;
  onAddFollowUp?: (leadId: string, followUp: Omit<FollowUp, 'id'>) => void;
  onUpdateFollowUp?: (leadId: string, followUpId: string, updates: Partial<FollowUp>) => void;
  availableUsers?: Array<{ id: string, name: string, email: string, role: string }>;
  meetingCheckIns?: MeetingCheckInRecord[];
  initialActiveTab?: 'details' | 'followups' | 'history';
  highlightFollowUpId?: string;
  availableTags?: string[];
  onCreateTag?: (tagName: string) => Promise<string>;
}

const FOLLOW_UP_STATUSES: FollowUpStatus[] = ['Planned'];

// Country Interest Selector Component
const CountryInterestSelector: React.FC<{ value: string[], onChange: (countries: string[]) => void }> = ({ value, onChange }) => {
  // 🟢 SAFE FIX: Ensure value is always an array
  const safeValue = Array.isArray(value) ? value : ['Canada'];
  const [selectedCountries, setSelectedCountries] = useState<string[]>(safeValue);

  useEffect(() => {
    setSelectedCountries(Array.isArray(value) ? value : ['Canada']);
  }, [value]);

  const handleCountryToggle = (country: string) => {
    const newSelection = selectedCountries.includes(country)
      ? selectedCountries.filter(c => c !== country)
      : [...selectedCountries, country];
    setSelectedCountries(newSelection);
    onChange(newSelection);
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newSelection = [...selectedCountries];
    [newSelection[index - 1], newSelection[index]] = [newSelection[index], newSelection[index - 1]];
    setSelectedCountries(newSelection);
    onChange(newSelection);
  };

  const handleMoveDown = (index: number) => {
    if (index === selectedCountries.length - 1) return;
    const newSelection = [...selectedCountries];
    [newSelection[index], newSelection[index + 1]] = [newSelection[index + 1], newSelection[index]];
    setSelectedCountries(newSelection);
    onChange(newSelection);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 mb-2">
        {COUNTRY_OPTIONS.map(country => (
          <button
            key={country}
            type="button"
            onClick={() => handleCountryToggle(country)}
            className={`flex items-center gap-2 px-3 py-1 text-sm rounded-lg border-2 transition-all ${selectedCountries.includes(country)
                ? 'bg-indigo-100 border-indigo-500 text-indigo-800 font-semibold'
                : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
              }`}
          >
            <CountryFlag country={country} /> <span>{country}</span>
          </button>
        ))}
      </div>
      {selectedCountries.length > 0 && (
        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
          <p className="text-xs font-semibold text-slate-700 mb-2">Priority Order (Highest to Lowest):</p>
          <div className="space-y-1">
            {selectedCountries.map((country, index) => (
              <div key={country} className="flex items-center gap-2 bg-white p-2 rounded border border-slate-200">
                <span className="text-sm font-semibold text-slate-600 w-6">{index + 1}.</span>
                <CountryFlag country={country} size="md" />
                <span className="flex-1 text-sm text-slate-800">{country}</span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => handleMoveUp(index)}
                    disabled={index === 0}
                    className="px-2 py-1 text-xs bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Move up (higher priority)"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveDown(index)}
                    disabled={index === selectedCountries.length - 1}
                    className="px-2 py-1 text-xs bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Move down (lower priority)"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const newSelection = selectedCountries.filter(c => c !== country);
                      setSelectedCountries(newSelection);
                      onChange(newSelection);
                    }}
                    className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                    title="Remove"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export const LeadDetailsModal: React.FC<LeadDetailsModalProps> = ({
  lead,
  isOpen,
  onClose,
  currentUser,
  isAdmin,
  userRole,
  onUpdateLead,
  onAddFollowUp,
  onUpdateFollowUp,
  availableUsers = [],
  meetingCheckIns = [],
  initialActiveTab = 'details',
  highlightFollowUpId,
  availableTags = [],
  onCreateTag
}) => {
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
  const [activeTab, setActiveTab] = useState<'details' | 'followups' | 'history'>(initialActiveTab || 'details');
  const [isEditing, setIsEditing] = useState(true);
  const [editData, setEditData] = useState<Partial<Lead>>({});
  const [editingFollowUpId, setEditingFollowUpId] = useState<string | null>(null);
  const [editFollowUpData, setEditFollowUpData] = useState<Partial<FollowUp>>({});
  
  // Follow-up Pagination
  const [followUpPage, setFollowUpPage] = useState(1);
  const [followUpsPerPage, setFollowUpsPerPage] = useState(5);
  
  const highlightedFollowUpRef = useRef<HTMLDivElement>(null);
  const [showIcpScoreModal, setShowIcpScoreModal] = useState(false);
  const [showReferenceTable, setShowReferenceTable] = useState(false);
  const [categoryScores, setCategoryScores] = useState<{ [key: string]: number | '' }>({
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
  const [newFollowUp, setNewFollowUp] = useState({
    type: 'Call' as FollowUpType,
    status: 'Planned' as FollowUpStatus,
    scheduledDate: (() => {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    })(),
    notes: '',
    assignedTo: currentUser
  });
  const [newTagName, setNewTagName] = useState('');
  const [tagError, setTagError] = useState('');
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [isAddingFollowUp, setIsAddingFollowUp] = useState(false);

  // Auto-scroll to highlighted follow-up when modal opens or highlight changes
  useEffect(() => {
    if (highlightFollowUpId && activeTab === 'followups' && highlightedFollowUpRef.current) {
      setTimeout(() => {
        highlightedFollowUpRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }, 300);
    }
  }, [highlightFollowUpId, activeTab]);

  // Set active tab to followups when highlightFollowUpId is provided
  useEffect(() => {
    if (highlightFollowUpId && initialActiveTab !== 'followups') {
      setActiveTab('followups');
    }
  }, [highlightFollowUpId, initialActiveTab]);

  // Contact editing state
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [contactModalMode, setContactModalMode] = useState<'add' | 'edit'>('add');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

  // Document viewing state
  const [isDocumentViewerOpen, setIsDocumentViewerOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<any>(null);
  const [selectedDocumentLabel, setSelectedDocumentLabel] = useState<string>('');

  // Document state
  const [documents, setDocuments] = useState<{ [key: string]: any }>({});
  const [loadingDocuments, setLoadingDocuments] = useState(false);

  // Update active tab when initialActiveTab prop changes
  useEffect(() => {
    setActiveTab(initialActiveTab || 'details');
  }, [initialActiveTab]);

  useEffect(() => {
    if (lead) {
      // 🟢 SAFE FIX: Ensure arrays exist before setting state
      const safeCountryInterest = Array.isArray(lead.countryInterest) ? lead.countryInterest : ['Canada'];

      setEditData({
        agencyName: lead.agencyName,
        status: lead.status,
        agentCategory: lead.agentCategory,
        accountManager: lead.accountManager,
        salesPerson: lead.salesPerson,
        tags: lead.tags || [],
        // New fields
        onboardingDate: lead.onboardingDate,
        applicants: lead.applicants,
        remarks: lead.remarks,
        websiteLink: lead.websiteLink,
        agencyDocuments: lead.agencyDocuments,
        countryInterest: safeCountryInterest,
        icpScore: lead.icpScore
      });

      // Reset contact modal state when lead changes
      setIsContactModalOpen(false);
      setSelectedContact(null);

      // Load documents for this lead
      loadDocuments();
    }
  }, [lead]);

  // Load documents for the current lead
  const loadDocuments = async () => {
    if (!lead) return;

    setLoadingDocuments(true);
    try {
      const documentTypes = ['companyRegistration', 'panCard', 'gstNumber', 'mou'];
      const docs: { [key: string]: any } = {};

      // First, check if documents are in the Lead's agencyDocuments field
      if (lead.agencyDocuments) {
        documentTypes.forEach(docType => {
          const doc = (lead.agencyDocuments as any)?.[docType];
          if (doc) {
            // Convert AgencyDocument format to Document format
            docs[docType] = {
              ...doc,
              fileData: doc.url, // Use url as fileData
              uploadedAt: doc.uploadedAt || new Date().toISOString()
            };
          }
        });
      }

      // Then load from Documents collection (this will override if exists)
      const lid = effectiveLeadId();
      for (const docType of documentTypes) {
        const doc = lid ? await getDocumentsByType(lid, docType) : null;
        if (doc) {
          docs[docType] = doc;
        }
      }

      setDocuments(docs);
    } catch (error) {
      console.error('❌ Error loading documents:', error);
    } finally {
      setLoadingDocuments(false);
    }
  };

  // Reset page when lead changes
  useEffect(() => {
    setFollowUpPage(1);
    setIsEditing(true); // 🟢 Always open in edit mode when a lead is selected
  }, [lead]);

  // Reset contact modal when editing mode changes
  useEffect(() => {
    if (!isEditing) {
      setIsContactModalOpen(false);
      setSelectedContact(null);
    }
  }, [isEditing]);

  if (!lead) return null;

  // 🟢 SAFE FIX: Robust Array checks for lead data
  const leadTags = Array.isArray(lead.tags) ? lead.tags : [];
  const leadFollowUps = Array.isArray(lead.followUps) ? lead.followUps : [];
  // Ensure country interest is always an array
  const displayCountryInterest = Array.isArray(lead.countryInterest) ? lead.countryInterest : ['Canada'];

  // Enhanced permission logic
  const isAccountManager = userRole === 'Account Manager' ||
    userRole === 'account manager' ||
    userRole === 'Account manager' ||
    (userRole && userRole.toLowerCase().includes('account') && userRole.toLowerCase().includes('manager'));
  const isSales = userRole === 'Sales' || userRole === 'sales';
  const isOperations = userRole === 'Operations' || userRole === 'operations';

  // SIMPLIFIED PERMISSION LOGIC: Role-based permissions take precedence
  const userInAvailableUsers = availableUsers.find(u => u.email && u.email.toLowerCase() === currentUser.toLowerCase());
  const isAccountManagerFromUsers = userInAvailableUsers && userInAvailableUsers.role === 'Account Manager';

  // Allow ALL authenticated users to edit leads
  const canEdit = !!currentUser ||
    isAdmin ||
    isAccountManager ||
    isSales ||
    isOperations ||
    isAccountManagerFromUsers ||
    true; // Fallback: allow all users to edit

  // Stable id for API calls: prefer id, fallback firebase_id; never use literal "null" or empty
  const effectiveLeadId = (): string => {
    if (!lead) return '';
    const a = lead.id != null ? String(lead.id).trim() : '';
    const b = (lead as any).firebase_id != null ? String((lead as any).firebase_id).trim() : '';
    if (a && a !== 'null') return a;
    if (b) return b;
    return '';
  };

  const handleSaveEditedFollowUp = async () => {
    if (!editingFollowUpId || !onUpdateFollowUp) return;
    
    try {
      await onUpdateFollowUp(lead.id, editingFollowUpId, editFollowUpData);
      setEditingFollowUpId(null);
      setEditFollowUpData({});
    } catch (error) {
      console.error('Error updating follow-up:', error);
      alert('Failed to update follow-up');
    }
  };

  const handleStatusChange = (status: 'Planned' | 'Done') => {
    setEditFollowUpData(prev => ({ ...prev, status }));
  };

  const handleTypeChange = (type: FollowUp['type']) => {
    setEditFollowUpData(prev => ({ ...prev, type }));
  };

  const handleSave = async () => {
    const id = effectiveLeadId();
    if (!id) {
      alert('Lead id is missing or invalid. Cannot update.');
      return;
    }
    try {
      if (onUpdateLead) {
        await onUpdateLead(id, editData);
        setIsEditing(false);
      } else {
        console.error('❌ onUpdateLead function not provided');
        alert('Error: Update function not available');
      }
    } catch (error: any) {
      console.error('❌ Error saving lead:', error);
      const msg = (error instanceof Error ? error.message : error?.response?.data?.error) || 'Unknown error';
      alert(`Failed to update lead: ${msg}`);
    }
  };

  const handleAddFollowUp = async () => {
    // Validate required fields
    if (!newFollowUp.scheduledDate) {
      alert('Please select a scheduled date');
      return;
    }

    if (!newFollowUp.notes.trim()) {
      alert('Please enter follow-up notes');
      return;
    }

    const id = effectiveLeadId();
    if (!id) {
      alert('Lead id is missing. Cannot add follow-up.');
      return;
    }

    setIsAddingFollowUp(true);

    if (onAddFollowUp) {
      try {
        await onAddFollowUp(id, {
          type: newFollowUp.type,
          status: newFollowUp.status,
          date: newFollowUp.scheduledDate, // Map scheduledDate to date
          notes: newFollowUp.notes.trim(),
          assignedTo: newFollowUp.assignedTo,
          createdAt: new Date().toISOString(),
          createdBy: currentUser,
          updatedAt: new Date().toISOString(),
          updatedBy: currentUser
        });

        // Reset form after successful submission
        setNewFollowUp({
          type: 'Call',
          status: 'Planned',
          scheduledDate: '',
          notes: '',
          assignedTo: currentUser
        });

        alert('Follow-up added successfully!');
      } catch (error) {
        console.error('Error adding follow-up:', error);
        alert('Failed to add follow-up. Please try again.');
      } finally {
        setIsAddingFollowUp(false);
      }
    } else {
      setIsAddingFollowUp(false);
    }
  };

  const handleAddContact = () => {
    // Only allow adding contacts when in edit mode
    if (!isEditing) {
      return;
    }
    setContactModalMode('add');
    setSelectedContact(null);
    setIsContactModalOpen(true);
  };

  const handleEditContact = (contact: Contact) => {
    // Only allow editing contacts when in edit mode
    if (!isEditing) {
      return;
    }
    setContactModalMode('edit');
    setSelectedContact(contact);
    setIsContactModalOpen(true);
  };

  const handleSaveContact = async (contact: Contact) => {
    if (!lead) return;
    const id = effectiveLeadId();
    if (!id) {
      alert('Lead id is missing. Cannot update contacts.');
      return;
    }

    // 🟢 SAFE FIX: Ensure lead.contacts is an array
    const safeContacts = Array.isArray(lead.contacts) ? lead.contacts : [];

    const updatedContacts = contactModalMode === 'add'
      ? [...safeContacts, contact]
      : safeContacts.map(c => c.id === contact.id ? contact : c);

    if (!onUpdateLead) return;
    try {
      await onUpdateLead(id, { contacts: updatedContacts });
      setIsContactModalOpen(false);
    } catch (err: any) {
      console.error('Failed to update contacts:', err);
      const msg = err?.message || err?.response?.data?.error || 'Failed to update contact info.';
      alert(msg);
    }
  };

  const handleTagsChange = (tags: string[]) => {
    setEditData(prev => ({
      ...prev,
      tags
    }));
  };

  const handleAddNewTag = async () => {
    if (!onCreateTag) return;
    const trimmed = newTagName.trim();
    if (!trimmed) {
      setTagError('Enter a tag name');
      return;
    }

    setIsCreatingTag(true);
    setTagError('');
    try {
      const created = await onCreateTag(trimmed);
      setEditData(prev => ({
        ...prev,
        tags: Array.from(new Set([...(prev.tags || []), created]))
      }));
      setNewTagName('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add tag';
      setTagError(message);
    } finally {
      setIsCreatingTag(false);
    }
  };

  // Document handlers
  const handleDocumentUpload = (documentType: 'companyRegistration' | 'panCard' | 'gstNumber' | 'mou', document: any) => {
    // Update local documents state
    setDocuments(prev => ({
      ...prev,
      [documentType]: document
    }));

    // Reload documents to ensure consistency
    loadDocuments();
  };

  const handleViewDocument = (document: any, label: string) => {
    setSelectedDocument(document);
    setSelectedDocumentLabel(label);
    setIsDocumentViewerOpen(true);
  };

  const formatDate = (dateString: string) => {
    try {
      if (!dateString) return 'Not set';
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid Date';
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'Invalid Date';
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'New': 'bg-blue-100 text-blue-800',
      'In Pipeline': 'bg-amber-100 text-amber-800',
      'ICP Qualified': 'bg-purple-100 text-purple-800',
      'Portal Deactivated': 'bg-orange-100 text-orange-800',
      'Onboarded': 'bg-green-100 text-green-800',
      'Lost': 'bg-red-100 text-red-800',
      'MOU Signature Pending': 'bg-yellow-100 text-yellow-800',
      'Agent Portal Created': 'bg-indigo-100 text-indigo-800',
      'Agent Portal Reactivated': 'bg-teal-100 text-teal-800',
      'Not qualified': 'bg-slate-100 text-slate-800',
      'Inquiry by mistake': 'bg-gray-100 text-gray-800',
      'Training schedule': 'bg-cyan-100 text-cyan-800',
      'Lost post onboarding': 'bg-rose-100 text-rose-800',
      'Mismatched expectations': 'bg-fuchsia-100 text-fuchsia-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getFollowUpStatusColor = (status: FollowUpStatus) => {
    const colors: Record<string, string> = {
      'Planned': 'bg-blue-100 text-blue-800',
      'Done': 'bg-green-100 text-green-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Lead Details: ${lead.agencyName}`} maxWidth="max-w-6xl">
      <div className="w-full max-w-6xl mx-auto bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-lg">
        {/* Tab Navigation */}
        <div className="flex border-b-2 border-slate-300 mb-4 bg-white rounded-lg p-1 shadow-sm">
          {[
            { id: 'details', label: '📋 Lead Details', icon: '📋' },
            { id: 'followups', label: '📞 Follow-ups', icon: '📞' },
            { id: 'history', label: '📊 History', icon: '📊' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 text-sm font-bold border-b-2 transition-all rounded-lg ${activeTab === tab.id
                  ? 'border-indigo-500 text-indigo-600 bg-indigo-50'
                  : 'border-transparent text-slate-600 hover:text-slate-800 hover:bg-slate-50'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Lead Details Tab */}
        {activeTab === 'details' && (
          <div className="space-y-4">
            {/* Header with Status and Actions - FIXED AT TOP */}
            <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm p-4 rounded-lg shadow-md border-2 border-indigo-200 mb-4 -mx-1 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-800 mb-1 flex items-center gap-2">
                      🏢 {lead.agencyName}
                    </h2>
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${getStatusColor(lead.status)}`}>
                        📊 {lead.status}
                      </span>
                      <span className={`px-2 py-0.5 rounded-md text-xs font-bold bg-purple-100 text-purple-800`}>
                        ⭐ {lead.agentCategory}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {isEditing && (
                    <button
                      onClick={handleSave}
                      className="px-6 py-2 text-sm font-bold text-white bg-gradient-to-r from-green-600 to-emerald-600 rounded-lg hover:from-green-700 hover:to-emerald-700 border-2 border-green-600 shadow-lg transition-all transform hover:scale-105 flex items-center gap-2"
                    >
                      ✅ Save Changes
                    </button>
                  )}
                  {canEdit && (
                    <button
                      onClick={() => setIsEditing(!isEditing)}
                      className={`px-4 py-2 text-sm font-bold text-white rounded-lg border-2 shadow-lg transition-all transform hover:scale-105 ${
                        isEditing 
                          ? 'bg-gradient-to-r from-slate-600 to-slate-700 border-slate-600 hover:from-slate-700 hover:to-slate-800' 
                          : 'bg-gradient-to-r from-indigo-600 to-blue-600 border-indigo-600 hover:from-indigo-700 hover:to-blue-700'
                      }`}
                    >
                      {isEditing ? '❌ Cancel Edit' : '✏️ Edit Lead'}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Lead Information */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Basic Information */}
              <div className="bg-white p-4 rounded-lg shadow-sm border border-blue-200">
                <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
                  📋 Basic Information
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-bold text-slate-800 mb-1">🏢 Agency Name</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editData.agencyName || ''}
                        onChange={(e) => setEditData(prev => ({ ...prev, agencyName: e.target.value }))}
                        className="block w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 bg-white text-slate-800"
                      />
                    ) : (
                      <p className="text-sm text-slate-900 bg-slate-50 p-2 rounded-lg border">{lead.agencyName}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-800 mb-1">📊 Status</label>
                    {isEditing ? (
                      <select
                        value={editData.status || lead.status}
                        onChange={(e) => setEditData(prev => ({ ...prev, status: e.target.value as LeadStatus }))}
                        className="block w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 bg-white text-slate-800"
                      >
                        {LEAD_STATUSES.map(status => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    ) : (
                      <p className="text-sm text-slate-900 bg-slate-50 p-2 rounded-lg border">{lead.status}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-800 mb-1">⭐ Agent Category</label>
                    {isEditing ? (
                      <select
                        value={editData.agentCategory || lead.agentCategory}
                        onChange={(e) => setEditData(prev => ({ ...prev, agentCategory: e.target.value as any }))}
                        className="block w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 bg-white text-slate-800"
                      >
                        <option value="Beginner">Beginner</option>
                        <option value="Bronze">Bronze</option>
                        <option value="Silver">Silver</option>
                        <option value="Gold">Gold</option>
                        <option value="Diamond">Diamond</option>
                        <option value="Platinum">Platinum</option>
                      </select>
                    ) : (
                      <p className="text-sm text-slate-900 bg-slate-50 p-2 rounded-lg border">{lead.agentCategory}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-800 mb-1">🌍 Country Interest (Highest to Lowest)</label>
                    {isEditing ? (
                      <CountryInterestSelector
                        value={editData.countryInterest || displayCountryInterest}
                        onChange={(countries) => setEditData(prev => ({ ...prev, countryInterest: countries }))}
                      />
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        {displayCountryInterest.map((country, idx) => {
                          return (
                            <span key={idx} className="flex items-center gap-1 px-2 py-1 bg-indigo-50 border border-indigo-100 rounded text-sm" title={country}>
                              <CountryFlag country={country} />
                              <span className="text-xs font-medium text-indigo-700">{country}</span>
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Assignment Information */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-blue-200">
              <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
                👥 Assignment
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-bold text-slate-800 mb-1">👤 Account Manager</label>
                  {isEditing ? (
                    <select
                      value={editData.accountManager || lead.accountManager}
                      onChange={(e) => setEditData(prev => ({ ...prev, accountManager: e.target.value }))}
                      className="block w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 bg-white text-slate-800"
                    >
                      <option value="">Select Account Manager</option>
                      <option value={currentUser}>
                        Me ({getUserDisplayName(currentUser)}) - Current User
                      </option>
                      {availableUsers.filter(user => user.role === 'Account Manager' || user.role === 'Admin' || user.role === 'SubAdmin').map((user, idx) => (
                        <option key={user.id ?? user.email ?? `am-${idx}`} value={user.email}>{user.name} - {user.role}</option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-sm text-slate-900 bg-slate-50 p-2 rounded-lg border">{lead.accountManager ? getUserDisplayName(lead.accountManager) : 'Not assigned'}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-800 mb-1">💼 Sales Person</label>
                  {isEditing ? (
                    <select
                      value={editData.salesPerson || lead.salesPerson}
                      onChange={(e) => setEditData(prev => ({ ...prev, salesPerson: e.target.value }))}
                      className="block w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 bg-white text-slate-800"
                    >
                      <option value="">Select Sales Person</option>
                      <option value={currentUser}>
                        Me ({getUserDisplayName(currentUser)}) - Current User
                      </option>
                      {availableUsers.filter(user => user.role === 'Sales' || user.role === 'Admin' || user.role === 'SubAdmin').map((user, idx) => (
                        <option key={user.id ?? user.email ?? `sp-${idx}`} value={user.email}>{user.name} - {user.role}</option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-sm text-slate-900 bg-slate-50 p-2 rounded-lg border">{lead.salesPerson ? getUserDisplayName(lead.salesPerson) : 'Not assigned'}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-800 mb-1">✍️ Created By</label>
                  <p className="text-sm text-slate-900 bg-slate-50 p-2 rounded-lg border">{getUserDisplayName(lead.createdBy)}</p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-800 mb-1">📅 Created At</label>
                  <p className="text-sm text-slate-900 bg-slate-50 p-2 rounded-lg border">{formatDate(lead.createdAt)}</p>
                </div>
              </div>
            </div>

            {/* Additional Information */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-blue-200">
              <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
                📈 Additional Information
              </h3>
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-bold text-slate-800 mb-1">📅 Date of Onboarding</label>
                    {isEditing ? (
                      <input
                        type="date"
                        value={editData.onboardingDate || lead.onboardingDate || ''}
                        onChange={(e) => setEditData(prev => ({ ...prev, onboardingDate: e.target.value }))}
                        className="block w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 bg-white text-slate-800"
                      />
                    ) : (
                      <p className="text-sm text-slate-900 bg-slate-50 p-2 rounded-lg border">
                        {formatDate(lead.onboardingDate)}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-800 mb-1">👥 Potential Students Count (One Month)</label>
                    {isEditing ? (
                      <input
                        type="number"
                        value={editData.applicants || lead.applicants || ''}
                        onChange={(e) => setEditData(prev => ({ ...prev, applicants: e.target.value }))}
                        className="block w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 bg-white text-slate-800 placeholder-slate-400"
                        placeholder="25"
                        min="0"
                      />
                    ) : (
                      <p className="text-sm text-slate-900 bg-slate-50 p-2 rounded-lg border">{lead.applicants || 'Not set'}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-800 mb-1 flex items-center gap-2">
                      <span>🎯</span> ICP Score (1-10)
                    </label>
                    <div className="flex items-center gap-3">
                      <div className="relative w-32">
                        <input
                          type="text"
                          value={isEditing 
                            ? (editData.icpScore !== undefined ? editData.icpScore : (lead.icpScore !== undefined ? lead.icpScore : ''))
                            : (lead.icpScore !== undefined ? lead.icpScore : '')
                          }
                          readOnly
                          placeholder="1-10"
                          className="block w-full px-4 py-2 text-sm border-2 border-slate-200 rounded-lg bg-white font-semibold text-slate-700 focus:outline-none"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowIcpScoreModal(true)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 transition-all active:scale-95"
                      >
                        <span>📊</span>
                        <span>View Scoring</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-800 mb-1">🌐 Website / Social Media Page Link</label>
                  {isEditing ? (
                    <input
                      type="url"
                      value={editData.websiteLink || lead.websiteLink || ''}
                      onChange={(e) => setEditData(prev => ({ ...prev, websiteLink: e.target.value }))}
                      className="block w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 bg-white text-slate-800 placeholder-slate-400"
                      placeholder="https://www.example.com or social media profile URL"
                    />
                  ) : (
                    <div className="text-sm text-slate-900 bg-slate-50 p-2 rounded-lg border">
                      {lead.websiteLink && lead.websiteLink.trim() ? (
                        <a
                          href={lead.websiteLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:text-indigo-800 hover:underline"
                        >
                          {lead.websiteLink}
                        </a>
                      ) : (
                        <span className="text-slate-500 italic">No website/social media link provided</span>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-800 mb-1">📝 Remarks</label>
                  {isEditing ? (
                    <textarea
                      value={editData.remarks || lead.remarks || ''}
                      onChange={(e) => setEditData(prev => ({ ...prev, remarks: e.target.value }))}
                      rows={3}
                      className="block w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 bg-white text-slate-800 placeholder-slate-400"
                      placeholder="Additional notes, comments, or special requirements..."
                    />
                  ) : (
                    <div className="text-sm text-slate-900 bg-slate-50 p-2 rounded-lg border min-h-[60px]">
                      {lead.remarks && lead.remarks.trim() ? (
                        <div className="whitespace-pre-wrap">{lead.remarks}</div>
                      ) : (
                        <span className="text-slate-500 italic">No remarks available</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Agency Documents & MOU */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-blue-200">
              <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
                📄 Agency Documents & MOU
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Company Registration */}
                <div>
                  {isEditing ? (
                    <SimpleDocUpload
                      leadId={effectiveLeadId()}
                      documentType="companyRegistration"
                      documentLabel="Company Registration Proof"
                      currentDocument={documents.companyRegistration}
                      onUploadComplete={(doc) => handleDocumentUpload('companyRegistration', doc)}
                      currentUser={currentUser}
                    />
                  ) : (
                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-slate-700">Company Registration Proof</label>
                      {loadingDocuments ? (
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-500 italic">
                          Loading documents...
                        </div>
                      ) : documents.companyRegistration ? (
                        <div className="flex items-center justify-between gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-green-700">📄</span>
                            <span className="text-green-800 font-medium truncate">{documents.companyRegistration.fileName}</span>
                          </div>
                          <button
                            onClick={() => handleViewDocument(documents.companyRegistration, 'Company Registration Proof')}
                            className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                          >
                            View
                          </button>
                        </div>
                      ) : (
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-500 italic">
                          No document uploaded
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* PAN Card */}
                <div>
                  {isEditing ? (
                    <SimpleDocUpload
                      leadId={effectiveLeadId()}
                      documentType="panCard"
                      documentLabel="PAN CARD"
                      currentDocument={documents.panCard}
                      onUploadComplete={(doc) => handleDocumentUpload('panCard', doc)}
                      currentUser={currentUser}
                    />
                  ) : (
                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-slate-700">PAN CARD</label>
                      {loadingDocuments ? (
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-500 italic">
                          Loading documents...
                        </div>
                      ) : documents.panCard ? (
                        <div className="flex items-center justify-between gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-green-700">📄</span>
                            <span className="text-green-800 font-medium truncate">{documents.panCard.fileName}</span>
                          </div>
                          <button
                            onClick={() => handleViewDocument(documents.panCard, 'PAN CARD')}
                            className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                          >
                            View
                          </button>
                        </div>
                      ) : (
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-500 italic">
                          No document uploaded
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* GST Number */}
                <div>
                  {isEditing ? (
                    <SimpleDocUpload
                      leadId={effectiveLeadId()}
                      documentType="gstNumber"
                      documentLabel="GST NUMBER"
                      currentDocument={documents.gstNumber}
                      onUploadComplete={(doc) => handleDocumentUpload('gstNumber', doc)}
                      currentUser={currentUser}
                    />
                  ) : (
                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-slate-700">GST NUMBER</label>
                      {loadingDocuments ? (
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-500 italic">
                          Loading documents...
                        </div>
                      ) : documents.gstNumber ? (
                        <div className="flex items-center justify-between gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-green-700">📄</span>
                            <span className="text-green-800 font-medium truncate">{documents.gstNumber.fileName}</span>
                          </div>
                          <button
                            onClick={() => handleViewDocument(documents.gstNumber, 'GST NUMBER')}
                            className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                          >
                            View
                          </button>
                        </div>
                      ) : (
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-500 italic">
                          No document uploaded
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* MOU */}
                <div>
                  {isEditing ? (
                    <SimpleDocUpload
                      leadId={effectiveLeadId()}
                      documentType="mou"
                      documentLabel="MOU"
                      currentDocument={documents.mou}
                      onUploadComplete={(doc) => handleDocumentUpload('mou', doc)}
                      currentUser={currentUser}
                    />
                  ) : (
                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-slate-700">MOU</label>
                      {loadingDocuments ? (
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-500 italic">
                          Loading documents...
                        </div>
                      ) : documents.mou ? (
                        <div className="flex items-center justify-between gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-green-700">📄</span>
                            <span className="text-green-800 font-medium truncate">{documents.mou.fileName}</span>
                          </div>
                          <button
                            onClick={() => handleViewDocument(documents.mou, 'MOU')}
                            className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                          >
                            View
                          </button>
                        </div>
                      ) : (
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-500 italic">
                          No document uploaded
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-blue-200">
              <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
                📞 Contact Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* 🟢 SAFE FIX: Ensure lead.contacts is an array */}
                {(Array.isArray(lead.contacts) ? lead.contacts : []).map((contact, index) => (
                  <div key={index} className="bg-gradient-to-br from-blue-50 to-indigo-50 p-3 rounded-lg border border-blue-200">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="text-sm font-bold text-slate-800">{contact.name}</h4>
                      {isEditing && (
                        <button
                          onClick={() => handleEditContact(contact)}
                          className="px-2 py-1 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded hover:from-blue-700 hover:to-indigo-700 transition-all"
                        >
                          ✏️ Edit
                        </button>
                      )}
                    </div>
                    <div className="space-y-2 text-sm text-slate-700">
                      <p className="flex items-center gap-2">📞 {contact.phone}</p>
                      <p className="flex items-center gap-2">📧 {contact.email}</p>
                      {contact.city && <p className="flex items-center gap-2">📍 {contact.city}, {contact.country}</p>}

                      {/* Alternate Contact Details - Always show section */}
                      <div className="mt-3 pt-2 border-t border-blue-200">
                        <h5 className="text-xs font-bold text-slate-600 mb-2">🔄 Alternate Contact Details</h5>
                        <div className="space-y-1">
                          {contact.alternateMobile && contact.alternateMobile.trim() ? (
                            <p className="flex items-center gap-2 text-xs">📱 Alt Mobile: {contact.alternateMobile}</p>
                          ) : (
                            <p className="flex items-center gap-2 text-xs text-slate-500">📱 Alt Mobile: Not provided</p>
                          )}
                          {contact.pocName && contact.pocName.trim() ? (
                            <p className="flex items-center gap-2 text-xs">👤 POC Name: {contact.pocName}</p>
                          ) : (
                            <p className="flex items-center gap-2 text-xs text-slate-500">👤 POC Name: Not provided</p>
                          )}
                          {contact.pocDesignation && contact.pocDesignation.trim() ? (
                            <p className="flex items-center gap-2 text-xs">💼 POC Designation: {contact.pocDesignation}</p>
                          ) : (
                            <p className="flex items-center gap-2 text-xs text-slate-500">💼 POC Designation: Not provided</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add/Edit Contact Button */}
              {isEditing && (
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={handleAddContact}
                    className="px-4 py-2 text-sm font-bold text-white bg-gradient-to-r from-green-600 to-emerald-600 rounded-lg hover:from-green-700 hover:to-emerald-700 border-2 border-green-600 shadow-lg transition-all transform hover:scale-105"
                  >
                    ➕ Add Contact
                  </button>
                </div>
              )}
            </div>

            <div className="bg-white p-4 rounded-lg shadow-sm border border-blue-200">
              <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
                🏷️ Tags
              </h3>
              {isEditing ? (
                <>
                  <MultiSelect
                    options={(availableTags || []).map(tag => ({ value: tag, label: tag }))}
                    selectedValues={(editData.tags as string[]) || []}
                    onChange={handleTagsChange}
                    placeholder="Select tags"
                    className="text-sm"
                  />
                  {isAdmin && onCreateTag && (
                    <div className="mt-2 flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={newTagName}
                        onChange={(e) => {
                          setNewTagName(e.target.value);
                          if (tagError) setTagError('');
                        }}
                        placeholder="Add new tag"
                        className="flex-1 px-3 py-2 text-sm border-2 border-slate-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 bg-white text-slate-800"
                      />
                      <button
                        type="button"
                        onClick={handleAddNewTag}
                        disabled={isCreatingTag}
                        className={`px-4 py-2 text-sm font-semibold text-white rounded-lg border-2 shadow-sm ${isCreatingTag
                            ? 'bg-gray-400 border-gray-400 cursor-not-allowed'
                            : 'bg-indigo-600 border-indigo-600 hover:bg-indigo-700'
                          }`}
                      >
                        {isCreatingTag ? 'Adding…' : '➕ Add Tag'}
                      </button>
                    </div>
                  )}
                  {tagError && (
                    <p className="mt-1 text-xs font-medium text-red-600 bg-red-50 p-1 rounded">
                      ⚠️ {tagError}
                    </p>
                  )}
                  {((editData.tags as string[]) || []).length > 0 ? (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {(editData.tags as string[]).map(tag => (
                        <span
                          key={tag}
                          className="px-2 py-1 text-xs font-medium bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-slate-500">No tags selected yet.</p>
                  )}
                </>
              ) : (
                <>
                  {leadTags.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {leadTags.map(tag => (
                        <span key={tag} className="px-3 py-1 bg-gradient-to-r from-indigo-100 to-blue-100 text-indigo-800 rounded-lg text-sm font-medium border border-indigo-200">
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">No tags assigned.</p>
                  )}
                </>
              )}
            </div>

            {/* Save Button */}
            {isEditing && (
              <div className="flex justify-end pt-4">
                <button
                  onClick={handleSave}
                  className="px-6 py-2 text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-blue-600 rounded-lg hover:from-indigo-700 hover:to-blue-700 border-2 border-indigo-600 shadow-lg transition-all transform hover:scale-105"
                >
                  ✅ Save Changes
                </button>
              </div>
            )}
          </div>
        )}

        {/* Follow-ups Tab */}
        {activeTab === 'followups' && (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-lg shadow-sm border border-blue-200">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">📞 Follow-ups</h3>
                {canEdit && (
                  <button
                    onClick={() => setActiveTab('followups')}
                    className="px-4 py-2 text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-blue-600 rounded-lg hover:from-indigo-700 hover:to-blue-700 border-2 border-indigo-600 shadow-lg transition-all transform hover:scale-105"
                  >
                    ➕ Add Follow-up
                  </button>
                )}
              </div>
            </div>

            {/* Add New Follow-up Form */}
            {canEdit && (
              <div className="bg-white p-4 rounded-lg shadow-sm border border-blue-200">
                <h4 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">➕ Add New Follow-up</h4>
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-bold text-slate-800 mb-1">📋 Type</label>
                      <select
                        value={newFollowUp.type}
                        onChange={(e) => setNewFollowUp(prev => ({ ...prev, type: e.target.value as FollowUpType }))}
                        className="block w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 bg-white text-slate-800"
                      >
                        {FOLLOW_UP_TYPES.map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-slate-800 mb-1">📊 Status</label>
                      <select
                        value={newFollowUp.status}
                        onChange={(e) => setNewFollowUp(prev => ({ ...prev, status: e.target.value as FollowUpStatus }))}
                        className="block w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 bg-white text-slate-800"
                      >
                        {FOLLOW_UP_STATUSES.map(status => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-1 gap-1">
                      <CustomDateTimePicker
                        label="Scheduled Date & Time"
                        value={newFollowUp.scheduledDate}
                        onChange={(val) => setNewFollowUp(prev => ({ ...prev, scheduledDate: val }))}
                        min={(() => {
                          const now = new Date();
                          const year = now.getFullYear();
                          const month = String(now.getMonth() + 1).padStart(2, '0');
                          const day = String(now.getDate()).padStart(2, '0');
                          const hours = String(now.getHours()).padStart(2, '0');
                          const minutes = String(now.getMinutes()).padStart(2, '0');
                          return `${year}-${month}-${day}T${hours}:${minutes}`;
                        })()}
                        required
                      />
                      <p className="text-[10px] text-slate-500 mt-1 italic">
                        * Firefox Friendly Picker
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-slate-800 mb-1">👤 Assigned To</label>
                      <select
                        value={newFollowUp.assignedTo}
                        onChange={(e) => setNewFollowUp(prev => ({ ...prev, assignedTo: e.target.value }))}
                        className="block w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 bg-white text-slate-800"
                      >
                        {availableUsers.map((user, idx) => (
                          <option key={user.id ?? user.email ?? `user-${idx}`} value={user.email}>{user.name} - {user.role}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-800 mb-1">📝 Notes</label>
                    <textarea
                      value={newFollowUp.notes}
                      onChange={(e) => setNewFollowUp(prev => ({ ...prev, notes: e.target.value }))}
                      rows={3}
                      className="block w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 bg-white text-slate-800 placeholder-slate-400"
                      placeholder="Enter follow-up notes..."
                    />
                  </div>

                  <div className="flex justify-end pt-3">
                    <button
                      onClick={handleAddFollowUp}
                      disabled={isAddingFollowUp}
                      className={`px-6 py-2 text-sm font-bold text-white rounded-lg border-2 shadow-lg transition-all transform hover:scale-105 flex items-center justify-center min-w-[150px] ${
                        isAddingFollowUp 
                          ? 'bg-indigo-400 border-indigo-400 cursor-not-allowed opacity-70' 
                          : 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 border-indigo-600'
                      }`}
                    >
                      {isAddingFollowUp ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Adding...
                        </>
                      ) : (
                        '✅ Add Follow-up'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Follow-ups List */}
            <div className="space-y-4">
              {leadFollowUps.length > 0 ? (
                <>
                  {/* Pagination Controls - TOP (Removed, using bottom SimplePagination) */}

                  {leadFollowUps
                    .slice((followUpPage - 1) * followUpsPerPage, followUpPage * followUpsPerPage)
                    .map((followUp, index) => {
                  const isHighlighted = highlightFollowUpId && followUp.id === highlightFollowUpId;
                  const isEditingThis = editingFollowUpId === followUp.id;
                  return (
                    <div
                      key={followUp.id || index}
                      ref={isHighlighted ? highlightedFollowUpRef : null}
                      className={`border rounded-lg p-4 transition-all duration-300 ${isHighlighted
                          ? 'bg-yellow-50 border-yellow-400 shadow-lg ring-2 ring-yellow-300'
                          : 'bg-white border-slate-200'
                        }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="font-medium text-slate-800">{followUp.type}</span>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getFollowUpStatusColor(followUp.status)}`}>
                              {followUp.status}
                            </span>
                            {isHighlighted && (
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-200 text-yellow-800 border border-yellow-300">
                                📍 Selected
                              </span>
                            )}
                          </div>
                          {isEditingThis ? (
                            <div className="space-y-4 mt-3 bg-slate-50 p-4 rounded-lg border border-indigo-100 shadow-inner">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Follow-up Type</label>
                                  <select
                                    value={editFollowUpData.type || 'Call'}
                                    onChange={(e) => handleTypeChange(e.target.value as FollowUp['type'])}
                                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                  >
                                    <option value="Call">📞 Call</option>
                                    <option value="Email">📧 Email</option>
                                    <option value="Meeting">🤝 Meeting</option>
                                    <option value="WhatsApp">💬 WhatsApp</option>
                                    <option value="Other">📝 Other</option>
                                  </select>
                                </div>
                                <div className="space-y-2">
                                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Status</label>
                                  <select
                                    value={editFollowUpData.status || 'Planned'}
                                    onChange={(e) => handleStatusChange(e.target.value as 'Planned' | 'Done')}
                                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                  >
                                    <option value="Planned">⏳ Planned</option>
                                    <option value="Done">✅ Done</option>
                                  </select>
                                </div>
                              </div>

                              <div className="space-y-2">
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Scheduled Date & Time</label>
                                <CustomDateTimePicker
                                  value={editFollowUpData.date || ''}
                                  onChange={(date) => setEditFollowUpData({ ...editFollowUpData, date })}
                                />
                              </div>

                              <div className="space-y-2">
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Notes</label>
                                <textarea
                                  value={editFollowUpData.notes || ''}
                                  onChange={(e) => setEditFollowUpData({ ...editFollowUpData, notes: e.target.value })}
                                  placeholder="What was discussed or what's planned?"
                                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none min-h-[80px]"
                                />
                              </div>

                              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                                <button
                                  onClick={() => {
                                    setEditingFollowUpId(null);
                                    setEditFollowUpData({});
                                  }}
                                  className="px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={handleSaveEditedFollowUp}
                                  className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-md transition-all active:scale-95"
                                >
                                  Update Follow-up
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <p className="text-sm text-slate-600 mb-2">{followUp.notes}</p>
                              <div className="text-xs text-slate-500 space-y-1">
                                <p>
                                  📅 Scheduled: <span className={new Date(followUp.date) < new Date() && followUp.status === 'Planned' ? 'text-red-600 font-semibold' : ''}>{formatDate(followUp.date)}</span>
                                </p>
                                <p>👤 Assigned to: {getUserDisplayName(lead.accountManager || followUp.assignedTo)}</p>
                                <p>📝 Created by: {getUserDisplayName(followUp.createdBy)}</p>
                              </div>
                            </>
                          )}
                        </div>
                        {canEdit && !isEditingThis && (
                          <div className="flex gap-2 ml-4">
                            <button
                              onClick={() => {
                                setEditingFollowUpId(followUp.id);
                                setEditFollowUpData({ ...followUp });
                              }}
                              className="px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 border border-indigo-200"
                              title="Edit follow-up"
                            >
                              ✏️ Edit
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    );
                  })}

                  {/* Pagination Controls - BOTTOM */}
                  {leadFollowUps.length > 0 && (
                    <div className="mt-4">
                      <SimplePagination
                        currentPage={followUpPage}
                        totalPages={Math.ceil(leadFollowUps.length / followUpsPerPage)}
                        totalItems={leadFollowUps.length}
                        itemsPerPage={followUpsPerPage}
                        onPageChange={setFollowUpPage}
                        onItemsPerPageChange={setFollowUpsPerPage}
                        startIndex={(followUpPage - 1) * followUpsPerPage}
                        endIndex={Math.min(followUpPage * followUpsPerPage, leadFollowUps.length)}
                      />
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <p>No follow-ups yet. Add one above to get started.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-blue-800">Activity History</h3>
            <div className="space-y-4">
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <div>
                    <p className="font-medium text-slate-800">Lead Created</p>
                    <p className="text-sm text-slate-600">Created by {getUserDisplayName(lead.createdBy)}</p>
                    <p className="text-xs text-slate-500">{formatDate(lead.createdAt)}</p>
                  </div>
                </div>
              </div>

              {leadFollowUps.map((followUp, index) => (
                <div key={index} className="bg-white border border-slate-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <div>
                      <p className="font-medium text-slate-800">{followUp.type} Follow-up</p>
                      <p className="text-sm text-slate-600">{followUp.notes}</p>
                      <p className="text-xs text-slate-500">
                        {followUp.status} • <span className={new Date(followUp.date) < new Date() && followUp.status === 'Planned' ? 'text-red-600 font-semibold' : ''}>{formatDate(followUp.date)}</span> • {getUserDisplayName(followUp.createdBy)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Meeting Remarks Integration */}
            <MeetingRemarksIntegration
              lead={lead}
              meetingCheckIns={meetingCheckIns}
              onAddFollowUp={onAddFollowUp}
              availableUsers={availableUsers}
            />
          </div>
        )}
      </div>

      {/* Contact Edit Modal - Only render when in edit mode and modal should be open */}
      {isEditing && isContactModalOpen && (
        <ContactEditModal
          isOpen={isContactModalOpen}
          onClose={() => {
            console.log('❌ Closing Contact Edit Modal');
            setIsContactModalOpen(false);
            setSelectedContact(null);
          }}
          contact={selectedContact}
          onSave={handleSaveContact}
          mode={contactModalMode}
        />
      )}

      {/* Document Viewer Modal */}
      {selectedDocument && (
        <SimpleDocViewer
          document={selectedDocument}
          isOpen={isDocumentViewerOpen}
          onClose={() => setIsDocumentViewerOpen(false)}
        />
      )}

      {showIcpScoreModal && (() => {
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
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[200]" onClick={() => setShowIcpScoreModal(false)}>
            <div className="bg-white rounded-xl shadow-2xl max-w-[95vw] w-full max-h-[95vh] mx-4 my-4 flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
              {/* Header */}
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white flex-shrink-0">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">🎯</span>
                  <h2 className="text-2xl font-bold text-slate-800">ICP Scoring System</h2>
                </div>
                <button
                  onClick={() => setShowIcpScoreModal(false)}
                  className="text-slate-400 hover:text-slate-600 text-3xl font-light transition-colors"
                >
                  &times;
                </button>
              </div>
              
              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-8 pt-4">
                <p className="text-slate-600 mb-6 font-medium">
                  Use this scoring system to assess agencies/partners. Enter a score (0-10) for each category, and the average will be calculated automatically.
                </p>

                {/* How to Use Box */}
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 mb-8 relative">
                  <div className="flex items-start gap-3 mb-3">
                    <span className="text-xl">💡</span>
                    <h3 className="font-bold text-blue-900">How to Use:</h3>
                  </div>
                  <ul className="space-y-2 text-blue-800 font-medium pl-8 list-decimal">
                    <li>Review each category and assessment parameter</li>
                    <li>Evaluate the agency based on the scoring logic</li>
                    <li>Enter a score (0-10) for each category in the "Your Score" column</li>
                    <li>The average will be calculated automatically and can be applied to the ICP Score field</li>
                  </ul>
                </div>

                {/* Reference Toggle */}
                <div className="flex justify-end mb-6">
                  <button
                    type="button"
                    onClick={() => setShowReferenceTable(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-md transition-all active:scale-95"
                  >
                    <input 
                      type="checkbox" 
                      checked={showReferenceTable} 
                      readOnly 
                      className="w-4 h-4 rounded border-white/30 bg-white/20"
                    />
                    <span>View Reference Examples</span>
                  </button>
                </div>

                {/* 4-Column Table */}
                <div className="overflow-hidden border border-slate-200 rounded-xl shadow-sm">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-[#E9EDF9]">
                        <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 border-b border-r border-slate-200">Category</th>
                        <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 border-b border-r border-slate-200">Assessment Parameter</th>
                        <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 border-b border-r border-slate-200">Scoring Logic (0-10)</th>
                        <th className="px-6 py-4 text-center text-sm font-bold text-slate-700 border-b bg-[#D9E2FF] w-48">Your Score (0-10)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {[
                        { 
                          cat: 'Business Profile', 
                          param: 'Business Age', 
                          logic: ['24+ months = 10', '12-24 = 7', '6-12 = 5', '<6 = 2'] 
                        },
                        { 
                          cat: 'Services Portfolio', 
                          param: 'Main Study Destinations', 
                          logic: ['Canada focus = 3', 'UK = 2', 'Others = 1'] 
                        },
                        { 
                          cat: 'Online Presence', 
                          param: 'Digital & Social Media Reputation', 
                          logic: ['Strong (≥4.5 & >100 reviews) = 10', 'Moderate = 7', 'Weak = 3'] 
                        },
                        { 
                          cat: 'Operational Scale', 
                          param: 'Visa Success Cases (Last 6 months)', 
                          logic: ['>20 = 10', '15-20 = 7', '10-15 = 5', '<10 = 3'] 
                        },
                        { 
                          cat: 'Applicant Volume', 
                          param: 'Successful Submissions', 
                          logic: ['>50 = 10', '25-50 = 7', '<25 = 5'] 
                        },
                        { 
                          cat: 'Team Strength', 
                          param: 'Staff Count', 
                          logic: ['Well-staffed = 10', 'Moderate = 7', 'Small = 5'] 
                        },
                        { 
                          cat: 'Network Strength', 
                          param: 'Tie-ups (Canada)', 
                          logic: ['>10 = 10', '5-10 = 7', '<5 = 5'] 
                        },
                        { 
                          cat: 'Applicant Quality', 
                          param: 'Genuine Ratio', 
                          logic: ['<5% fake = 10', '5-10% = 7', '10-20% = 5'] 
                        },
                        { 
                          cat: 'Physical Presence', 
                          param: 'Branches', 
                          logic: ['Multi-city = 10', 'Single-city = 7'] 
                        }
                      ].map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-5 text-sm font-bold text-slate-800 border-r border-slate-100">{row.cat}</td>
                          <td className="px-6 py-5 text-sm font-medium text-slate-600 border-r border-slate-100">{row.param}</td>
                          <td className="px-6 py-5 text-sm text-slate-500 border-r border-slate-100">
                            <ul className="list-disc pl-4 space-y-1">
                              {row.logic.map((l, i) => <li key={i}>{l}</li>)}
                            </ul>
                          </td>
                          <td className="px-6 py-5 text-center">
                            <input
                              type="number"
                              min="0"
                              max="10"
                              placeholder="0-10"
                              value={categoryScores[row.cat] || ''}
                              onChange={(e) => handleCategoryScoreChange(row.cat, e.target.value)}
                              className="w-24 px-3 py-2 text-center border border-slate-200 rounded-lg font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-300"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              
              {/* Reference Table Modal */}
              {showReferenceTable && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[210]" onClick={() => setShowReferenceTable(false)}>
                  <div className="bg-white rounded-xl shadow-2xl max-w-[90vw] w-full max-h-[85vh] mx-4 my-4 flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
                    <div className="bg-[#1D4ED8] text-white p-5 flex-shrink-0 flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">📖</span>
                        <h3 className="text-xl font-bold">Reference Examples</h3>
                      </div>
                      <button onClick={() => setShowReferenceTable(false)} className="text-white hover:text-gray-200 text-2xl font-light">×</button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-6">
                      <p className="text-slate-600 mb-6 font-medium">
                        This table shows example answers and verification sources for reference. Use this as a guide when scoring each category.
                      </p>
                      
                      <div className="overflow-hidden border border-slate-200 rounded-xl">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="bg-[#E9EDF9]">
                              <th className="px-4 py-3 text-left text-sm font-bold text-slate-700 border-b border-r border-slate-200">Category</th>
                              <th className="px-4 py-3 text-left text-sm font-bold text-slate-700 border-b border-r border-slate-200">Assessment Parameter</th>
                              <th className="px-4 py-3 text-left text-sm font-bold text-slate-700 border-b border-r border-slate-200">Expected / Example Answer</th>
                              <th className="px-4 py-3 text-left text-sm font-bold text-slate-700 border-b border-slate-200">Verification Source</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {[
                              { cat: 'Business Profile', param: 'Business Age', ans: '6 months, 2 years, 5+ years', src: 'Zauba, Google reviews' },
                              { cat: 'Services Portfolio', param: 'Main Study Destinations', ans: 'Canada, US, UK, Australia', src: 'Website, Social media' },
                              { cat: 'Online Presence', param: 'Digital & Social Media Reputation', ans: 'Google rating 4.5+, 200+ reviews', src: 'Google, FB, Instagram' },
                              { cat: 'Operational Scale', param: 'Visa Success Cases (Last 6 months)', ans: '10–30', src: 'Internal data / Ref call' },
                              { cat: 'Applicant Volume', param: 'No. of successful submissions', ans: '25–100+', src: 'CRM / Reference' },
                              { cat: 'Team Strength', param: 'Staff Count', ans: 'Counselors: 5-10, Visa: 2-3, Ops: 2-5', src: 'LinkedIn / Office call' },
                              { cat: 'Network Strength', param: 'Direct / Indirect Tie-ups', ans: 'Canada: 10-20, USA: 5', src: 'Partner list / Call' },
                              { cat: 'Applicant Quality', param: 'Genuine vs Fake Ratio', ans: '<5% fake cases', src: 'Record audit / Referral' },
                              { cat: 'Physical Presence', param: 'Branches (India / Abroad)', ans: 'e.g., Delhi, Punjab, Dubai', src: 'Website / Call' }
                            ].map((row, idx) => (
                              <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-4 text-sm font-bold text-slate-800 border-r border-slate-100">{row.cat}</td>
                                <td className="px-4 py-4 text-sm font-medium text-slate-600 border-r border-slate-100">{row.param}</td>
                                <td className="px-4 py-4 text-sm text-slate-600 border-r border-slate-100">{row.ans}</td>
                                <td className="px-4 py-4 text-sm text-slate-600">{row.src}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    
                    <div className="flex-shrink-0 border-t border-slate-100 bg-slate-50 p-4 flex justify-end">
                      <button 
                        onClick={() => setShowReferenceTable(false)} 
                        className="px-8 py-2 bg-[#2563EB] hover:bg-blue-700 text-white rounded-lg font-bold shadow-md shadow-blue-200 transition-all active:scale-95"
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
                  type="button"
                  onClick={() => setShowIcpScoreModal(false)}
                  className="px-6 py-2 text-sm font-semibold bg-slate-400 text-white rounded-lg hover:bg-slate-500"
                >
                  Cancel
                </button>
                {average !== null && average >= 1 && average <= 10 && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditData(prev => ({ ...prev, icpScore: Math.round(average) }));
                      setShowIcpScoreModal(false);
                    }}
                    className="px-6 py-2 text-sm font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    ✅ Apply Score ({Math.round(average)}/10)
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </Modal>
  );
};