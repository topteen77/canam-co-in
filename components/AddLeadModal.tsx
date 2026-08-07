import React, { useState } from 'react';
import { Modal } from './Modal';
import { ImageUploadOCR } from './ImageUploadOCR';
import { MultiSelect } from './MultiSelect';
import { SimpleDocUpload } from './SimpleDocUpload';
import { getUserDisplayName } from '../utils/dataCleaning';
import type { Lead, AgencyDocuments } from '../types';
import { LEAD_STATUSES, AGENT_CATEGORIES, LEAD_SOURCES } from '../types';

interface AddLeadModalProps {
  onClose: () => void;
  onAddLead: (data: Partial<Lead>) => Promise<void>;
  currentUser: string | null;
  isAdmin: boolean;
  availableUsers: Array<{ id: string; name: string; email: string; role: string }>;
  availableTags: string[];
  onCreateTag?: (tagName: string) => Promise<string>;
}

export const AddLeadModal: React.FC<AddLeadModalProps> = ({
  onClose,
  onAddLead,
  currentUser,
  isAdmin,
  availableUsers,
  availableTags,
  onCreateTag
}) => {
  const [ocrError, setOcrError] = useState('');
  const [formData, setFormData] = useState({
    agencyName: '',
    contactName: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    alternateMobile: '',
    pocDesignation: '',
    status: 'New' as Lead['status'],
    agentCategory: 'Beginner' as Lead['agentCategory'],
    leadSource: 'Website' as Lead['leadSource'],
    tags: [] as string[],
    accountManager: '',
    salesPerson: '',
    onboardingDate: '',
    potentialStudentsCount: '',
    remarks: '',
    websiteLink: '',
    icpScore: undefined as number | undefined
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [agencyDocuments, setAgencyDocuments] = useState<AgencyDocuments>({});
  const [newTagName, setNewTagName] = useState('');
  const [tagError, setTagError] = useState('');
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ICP Score Modal States
  const [showIcpScoreModal, setShowIcpScoreModal] = useState(false);
  const [showReferenceTable, setShowReferenceTable] = useState(false);
  const [categoryScores, setCategoryScores] = useState<Record<string, number | ''>>({
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

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field]) setFormErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const handlePhoneChange = (field: string, value: string) => {
    const clean = value.replace(/\D/g, '').slice(0, 10);
    handleInputChange(field, clean);
  };

  const handleEmailChange = (field: string, value: string) => {
    handleInputChange(field, value.trim().toLowerCase());
  };

  const validatePhone = (phone: string) => !phone || /^\d{10}$/.test(phone);
  const validateEmail = (email: string) => !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.agencyName.trim()) errors.agencyName = 'Agency name is required';
    if (formData.phone && !validatePhone(formData.phone)) errors.phone = 'Phone must be exactly 10 digits';
    if (formData.email && !validateEmail(formData.email)) errors.email = 'Please enter a valid email';
    if (formData.alternateMobile && !validatePhone(formData.alternateMobile)) errors.alternateMobile = 'Alternate mobile must be 10 digits';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleDocumentUpload = (documentType: 'companyRegistration' | 'panCard' | 'gstNumber' | 'mou', document: any) => {
    setAgencyDocuments((prev) => ({ ...prev, [documentType]: document }));
  };

  const handleTagsChange = (values: string[]) => {
    setFormData((prev) => ({ ...prev, tags: values }));
  };

  const handleCreateNewTag = async () => {
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
      setFormData((prev) => ({ ...prev, tags: Array.from(new Set([...(prev.tags || []), created])) }));
      setNewTagName('');
    } catch (e) {
      setTagError(e instanceof Error ? e.message : 'Failed to add tag');
    } finally {
      setIsCreatingTag(false);
    }
  };

  const handleOCRComplete = (extractedData: any) => {
    if (extractedData.agencyName) setFormData((prev) => ({ ...prev, agencyName: extractedData.agencyName }));
    if (extractedData.contactName) setFormData((prev) => ({ ...prev, contactName: extractedData.contactName }));
    if (extractedData.phone) setFormData((prev) => ({ ...prev, phone: extractedData.phone }));
    if (extractedData.email) setFormData((prev) => ({ ...prev, email: extractedData.email }));
    if (extractedData.address) setFormData((prev) => ({ ...prev, address: extractedData.address }));
    if (extractedData.city) setFormData((prev) => ({ ...prev, city: extractedData.city }));
    if (extractedData.alternateMobile) setFormData((prev) => ({ ...prev, alternateMobile: extractedData.alternateMobile }));
    if (extractedData.pocDesignation) setFormData((prev) => ({ ...prev, pocDesignation: extractedData.pocDesignation }));
    if (extractedData.websiteLink) setFormData((prev) => ({ ...prev, websiteLink: extractedData.websiteLink }));
    if (extractedData.remarks) setFormData((prev) => ({ ...prev, remarks: extractedData.remarks }));
    setOcrError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!validateForm()) {
      alert('Please fix the form errors before submitting');
      return;
    }
    setIsSubmitting(true);
    try {
      const contactId = `contact_${Date.now()}`;
      await onAddLead({
        agencyName: formData.agencyName.trim(),
        status: formData.status,
        agentCategory: formData.agentCategory,
        leadSource: formData.leadSource,
        tags: formData.tags || [],
        accountManager: formData.accountManager.trim() || undefined,
        salesPerson: formData.salesPerson.trim() || undefined,
        remarks: formData.remarks.trim() || undefined,
        websiteLink: formData.websiteLink.trim() || undefined,
        icpScore: formData.icpScore ?? undefined,
        onboardingDate: formData.onboardingDate.trim() || undefined,
        applicants: formData.potentialStudentsCount.trim() || undefined,
        agencyDocuments: Object.keys(agencyDocuments).length ? agencyDocuments : undefined,
        contacts: [{
          id: contactId,
          name: formData.contactName.trim() || formData.agencyName.trim(),
          role: 'POC',
          phone: formData.phone.trim(),
          email: formData.email.trim() || undefined,
          address: formData.address.trim() || undefined,
          city: formData.city.trim() || undefined,
          alternateMobile: formData.alternateMobile.trim() || undefined,
          pocName: formData.contactName.trim() || undefined,
          pocDesignation: formData.pocDesignation.trim() || undefined
        }],
        followUps: []
      });
      onClose();
    } catch (err: any) {
      alert(err?.message || 'Failed to add lead. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
    <Modal title="Add New Agency/Partner" onClose={onClose} maxWidth="max-w-5xl">
      <form onSubmit={handleSubmit} className="space-y-4 bg-gradient-to-br from-blue-50 to-indigo-50 p-4 sm:p-6 rounded-lg max-h-[85vh] overflow-y-auto">
        {/* OCR */}
        <ImageUploadOCR onExtractComplete={handleOCRComplete} onError={setOcrError} />
        {ocrError && (
          <div className="bg-red-50 border-2 border-red-200 rounded-lg p-3">
            <p className="text-sm font-medium text-red-800">⚠️ {ocrError}</p>
            <p className="text-xs text-red-600 mt-1">You can still fill the form manually.</p>
          </div>
        )}

        {/* Agency Name */}
        <div className="bg-white p-3 rounded-lg shadow-sm border border-blue-200">
          <label htmlFor="agencyName" className="block text-sm font-bold text-slate-800 mb-1">🏢 Agency / Partner Name *</label>
          <input
            type="text"
            id="agencyName"
            value={formData.agencyName}
            onChange={(e) => handleInputChange('agencyName', e.target.value)}
            className={`block w-full px-3 py-2 text-sm border-2 rounded-lg focus:border-indigo-500 bg-white min-h-[44px] ${formErrors.agencyName ? 'border-red-500' : 'border-slate-300'}`}
            placeholder="Enter agency or partner name"
            required
          />
          {formErrors.agencyName && <p className="mt-1 text-xs font-medium text-red-600">⚠️ {formErrors.agencyName}</p>}
        </div>

        {/* Account Manager, Sales Person, Lead Created By */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-3 rounded-lg shadow-sm border border-blue-200">
            <label className="block text-sm font-bold text-slate-800 mb-1">👤 Account Manager</label>
            <select
              value={formData.accountManager}
              onChange={(e) => handleInputChange('accountManager', e.target.value)}
              className="block w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg bg-white min-h-[44px]"
            >
              <option value="">Select (Optional)</option>
              {currentUser && <option value={currentUser}>Me ({getUserDisplayName(currentUser)})</option>}
              {availableUsers.map((u) => <option key={u.id} value={u.email}>{u.name} - {u.role}</option>)}
            </select>
          </div>
          <div className="bg-white p-3 rounded-lg shadow-sm border border-blue-200">
            <label className="block text-sm font-bold text-slate-800 mb-1">💼 Sales Person</label>
            <select
              value={formData.salesPerson}
              onChange={(e) => handleInputChange('salesPerson', e.target.value)}
              className="block w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg bg-white min-h-[44px]"
            >
              <option value="">Select (Optional)</option>
              {currentUser && <option value={currentUser}>Me ({getUserDisplayName(currentUser)})</option>}
              {availableUsers.map((u) => <option key={u.id} value={u.email}>{u.name} - {u.role}</option>)}
            </select>
          </div>
          <div className="bg-white p-3 rounded-lg shadow-sm border border-blue-200">
            <label className="block text-sm font-bold text-slate-800 mb-1">✍️ Lead Created By</label>
            <input
              type="text"
              value={currentUser ? getUserDisplayName(currentUser) : ''}
              disabled
              className="block w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg bg-slate-100 min-h-[44px]"
            />
          </div>
        </div>

        {/* Contact Information */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-blue-200">
          <h3 className="text-lg font-bold text-slate-800 mb-3">📞 Contact Information</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-bold text-slate-800 mb-1">👤 Primary Contact Name</label>
              <input
                type="text"
                value={formData.contactName}
                onChange={(e) => handleInputChange('contactName', e.target.value)}
                className="block w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg min-h-[44px]"
                placeholder="Primary contact person"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1">📱 Primary Mobile *</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handlePhoneChange('phone', e.target.value)}
                  className={`block w-full px-3 py-2 text-sm border-2 rounded-lg min-h-[44px] ${formErrors.phone ? 'border-red-500' : 'border-slate-300'}`}
                  placeholder="9876543210"
                  maxLength={10}
                  required
                />
                {formErrors.phone && <p className="mt-1 text-xs text-red-600">⚠️ {formErrors.phone}</p>}
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1">📧 Primary Email *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleEmailChange('email', e.target.value)}
                  className={`block w-full px-3 py-2 text-sm border-2 rounded-lg min-h-[44px] ${formErrors.email ? 'border-red-500' : 'border-slate-300'}`}
                  placeholder="contact@agency.com"
                  required
                />
                {formErrors.email && <p className="mt-1 text-xs text-red-600">⚠️ {formErrors.email}</p>}
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1">📱 Alternate Mobile</label>
                <input
                  type="tel"
                  value={formData.alternateMobile}
                  onChange={(e) => handlePhoneChange('alternateMobile', e.target.value)}
                  className={`block w-full px-3 py-2 text-sm border-2 rounded-lg min-h-[44px] ${formErrors.alternateMobile ? 'border-red-500' : 'border-slate-300'}`}
                  placeholder="9876543210"
                  maxLength={10}
                />
                {formErrors.alternateMobile && <p className="mt-1 text-xs text-red-600">⚠️ {formErrors.alternateMobile}</p>}
              </div>
            </div>
          </div>
        </div>

        {/* Additional Details */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-blue-200">
          <h3 className="text-lg font-bold text-slate-800 mb-3">📋 Additional Details</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-bold text-slate-800 mb-1">💼 POC Designation</label>
              <input
                type="text"
                value={formData.pocDesignation}
                onChange={(e) => handleInputChange('pocDesignation', e.target.value)}
                className="block w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg min-h-[44px]"
                placeholder="Director, Manager"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1">🏠 Address</label>
                <textarea
                  value={formData.address}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  rows={2}
                  className="block w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg min-h-[44px]"
                  placeholder="Full address"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1">🏙️ City</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => handleInputChange('city', e.target.value)}
                  className="block w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg min-h-[44px]"
                  placeholder="City"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Lead Classification */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-blue-200">
          <h3 className="text-lg font-bold text-slate-800 mb-3">🏷️ Lead Classification</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-bold text-slate-800 mb-1">📊 Status</label>
              <select
                value={formData.status}
                onChange={(e) => handleInputChange('status', e.target.value)}
                className="block w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg bg-white min-h-[44px]"
              >
                {LEAD_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-800 mb-1">⭐ Agent Category</label>
              <select
                value={formData.agentCategory}
                onChange={(e) => handleInputChange('agentCategory', e.target.value)}
                className="block w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg bg-white min-h-[44px]"
              >
                {AGENT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-800 mb-1">🔍 Lead Source</label>
              <select
                value={formData.leadSource}
                onChange={(e) => handleInputChange('leadSource', e.target.value)}
                className="block w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg bg-white min-h-[44px]"
              >
                {LEAD_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Additional Information */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-blue-200">
          <h3 className="text-lg font-bold text-slate-800 mb-3">📈 Additional Information</h3>
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1">📅 Date of Onboarding</label>
                <input
                  type="date"
                  value={formData.onboardingDate}
                  onChange={(e) => handleInputChange('onboardingDate', e.target.value)}
                  className="block w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg min-h-[44px]"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1">👥 Potential Students Count (One Month)</label>
                <input
                  type="number"
                  value={formData.potentialStudentsCount}
                  onChange={(e) => handleInputChange('potentialStudentsCount', e.target.value)}
                  className="block w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg min-h-[44px]"
                  placeholder="25"
                  min={0}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1 flex items-center gap-2">
                  <span>🎯</span> ICP Score (1-10)
                </label>
                <div className="flex items-center gap-3">
                  <div className="relative w-32">
                    <input
                      type="text"
                      value={formData.icpScore !== undefined ? formData.icpScore : ''}
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
              <label className="block text-sm font-bold text-slate-800 mb-1">🏷️ Special Tags</label>
              <MultiSelect
                options={(availableTags || []).map((tag) => ({ value: tag, label: tag }))}
                selectedValues={formData.tags}
                onChange={handleTagsChange}
                placeholder="Select tags"
                className="text-sm"
              />
              {isAdmin && onCreateTag && (
                <div className="mt-2 flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={newTagName}
                    onChange={(e) => { setNewTagName(e.target.value); if (tagError) setTagError(''); }}
                    placeholder="Add new tag"
                    className="flex-1 px-3 py-2 text-sm border-2 border-slate-300 rounded-lg min-h-[44px]"
                  />
                  <button
                    type="button"
                    onClick={handleCreateNewTag}
                    disabled={isCreatingTag}
                    className="px-4 py-2 text-sm font-semibold text-white rounded-lg bg-indigo-600 hover:bg-indigo-700 min-h-[44px] disabled:opacity-50"
                  >
                    {isCreatingTag ? 'Adding…' : '➕ Add Tag'}
                  </button>
                </div>
              )}
              {tagError && <p className="mt-1 text-xs text-red-600">⚠️ {tagError}</p>}
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-800 mb-1">🌐 Website / Social Media Link</label>
              <input
                type="url"
                value={formData.websiteLink}
                onChange={(e) => handleInputChange('websiteLink', e.target.value)}
                className="block w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg min-h-[44px]"
                placeholder="https://..."
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-800 mb-1">📝 Remarks</label>
              <textarea
                value={formData.remarks}
                onChange={(e) => handleInputChange('remarks', e.target.value)}
                rows={3}
                className="block w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg"
                placeholder="Additional notes..."
              />
            </div>
          </div>
        </div>

        {/* Agency Documents & MOU */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-blue-200">
          <h3 className="text-lg font-bold text-slate-800 mb-3">📄 Agency Documents & MOU (Optional)</h3>
          <p className="text-sm text-slate-600 mb-4">Upload now or add later when editing the lead.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SimpleDocUpload leadId="new-lead" documentType="companyRegistration" documentLabel="Company Registration Proof" currentDocument={agencyDocuments.companyRegistration} onUploadComplete={(doc) => handleDocumentUpload('companyRegistration', doc)} currentUser={currentUser ?? ''} />
            <SimpleDocUpload leadId="new-lead" documentType="panCard" documentLabel="PAN CARD" currentDocument={agencyDocuments.panCard} onUploadComplete={(doc) => handleDocumentUpload('panCard', doc)} currentUser={currentUser ?? ''} />
            <SimpleDocUpload leadId="new-lead" documentType="gstNumber" documentLabel="GST NUMBER" currentDocument={agencyDocuments.gstNumber} onUploadComplete={(doc) => handleDocumentUpload('gstNumber', doc)} currentUser={currentUser ?? ''} />
            <SimpleDocUpload leadId="new-lead" documentType="mou" documentLabel="MOU" currentDocument={agencyDocuments.mou} onUploadComplete={(doc) => handleDocumentUpload('mou', doc)} currentUser={currentUser ?? ''} />
          </div>
        </div>

        {/* Buttons */}
        <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4">
          <button type="button" onClick={onClose} className="px-6 py-2.5 min-h-[44px] text-sm font-bold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 border-2 border-slate-300">
            ❌ Cancel
          </button>
          <button type="submit" disabled={isSubmitting} className={`px-6 py-2.5 min-h-[44px] text-sm font-bold text-white rounded-lg border-2 shadow-lg ${isSubmitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 border-indigo-600'}`}>
            {isSubmitting ? '⏳ Adding Lead...' : '✅ Add Lead'}
          </button>
        </div>
      </form>
    </Modal>
    
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
                    setFormData(prev => ({ ...prev, icpScore: Math.round(average) }));
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
    </>
  );
};
