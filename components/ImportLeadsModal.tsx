import React, { useState } from 'react';
import type { Lead, LeadStatus, AgentCategory, LeadSource } from '../types';
import { LEAD_STATUSES, AGENT_CATEGORIES, LEAD_SOURCES } from '../types';
import * as xlsx from 'xlsx';
import { SpinnerIcon } from './icons/SpinnerIcon';

type ParsedLead = Omit<Lead, 'id' | 'createdAt' | 'followUps'>;

interface ImportLeadsModalProps {
  onClose: () => void;
  onImport: (leads: ParsedLead[]) => void;
}

// Define the Add Lead form fields for mapping (consolidated to remove duplicates)
const ADD_LEAD_FIELDS = [
  { key: 'agencyName', label: 'Agency / Partner Name', required: true },
  { key: 'contactName', label: 'Primary Contact Name', required: false },
  { key: 'phone', label: 'Primary Mobile (International format: +1, +44, +91, etc.)', required: false },
  { key: 'email', label: 'Primary Email', required: false },
  { key: 'alternateMobile', label: 'Alternate Mobile (International format: +1, +44, +91, etc.)', required: false },
  { key: 'pocDesignation', label: 'POC Designation', required: false },
  { key: 'address', label: 'Address', required: false },
  { key: 'city', label: 'City', required: false },
  { key: 'status', label: 'Status', required: false },
  { key: 'agentCategory', label: 'Agent Category', required: false },
  { key: 'leadSource', label: 'Lead Source', required: false },
  { key: 'accountManager', label: 'Account Manager', required: false },
  { key: 'salesPerson', label: 'Sales Person', required: false },
  { key: 'onboardingDate', label: 'Date of Onboarding', required: false },
  { key: 'potentialStudentsCount', label: 'Potential Students Count', required: false },
  { key: 'remarks', label: 'Remarks', required: false }
];

interface ColumnMapping {
  [key: string]: string; // Add Lead field key -> Excel column name
}

const REQUIRED_HEADERS = [
  'Date of Boarding',
  'Agency Name',
  'Primary Contact Email ID',
  'Primary Contact Name',
  'POC Designation',
  'Phone',
  'Address',
  'City',
  'Sales Person',
  'Account Manager',
  'Account Status',
  'Agent Source',
  'Agent Category'
];

export const ImportLeadsModal: React.FC<ImportLeadsModalProps> = ({ onClose, onImport }) => {
  const [parsedLeads, setParsedLeads] = useState<ParsedLead[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showValidationPopup, setShowValidationPopup] = useState(false);
  const [showMappingPopup, setShowMappingPopup] = useState(false);
  const [selectedLeads, setSelectedLeads] = useState<Set<number>>(new Set());
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [rawExcelData, setRawExcelData] = useState<any[]>([]); // Store raw Excel data
  const [validationData, setValidationData] = useState<{
    leads: ParsedLead[];
    existingLeads: any[];
    missingHeaders: string[];
  }>({ leads: [], existingLeads: [], missingHeaders: [] });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);
    setParsedLeads([]);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = xlsx.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = xlsx.utils.sheet_to_json<any>(worksheet, { header: 1 });
        
        console.log('📄 Raw Excel data:', json);
        
        // Convert array format to object format if needed
        let processedData;
        if (json.length > 0 && Array.isArray(json[0])) {
          // Array format - first row is headers
          const headers = json[0] as string[];
          processedData = json.slice(1).map((row: any[]) => {
            const obj: any = {};
            headers.forEach((header, index) => {
              obj[header] = row[index] || '';
            });
            return obj;
          });
        } else {
          // Already in object format
          processedData = json;
        }

        // 🟢 SAFE FIX: Robust empty check
        if (!processedData || processedData.length === 0) {
            throw new Error("The selected file is empty or not formatted correctly.");
        }

        const headers = Object.keys(processedData[0]);
        console.log('📊 Extracted Excel headers:', headers);
        console.log('📊 Processed data sample:', processedData.slice(0, 2));
        setExcelHeaders(headers);
        setRawExcelData(processedData); // Store raw Excel data for later use
        
        // Auto-map common column names
        const autoMapping: ColumnMapping = {};
        ADD_LEAD_FIELDS.forEach(field => {
          const matchingHeader = headers.find(header => 
            header.toLowerCase().includes(field.key.toLowerCase()) ||
            field.key.toLowerCase().includes(header.toLowerCase()) ||
            (field.key === 'agencyName' && header.toLowerCase().includes('agency')) ||
            (field.key === 'contactName' && header.toLowerCase().includes('contact') && header.toLowerCase().includes('name')) ||
            (field.key === 'phone' && header.toLowerCase().includes('phone')) ||
            (field.key === 'email' && header.toLowerCase().includes('email')) ||
            (field.key === 'city' && header.toLowerCase().includes('city')) ||
            (field.key === 'address' && header.toLowerCase().includes('address')) ||
            (field.key === 'status' && header.toLowerCase().includes('status')) ||
            (field.key === 'agentCategory' && header.toLowerCase().includes('category')) ||
            (field.key === 'leadSource' && header.toLowerCase().includes('source')) ||
            (field.key === 'onboardingDate' && (header.toLowerCase().includes('boarding') || header.toLowerCase().includes('onboarding')))
          );
          if (matchingHeader) {
            autoMapping[field.key] = matchingHeader;
          }
        });
        
        setColumnMapping(autoMapping);
        setShowMappingPopup(true);
        
      } catch (err: any) {
        setError(err.message || 'Failed to parse the file.');
      } finally {
        setIsLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };
  
  // Helper function to normalize phone number while preserving international format
  const normalizePhoneNumber = (phone: string | null | undefined): string => {
    if (!phone || phone === 'Not provided' || phone === 'N/A' || phone.trim() === '') {
      return '';
    }
    
    // Trim whitespace
    let normalized = phone.trim();
    
    // Remove any non-phone characters except +, -, spaces, parentheses, and digits
    // But preserve the format for international numbers
    normalized = normalized.replace(/[^\d+\-() ]/g, '');
    
    // If empty after cleaning, return empty string
    if (!normalized || normalized.trim() === '') {
      return '';
    }
    
    // If it starts with +, it's an international number - preserve as-is
    if (normalized.startsWith('+')) {
      // Remove spaces, dashes, and parentheses for consistency, but keep the +
      normalized = normalized.replace(/[\s\-()]/g, '');
      // Ensure there are digits after the +
      if (normalized.length > 1 && /^\+\d+$/.test(normalized)) {
        return normalized;
      }
      // If invalid format, return as-is (might be partially formatted)
      return normalized;
    }
    
    // If it's a long number without +, it might be international without country code prefix
    // Remove spaces, dashes, parentheses for consistency
    normalized = normalized.replace(/[\s\-()]/g, '');
    
    // Only return if there are digits
    if (normalized && /\d+/.test(normalized)) {
      return normalized;
    }
    
    return '';
  };

  const handleDownloadTemplate = () => {
    const headers = [REQUIRED_HEADERS];
    
    // Example data with new 13-column structure - showing international phone formats
    const exampleData = [[
      '15/01/2024',                         // Date of Boarding
      'Global Education Services',          // Agency Name
      'rajesh@ges.com',                     // Primary Contact Email ID
      'Mr. Rajesh Verma',                   // Primary Contact Name
      'Director',                           // POC Designation
      '+91 98765 43210',                    // Phone - International format with country code
      '123 Education Street, Knowledge City', // Address
      'Mumbai',                             // City
      'alice@company.com',                  // Sales Person
      'bob@company.com',                    // Account Manager
      'New',                                // Account Status
      'Website',                            // Agent Source
      'Gold'                                // Agent Category
    ]];
    
    const worksheet = xlsx.utils.aoa_to_sheet([...headers, ...exampleData]);
    
    // Set column widths for better readability
    const columnWidths = [
      { wch: 15 }, // Date of Boarding
      { wch: 25 }, // Agency Name
      { wch: 25 }, // Primary Contact Email ID
      { wch: 20 }, // Primary Contact Name
      { wch: 15 }, // POC Designation
      { wch: 18 }, // Phone - Wider for international numbers
      { wch: 30 }, // Address
      { wch: 15 }, // City
      { wch: 20 }, // Sales Person
      { wch: 20 }, // Account Manager
      { wch: 15 }, // Account Status
      { wch: 15 }, // Agent Source
      { wch: 15 }  // Agent Category
    ];
    worksheet['!cols'] = columnWidths;
    
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Leads Template');
    xlsx.writeFile(workbook, 'Leads_Import_Template.xlsx');
  };

  const handleValidationConfirm = () => {
    const leadsToImport = validationData.leads.filter((_, index) => selectedLeads.has(index));
    console.log('🚀 Importing leads:', leadsToImport.length);
    
    // Directly call the import function
    onImport(leadsToImport);
    
    // Close the modal
    setShowValidationPopup(false);
    setValidationData({ leads: [], existingLeads: [], missingHeaders: [] });
    setSelectedLeads(new Set());
    onClose(); // Close the entire import modal
  };

  const handleValidationCancel = () => {
    setShowValidationPopup(false);
    setValidationData({ leads: [], existingLeads: [], missingHeaders: [] });
    setSelectedLeads(new Set());
  };

  const toggleLeadSelection = (index: number) => {
    const newSelected = new Set(selectedLeads);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedLeads(newSelected);
  };

  const selectAllLeads = () => {
    setSelectedLeads(new Set(validationData.leads.map((_, index) => index)));
  };

  const deselectAllLeads = () => {
    setSelectedLeads(new Set());
  };

  const handleMappingConfirm = () => {
    console.log('🚀 handleMappingConfirm called');
    
    if (rawExcelData.length === 0) {
      setError('No Excel data available. Please upload a file first.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const leads: ParsedLead[] = rawExcelData.map((row, index) => {
          // Use the mapped columns to extract data
          const getValue = (fieldKey: string) => {
            const mappedColumn = columnMapping[fieldKey];
            
            // Handle special options
            if (mappedColumn === '__KEEP_EMPTY__') {
              return ''; // Return empty string
            }
            
            if (mappedColumn === '__DEFAULT__') {
              // Return default values based on field type
              switch (fieldKey) {
                case 'status': return 'New';
                case 'agentCategory': return 'Beginner';
                case 'leadSource': return 'Website';
                case 'phone': return ''; // Empty string instead of default 10-digit number
                case 'email': return 'default@example.com';
                default: return '';
              }
            }
            
            // Regular column mapping - preserve original format for phone numbers
            const value = mappedColumn ? row[mappedColumn]?.toString() : null;
            // For phone numbers, preserve the original format including +, spaces, etc.
            return value ? value.trim() : null;
          };

          const agencyName = getValue('agencyName');
          const contactName = getValue('contactName');
          const phone = getValue('phone');
          const email = getValue('email');
          const status = getValue('status');
          const agentCategory = getValue('agentCategory');
          const leadSource = getValue('leadSource');
          const address = getValue('address');
          const city = getValue('city');
          const pocDesignation = getValue('pocDesignation');
          const alternateMobile = getValue('alternateMobile');
          const accountManager = getValue('accountManager');
          const salesPerson = getValue('salesPerson');
          const onboardingDate = getValue('onboardingDate');
          const potentialStudentsCount = getValue('potentialStudentsCount');
          const remarks = getValue('remarks');

          // Validate and set defaults
          const validStatus = status && LEAD_STATUSES.includes(status as LeadStatus) ? status as LeadStatus : 'New';
          const validAgentCategory = agentCategory && AGENT_CATEGORIES.includes(agentCategory as AgentCategory) ? agentCategory as AgentCategory : 'Beginner';
          const validLeadSource = leadSource && LEAD_SOURCES.includes(leadSource as LeadSource) ? leadSource as LeadSource : 'Website';
          
          // Ensure account manager and sales person are properly formatted
          const validAccountManager = accountManager && accountManager.trim() !== '' ? accountManager.trim() : null;
          const validSalesPerson = salesPerson && salesPerson.trim() !== '' ? salesPerson.trim() : null;

          // Normalize phone numbers while preserving international format
          const normalizedPhone = normalizePhoneNumber(phone);
          const normalizedAlternateMobile = normalizePhoneNumber(alternateMobile);

          // Build lead object with only defined values
          const contactPhone = normalizedPhone || (phone && phone.trim() !== '' && phone.trim() !== 'Not provided' ? phone.trim() : '');

          const leadObj: any = {
            agencyName: agencyName || `Row ${index + 2} - Missing Agency Name`,
            status: validStatus,
            agentCategory: validAgentCategory,
            leadSource: validLeadSource,
            tags: [],
            contacts: [{
              id: `temp-${index}`,
              name: contactName || agencyName || `Contact ${index + 2}`,
              role: 'POC',
              phone: contactPhone || '', // Allow empty phone if not provided
              ...(email && email !== 'Not provided' && email.trim() !== '' && { email: email.trim() }),
              ...(address && address.trim() !== '' && { address: address.trim() }),
              ...(city && city.trim() !== '' && { city: city.trim() }),
              ...(normalizedAlternateMobile && { alternateMobile: normalizedAlternateMobile }),
              ...(pocDesignation && pocDesignation.trim() !== '' && { pocDesignation: pocDesignation.trim() }),
            }]
          };

          // Only add optional fields if they have valid values
          if (validAccountManager) leadObj.accountManager = validAccountManager;
          if (validSalesPerson) leadObj.salesPerson = validSalesPerson;
          
          // Process onboarding date - convert Excel date to proper format
          // 🟢 SAFE FIX: Robust Date Parsing for Excel serials
          if (onboardingDate && onboardingDate.trim() !== '') {
            try {
              let dateValue = onboardingDate.trim();
              
              if (!isNaN(Number(dateValue))) {
                // Excel serial date (e.g., 44927)
                const excelDate = new Date((Number(dateValue) - 25569) * 86400 * 1000);
                if (!isNaN(excelDate.getTime())) {
                  dateValue = excelDate.toISOString().split('T')[0];
                }
              } else {
                // Standard date string
                const parsedDate = new Date(dateValue);
                if (!isNaN(parsedDate.getTime())) {
                  dateValue = parsedDate.toISOString().split('T')[0];
                }
              }
              
              leadObj.onboardingDate = dateValue;
            } catch (error) {
              console.warn('⚠️ Failed to parse onboarding date:', onboardingDate, error);
              leadObj.onboardingDate = onboardingDate.trim();
            }
          }
          
          if (potentialStudentsCount && potentialStudentsCount.trim() !== '') leadObj.applicants = potentialStudentsCount.trim();
          if (remarks && remarks.trim() !== '') leadObj.remarks = remarks.trim();

          return leadObj;
        });
        
        console.log('✅ Successfully processed', leads.length, 'leads');
        
        // Show validation popup
        setValidationData({ leads, existingLeads: [], missingHeaders: [] });
        setSelectedLeads(new Set(leads.map((_, index) => index)));
        setShowMappingPopup(false);
        setShowValidationPopup(true);
        
      } catch (err: any) {
        console.error('❌ Error in handleMappingConfirm:', err);
        setError(err.message || 'Failed to parse the file with mapping.');
      } finally {
        setIsLoading(false);
      }
  };

  const handleMappingCancel = () => {
    setShowMappingPopup(false);
    setExcelHeaders([]);
    setColumnMapping({});
    setRawExcelData([]);
  };


  return (
    <>
      {/* Column Mapping Popup */}
      {showMappingPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70]">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-slate-900">Map Excel Columns to Add Lead Fields</h3>
                <button
                  onClick={handleMappingCancel}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-sm text-slate-600 mt-2">
                Map the columns from your Excel file to the Add Lead form fields. Required fields are marked with *.
              </p>
              <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-xs text-blue-700">
                  <strong>📞 Phone Number Format:</strong> International phone numbers are supported. 
                  You can use formats like +1 234 567 8900, +44 20 1234 5678, +91 98765 43210, etc. 
                  Country codes (starting with +) are preserved during import.
                </p>
              </div>
              <div className="text-xs text-slate-500 mt-2">
                📊 Excel rows: {rawExcelData.length} | 🗺️ Mapped fields: {Object.keys(columnMapping).length} | 📋 Available headers: {excelHeaders.length}
              </div>
              {excelHeaders.length === 0 && (
                <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-700">
                    ⚠️ No Excel headers detected. Please ensure your Excel file has headers in the first row.
                  </p>
                </div>
              )}
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="space-y-4">
                {ADD_LEAD_FIELDS.map(field => (
                  <div key={field.key} className="flex items-center gap-4">
                    <div className="w-1/3">
                      <label className="block text-sm font-medium text-slate-700">
                        {field.label}
                        {field.required && <span className="text-red-500 ml-1">*</span>}
                      </label>
                    </div>
                    <div className="w-2/3">
                      <select
                        value={columnMapping[field.key] || ''}
                        onChange={(e) => setColumnMapping(prev => ({
                          ...prev,
                          [field.key]: e.target.value
                        }))}
                        className="w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                      >
                        <option value="">-- Select Excel Column --</option>
                        <option value="__KEEP_EMPTY__">🔲 Keep Empty</option>
                        <option value="__DEFAULT__">⚙️ Use Default Value</option>
                        {excelHeaders.map(header => (
                          <option key={header} value={header}>{header}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-200 bg-slate-50">
              <div className="flex justify-between items-center">
                <div className="text-sm text-slate-600">
                  Map your Excel columns to the Add Lead form fields
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleMappingCancel}
                    className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleMappingConfirm}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700"
                  >
                    Continue to Review
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Validation Popup */}
      {showValidationPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-slate-900">Review Import Data</h3>
                <button
                  onClick={handleValidationCancel}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-sm text-slate-600 mt-2">
                Review and select which leads to import. Uncheck any leads you don't want to import.
              </p>
              <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-sm text-blue-700">
                  <strong>Note:</strong> Rows with missing critical data (like Agency Name) will show placeholder text. 
                  You can edit these after importing or uncheck them if the data is incomplete.
                </p>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {/* Selection Controls */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={selectAllLeads}
                  className="px-3 py-1 text-sm bg-indigo-100 text-indigo-700 rounded-md hover:bg-indigo-200"
                >
                  Select All ({validationData.leads.length})
                </button>
                <button
                  onClick={deselectAllLeads}
                  className="px-3 py-1 text-sm bg-slate-100 text-slate-700 rounded-md hover:bg-slate-200"
                >
                  Deselect All
                </button>
                <span className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded-md">
                  Selected: {selectedLeads.size}
                </span>
              </div>

              {/* Leads Table */}
              <div className="overflow-x-auto">
                <table className="min-w-full border border-slate-200 rounded-lg">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider border-b border-slate-200">
                        <input
                          type="checkbox"
                          checked={selectedLeads.size === validationData.leads.length && validationData.leads.length > 0}
                          onChange={(e) => e.target.checked ? selectAllLeads() : deselectAllLeads()}
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider border-b border-slate-200">
                        Agency Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider border-b border-slate-200">
                        Primary Contact Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider border-b border-slate-200">
                        Phone
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider border-b border-slate-200">
                        Email ID
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider border-b border-slate-200">
                        Account Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider border-b border-slate-200">
                        Agent Category
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider border-b border-slate-200">
                        Agent Source
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {validationData.leads.map((lead, index) => {
                      const safeContact = (Array.isArray(lead.contacts) ? lead.contacts : [])[0] || {};
                      
                      const hasMissingData = lead.agencyName.includes('Missing Agency Name') || 
                                             safeContact.phone === 'Not provided' || 
                                             safeContact.email === 'Not provided';
                      return (
                      <tr key={index} className={`${selectedLeads.has(index) ? 'bg-blue-50' : 'hover:bg-slate-50'} ${hasMissingData ? 'border-l-4 border-orange-400' : ''}`}>
                        <td className="px-4 py-3 border-b border-slate-200">
                          <input
                            type="checkbox"
                            checked={selectedLeads.has(index)}
                            onChange={() => toggleLeadSelection(index)}
                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                          />
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-900 border-b border-slate-200">
                          {lead.agencyName}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-900 border-b border-slate-200">
                          {safeContact.name || 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-900 border-b border-slate-200">
                          {safeContact.phone || 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-900 border-b border-slate-200">
                          {safeContact.email || 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-900 border-b border-slate-200">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            lead.status === 'New' ? 'bg-blue-100 text-blue-800' :
                            lead.status === 'In Pipeline' ? 'bg-amber-100 text-amber-800' :
                            lead.status === 'Onboarded' ? 'bg-green-100 text-green-800' :
                            'bg-slate-100 text-slate-800'
                          }`}>
                            {lead.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-900 border-b border-slate-200">
                          {lead.agentCategory || 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-900 border-b border-slate-200">
                          {lead.leadSource || 'N/A'}
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-200 bg-slate-50">
              <div className="flex justify-between items-center">
                <div className="text-sm text-slate-600">
                  {selectedLeads.size} of {validationData.leads.length} leads selected for import
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleValidationCancel}
                    className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleValidationConfirm}
                    disabled={selectedLeads.size === 0}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
                  >
                    Import {selectedLeads.size} Leads
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    {/* Main Import Modal - Only show when other popups are not open */}
    {!showValidationPopup && !showMappingPopup && (
      <div className="fixed inset-0 bg-black/60 z-40 flex justify-center items-center p-2 sm:p-4" aria-modal="true" role="dialog">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-5xl max-h-[95vh] sm:max-h-[90vh] flex flex-col border border-blue-200">
          <header className="flex items-center justify-between p-3 sm:p-4 border-b-2 border-blue-200 flex-shrink-0 bg-white rounded-t-xl">
            <h2 className="text-lg sm:text-xl font-bold text-slate-800 truncate pr-2 flex items-center gap-2">
              📊 Import Leads from Excel
            </h2>
            <button 
              onClick={onClose} 
              className="text-slate-500 hover:text-slate-800 p-1 -m-1 flex-shrink-0 rounded-lg hover:bg-slate-100 transition-colors" 
              aria-label="Close modal"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </header>
          <div className="overflow-y-auto p-3 sm:p-4 flex-1">
            <div className="space-y-4">
              {/* Import Button at Top */}
              <div className="bg-white p-4 rounded-lg shadow-sm border border-blue-200">
                <div className="flex justify-center">
                  <button
                    onClick={() => document.getElementById('file-upload')?.click()}
                    className="px-6 py-3 text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-blue-600 rounded-lg hover:from-indigo-700 hover:to-blue-700 border-2 border-indigo-600 shadow-lg transition-all transform hover:scale-105"
                  >
                    📁 Choose Excel File to Import
                  </button>
                </div>
              </div>
              
              <div className="bg-white p-4 rounded-lg shadow-sm border border-blue-200 text-center">
                  <p className="text-sm text-slate-700 mb-3">📋 Download the template, fill it out, and upload it here.</p>
                  <button 
                    onClick={handleDownloadTemplate} 
                    className="px-4 py-2 text-sm font-bold text-white bg-gradient-to-r from-green-600 to-emerald-600 rounded-lg hover:from-green-700 hover:to-emerald-700 border-2 border-green-600 shadow-lg transition-all transform hover:scale-105"
                  >
                      📥 Download Template.xlsx
                  </button>
        </div>
        <div>
          <label htmlFor="file-upload" className="block text-sm font-medium text-slate-700">Upload File</label>
          <input 
            id="file-upload"
            type="file"
            accept=".xlsx, .xls"
            onChange={handleFileChange}
            className="mt-1 block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
          />
        </div>
        {isLoading && <div className="flex justify-center items-center gap-2 text-slate-600"><SpinnerIcon className="animate-spin h-5 w-5" /> Parsing file...</div>}
        {error && <div className="p-3 bg-red-100 text-red-700 text-sm rounded-md">{error}</div>}
        {parsedLeads.length > 0 && (
          <div>
                  <h3 className="font-semibold text-blue-800 mb-2">Preview ({parsedLeads.length} leads found)</h3>
            <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-md">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Agency Name</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Contact</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Phone</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Category</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {parsedLeads.slice(0, 10).map((lead, i) => ( // Preview first 10
                    <tr key={i}>
                      <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-slate-900">{lead.agencyName}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-slate-500">{(Array.isArray(lead.contacts) ? lead.contacts : [])[0]?.name}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-slate-500">{(Array.isArray(lead.contacts) ? lead.contacts : [])[0]?.phone}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-slate-500">{lead.status}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-slate-500">{lead.agentCategory}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsedLeads.length > 10 && <p className="text-center text-xs text-slate-500 p-2 bg-slate-50">...and {parsedLeads.length - 10} more</p>}
            </div>
          </div>
        )}
         <div className="flex justify-end gap-3 pt-4">
                  <button 
                    type="button" 
                    onClick={onClose} 
                    className="px-6 py-2 text-sm font-bold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 border-2 border-slate-300 transition-colors"
                  >
                    ❌ Cancel
                  </button>
                  <button 
                    type="button" 
                    onClick={() => onImport(parsedLeads)} 
                    disabled={parsedLeads.length === 0} 
                    className="px-6 py-2 text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-blue-600 rounded-lg hover:from-indigo-700 hover:to-blue-700 border-2 border-indigo-600 shadow-lg transition-all transform hover:scale-105 disabled:bg-indigo-300 disabled:transform-none disabled:shadow-none"
                  >
                    ✅ Import Leads
                  </button>
                </div>
            </div>
          </div>
          </div>
      </div>
    )}
    </>
  );
};