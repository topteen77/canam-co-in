import React, { useState, useEffect, useMemo } from 'react';
import type { Contact } from '../types';
import { Modal } from './Modal';
import { CONTACT_COUNTRY_OPTIONS, getCityOptionsForCountry } from '../utils/countriesAndCities';

interface ContactEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  contact?: Contact | null;
  onSave: (contact: Contact) => void;
  mode: 'add' | 'edit';
}

export const ContactEditModal: React.FC<ContactEditModalProps> = ({
  isOpen,
  onClose,
  contact,
  onSave,
  mode
}) => {
  // 🟢 SAFE FIX: Initialize with empty strings to ensure controlled inputs
  const [formData, setFormData] = useState<Contact>({
    id: '',
    name: '',
    role: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    state: '',
    country: '',
    alternateMobile: '',
    pocName: '',
    pocDesignation: ''
  });

  useEffect(() => {
    if (contact && mode === 'edit') {
      // 🟢 SAFE FIX: Map fields individually to handle missing/null data gracefully
      setFormData({
        id: contact.id || '',
        name: contact.name || '',
        role: contact.role || '',
        phone: contact.phone || '',
        email: contact.email || '',
        address: contact.address || '',
        city: contact.city || '',
        state: contact.state || '',
        country: contact.country || '',
        alternateMobile: contact.alternateMobile || '',
        pocName: contact.pocName || '',
        pocDesignation: contact.pocDesignation || ''
      });
    } else {
      // Reset for add mode
      setFormData({
        id: '',
        name: '',
        role: '',
        phone: '',
        email: '',
        address: '',
        city: '',
        state: '',
        country: '',
        alternateMobile: '',
        pocName: '',
        pocDesignation: ''
      });
    }
  }, [contact, mode, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.name.trim()) {
      alert('Please enter the contact name');
      return;
    }
    
    if (!formData.phone.trim()) {
      alert('Please enter the phone number');
      return;
    }

    // Generate ID if adding new contact or ensure ID exists for edit
    const contactToSave = {
      ...formData,
      id: (mode === 'add' || !formData.id) ? `contact_${Date.now()}` : formData.id
    };

    onSave(contactToSave);
    onClose();
  };

  const handleInputChange = (field: keyof Contact, value: string) => {
    setFormData(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'country') {
        const cityOptions = getCityOptionsForCountry(value, prev.city);
        if (prev.city && !cityOptions.includes(prev.city)) next.city = '';
      }
      return next;
    });
  };

  const cityOptions = useMemo(
    () => getCityOptionsForCountry(formData.country || '', formData.city),
    [formData.country, formData.city]
  );

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={`${mode === 'add' ? 'Add' : 'Edit'} Contact`}
      maxWidth="max-w-2xl"
    >
      <div className="w-full max-w-2xl mx-auto bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Basic Information */}
          <div className="bg-white p-4 rounded-lg shadow-sm border border-blue-200">
            <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
              📋 Basic Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1">👤 Name *</label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="block w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 bg-white text-slate-800"
                  placeholder="Enter contact name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1">💼 Role/Designation</label>
                <input
                  type="text"
                  value={formData.role || ''}
                  onChange={(e) => handleInputChange('role', e.target.value)}
                  className="block w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 bg-white text-slate-800"
                  placeholder="e.g., Director, Counselor, POC"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1">📞 Phone *</label>
                <input
                  type="tel"
                  value={formData.phone || ''}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  className="block w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 bg-white text-slate-800"
                  placeholder="Enter phone number"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1">📧 Email</label>
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="block w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 bg-white text-slate-800"
                  placeholder="Enter email address"
                />
              </div>
            </div>
          </div>

          {/* Location Information */}
          <div className="bg-white p-4 rounded-lg shadow-sm border border-blue-200">
            <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
              📍 Location Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-slate-800 mb-1">🌍 Country</label>
                <select
                  value={formData.country || ''}
                  onChange={(e) => handleInputChange('country', e.target.value)}
                  className="block w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 bg-white text-slate-800"
                >
                  <option value="">Select country</option>
                  {CONTACT_COUNTRY_OPTIONS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1">🏙️ City</label>
                <select
                  value={formData.city || ''}
                  onChange={(e) => handleInputChange('city', e.target.value)}
                  className="block w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 bg-white text-slate-800"
                  disabled={!formData.country || formData.country === 'Other'}
                >
                  <option value="">
                    {formData.country === 'Other' ? 'Type in address' : 'Select city'}
                  </option>
                  {cityOptions.map((city) => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
                {formData.country === 'Other' && (
                  <input
                    type="text"
                    value={formData.city || ''}
                    onChange={(e) => handleInputChange('city', e.target.value)}
                    className="mt-1 block w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 bg-white text-slate-800"
                    placeholder="Enter city name"
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1">🏛️ State</label>
                <input
                  type="text"
                  value={formData.state || ''}
                  onChange={(e) => handleInputChange('state', e.target.value)}
                  className="block w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 bg-white text-slate-800"
                  placeholder="Enter state"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-slate-800 mb-1">🏠 Address</label>
                <textarea
                  value={formData.address || ''}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  rows={2}
                  className="block w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 bg-white text-slate-800"
                  placeholder="Enter full address"
                />
              </div>
            </div>
          </div>

          {/* Alternate Contact Details */}
          <div className="bg-white p-4 rounded-lg shadow-sm border border-blue-200">
            <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
              🔄 Alternate Contact Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1">📱 Alternate Mobile</label>
                <input
                  type="tel"
                  value={formData.alternateMobile || ''}
                  onChange={(e) => handleInputChange('alternateMobile', e.target.value)}
                  className="block w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 bg-white text-slate-800"
                  placeholder="Enter alternate mobile number"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1">👤 POC Name</label>
                <input
                  type="text"
                  value={formData.pocName || ''}
                  onChange={(e) => handleInputChange('pocName', e.target.value)}
                  className="block w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 bg-white text-slate-800"
                  placeholder="Enter POC name"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-slate-800 mb-1">💼 POC Designation</label>
                <input
                  type="text"
                  value={formData.pocDesignation || ''}
                  onChange={(e) => handleInputChange('pocDesignation', e.target.value)}
                  className="block w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 bg-white text-slate-800"
                  placeholder="Enter POC designation"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 text-sm font-bold text-slate-600 bg-white border-2 border-slate-300 rounded-lg hover:bg-slate-50 transition-all"
            >
              ❌ Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-blue-600 rounded-lg hover:from-indigo-700 hover:to-blue-700 border-2 border-indigo-600 shadow-lg transition-all transform hover:scale-105"
            >
              ✅ {mode === 'add' ? 'Add Contact' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};