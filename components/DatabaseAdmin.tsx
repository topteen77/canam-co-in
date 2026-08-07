import React, { useEffect, useState } from 'react';
import apiClient from '../services/apiClient';
import { DeduplicationService } from '../services/deduplicationService';
import { LeadImportHistory } from './LeadImportHistory';

interface FieldConfig {
  id: string;
  displayName: string;
  fieldType: 'text' | 'select' | 'date' | 'email' | 'phone';
  options?: string[];
  required: boolean;
  category: 'lead' | 'contact' | 'followup' | 'onboarding';
}

const defaultFields: FieldConfig[] = [
  // Lead fields
  { id: 'agencyName', displayName: 'Agency / Partner Name', fieldType: 'text', required: true, category: 'lead' },
  { id: 'status', displayName: 'Status', fieldType: 'select', options: ['New', 'In Pipeline', 'ICP Qualified', 'Portal Deactivated', 'Onboarded', 'Lost', 'MOU Signature Pending', 'Agent Portal Created', 'Agent Portal Reactivated'], required: true, category: 'lead' },
  { id: 'agentCategory', displayName: 'Agent Category', fieldType: 'select', options: ['Platinum', 'Diamond', 'Gold', 'Silver', 'Bronze', 'Beginner'], required: true, category: 'lead' },
  { id: 'accountManager', displayName: 'Account Manager', fieldType: 'text', required: false, category: 'lead' },
  { id: 'tags', displayName: 'Tags', fieldType: 'text', required: false, category: 'lead' },
  
  // Contact fields
  { id: 'contactName', displayName: 'Contact Name', fieldType: 'text', required: true, category: 'contact' },
  { id: 'contactRole', displayName: 'Contact Role', fieldType: 'text', required: false, category: 'contact' },
  { id: 'phone', displayName: 'Phone', fieldType: 'phone', required: true, category: 'contact' },
  { id: 'email', displayName: 'Email', fieldType: 'email', required: false, category: 'contact' },
  { id: 'city', displayName: 'City', fieldType: 'text', required: false, category: 'contact' },
  { id: 'country', displayName: 'Country', fieldType: 'text', required: false, category: 'contact' },
  
  // Follow-up fields
  { id: 'followUpType', displayName: 'Follow-up Type', fieldType: 'select', options: ['Call', 'Meeting', 'Email', 'New Assessment', 'Assessment Follow-up', 'WhatsApp'], required: true, category: 'followup' },
  { id: 'followUpStatus', displayName: 'Follow-up Status', fieldType: 'select', options: ['Planned', 'Done', 'Cancelled'], required: true, category: 'followup' },
  { id: 'followUpDate', displayName: 'Follow-up Date', fieldType: 'date', required: true, category: 'followup' },
  { id: 'followUpNotes', displayName: 'Follow-up Notes', fieldType: 'text', required: false, category: 'followup' },
  
  // Onboarding fields
  { id: 'onboardingStep', displayName: 'Onboarding Step', fieldType: 'select', options: ['Docs Submitted', 'Agreement Signed', 'Training', 'Live'], required: true, category: 'onboarding' },
  { id: 'onboardingStatus', displayName: 'Onboarding Status', fieldType: 'select', options: ['Pending', 'Completed'], required: true, category: 'onboarding' },
  { id: 'onboardingDate', displayName: 'Completed Date', fieldType: 'date', required: false, category: 'onboarding' },
  { id: 'onboardingRemarks', displayName: 'Onboarding Remarks', fieldType: 'text', required: false, category: 'onboarding' },
];

export const DatabaseAdmin: React.FC = () => {
  const [fields, setFields] = useState<FieldConfig[]>(defaultFields);
  const [loading, setLoading] = useState(true);

  const createAdminUserDirect = async () => {
    try {
      await apiClient.post('/users', {
        email: 'grewalsohrab04@gmail.com',
        name: 'Grewal Sohrab',
        role: 'Admin',
        status: 'Active',
      });
      const pwd = (await apiClient.post('/password/set-default', {
        userId: 'grewalsohrab04@gmail.com',
        userData: { email: 'grewalsohrab04@gmail.com', name: 'Grewal Sohrab' },
      }))?.data?.defaultPassword;
      alert(`✅ Admin user grewalsohrab04@gmail.com created and approved via Database Admin!\n\nLogin: grewalsohrab04@gmail.com\nPassword: ${pwd || 'grewalsohrab2024!'}\n\n✅ User is active and can login.`);
      window.location.reload();
    } catch (error: any) {
      alert('❌ Error creating admin user: ' + (error?.response?.data?.message || error?.message));
    }
  };
  const [error, setError] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<FieldConfig | null>(null);
  
  // Deduplication state
  const [duplicateReport, setDuplicateReport] = useState<{
    totalLeads: number;
    duplicateGroups: number;
    totalDuplicates: number;
    duplicates: any[];
  } | null>(null);
  const [isScanningDuplicates, setIsScanningDuplicates] = useState(false);
  const [isRemovingDuplicates, setIsRemovingDuplicates] = useState(false);
  const [removalProgress, setRemovalProgress] = useState<{
    processed: number;
    total: number;
    current: string;
  } | null>(null);

  const loadFieldConfigs = async () => {
    try {
      const { data } = await apiClient.get('/field-configs');
      const rows = Array.isArray(data) ? data : [];
      if (rows.length === 0) {
        for (const field of defaultFields) {
          await apiClient.post('/field-configs', field);
        }
        setFields(defaultFields);
      } else {
        const list: FieldConfig[] = rows.map((row: any) => ({
          id: row.id ?? row.firebase_id ?? row.field_id ?? '',
          displayName: row.display_name ?? row.displayName ?? '',
          fieldType: row.field_type ?? row.fieldType ?? 'text',
          options: row.options ?? [],
          required: !!row.required,
          category: row.category ?? 'lead',
        }));
        setFields(list);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load field configs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFieldConfigs();
  }, []);

  const updateField = async (field: FieldConfig) => {
    setError(null);
    try {
      await apiClient.put('/field-configs/' + field.id, field);
      setEditingField(null);
      loadFieldConfigs();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message);
    }
  };

  const addOption = (field: FieldConfig, option: string) => {
    if (!field.options) field.options = [];
    if (!field.options.includes(option)) {
      field.options.push(option);
      updateField(field);
    }
  };

  const removeOption = (field: FieldConfig, option: string) => {
    if (field.options) {
      field.options = field.options.filter(o => o !== option);
      updateField(field);
    }
  };

  // Deduplication functions
  const handleScanDuplicates = async () => {
    try {
      setIsScanningDuplicates(true);
      setError(null);
      console.log('🔍 Starting duplicate scan...');
      
      const report = await DeduplicationService.getDuplicateReport();
      setDuplicateReport(report);
      
      console.log('📊 Duplicate scan complete:', report);
      alert(`Duplicate scan complete!\n\nTotal Leads: ${report.totalLeads}\nDuplicate Groups: ${report.duplicateGroups}\nTotal Duplicates: ${report.totalDuplicates}`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to scan for duplicates';
      setError(errorMsg);
      console.error('❌ Duplicate scan failed:', err);
      alert(`Failed to scan for duplicates: ${errorMsg}`);
    } finally {
      setIsScanningDuplicates(false);
    }
  };

  const handleRemoveDuplicates = async () => {
    if (!duplicateReport || duplicateReport.duplicateGroups === 0) {
      alert('No duplicates found to remove. Please scan for duplicates first.');
      return;
    }

    const confirmMessage = `Are you sure you want to remove ${duplicateReport.totalDuplicates} duplicate leads?\n\nThis will keep the oldest lead from each duplicate group and remove the rest.\n\nThis action cannot be undone!`;
    
    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      setIsRemovingDuplicates(true);
      setError(null);
      setRemovalProgress(null);
      console.log('🗑️ Starting fast duplicate removal...');
      
      const duplicates = await DeduplicationService.findDuplicates();
      
      // Use the new fast removal with progress tracking
      const result = await DeduplicationService.removeDuplicates(duplicates, (progress) => {
        setRemovalProgress(progress);
        console.log(`📊 Progress: ${progress.processed}/${progress.total} - ${progress.current}`);
      });
      
      console.log('📊 Fast duplicate removal complete:', result);
      
      if (result.errors.length > 0) {
        alert(`Duplicate removal completed with some errors:\n\nRemoved: ${result.removed} leads\nErrors: ${result.errors.length}\n\nFirst few errors:\n${result.errors.slice(0, 3).join('\n')}`);
      } else {
        alert(`✅ Successfully removed ${result.removed} duplicate leads!\n\nThe system has been cleaned up and duplicates have been removed.`);
      }
      
      // Refresh the duplicate report
      await handleScanDuplicates();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to remove duplicates';
      setError(errorMsg);
      console.error('❌ Duplicate removal failed:', err);
      alert(`Failed to remove duplicates: ${errorMsg}`);
    } finally {
      setIsRemovingDuplicates(false);
      setRemovalProgress(null);
    }
  };

  const handleFixDeactivatedLeads = async () => {
    try {
      setIsRemovingDuplicates(true); // Reuse the loading state
      setError(null);

      console.log('🔍 Analyzing leads to determine correct statuses...');
      
      const { data: allLeadsRows } = await apiClient.get('/leads/all');
      const allLeads = Array.isArray(allLeadsRows) ? allLeadsRows : [];
      console.log(`📊 Found ${allLeads.length} total leads`);

      const deactivatedLeads = allLeads.filter((l: any) => (l.status ?? l.Status) === 'Portal Deactivated').map((l: any) => ({ id: l.id ?? l.firebase_id, ...l }));
      
      console.log(`⚠️  Found ${deactivatedLeads.length} leads with "Portal Deactivated" status`);

      if (deactivatedLeads.length === 0) {
        alert('✅ All leads have correct status! No fixes needed.');
        setIsRemovingDuplicates(false);
        return;
      }

      const statusCounts: { [key: string]: number } = {};
      allLeads.forEach((l: any) => {
        const status = (l.status ?? l.Status) || 'New';
        if (status !== 'Portal Deactivated') {
          statusCounts[status] = (statusCounts[status] || 0) + 1;
        }
      });

      // Find most common status
      const mostCommonStatus = Object.entries(statusCounts)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'Onboarded';

      console.log(`📊 Most common status in database: ${mostCommonStatus}`);

      const confirmed = confirm(
        `Found ${deactivatedLeads.length} leads with "Portal Deactivated" status.\n\n` +
        `The most common status in your database is "${mostCommonStatus}".\n\n` +
        `Do you want to restore them to "${mostCommonStatus}" status?\n\n` +
        `(This is likely their original status before the import bug.)\n\n` +
        `Click OK to proceed, or Cancel to abort.`
      );

      if (!confirmed) {
        console.log('❌ Operation cancelled by user');
        setIsRemovingDuplicates(false);
        return;
      }

      console.log('🔄 Starting batch update...');
      for (const lead of deactivatedLeads) {
        const id = lead.id ?? lead.firebase_id;
        if (id) await apiClient.put('/leads/update/' + id, { status: mostCommonStatus, updatedAt: new Date().toISOString() });
      }

      console.log(`✅ Successfully updated ${deactivatedLeads.length} leads!`);
      alert(`✅ Successfully fixed ${deactivatedLeads.length} leads!\n\nAll "Portal Deactivated" leads have been restored to "${mostCommonStatus}" status.`);
      
      window.location.reload();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fix deactivated leads';
      setError(errorMsg);
      console.error('❌ Fix failed:', err);
      alert(`Failed to fix deactivated leads: ${errorMsg}`);
    } finally {
      setIsRemovingDuplicates(false);
    }
  };

  // New function to find and remove Oct 31 duplicate leads
  const handleRemoveOct31Duplicates = async () => {
    try {
      setIsRemovingDuplicates(true);
      setError(null);

      console.log('🔍 Finding duplicate leads created on Oct 31, 2024...');
      
      const { data: allLeadsRows } = await apiClient.get('/leads/all');
      const allLeadsSnapshot = Array.isArray(allLeadsRows) ? allLeadsRows : [];
      console.log(`📊 Found ${allLeadsSnapshot.length} total leads`);

      // Define Oct 31, 2024 date range
      const oct31Start = new Date('2024-10-31T00:00:00.000Z');
      const oct31End = new Date('2024-10-31T23:59:59.999Z');

      const oct31Leads = allLeadsSnapshot
        .filter((l: any) => {
          const createdAt = l.createdAt ?? l.created_at;
          if (!createdAt) return false;
          const createdDate = new Date(createdAt);
          if (isNaN(createdDate.getTime())) return false;
          return createdDate >= oct31Start && createdDate <= oct31End && (l.createdBy ?? l.created_by) === 'Rakesh';
        })
        .map((l: any) => ({ id: l.id ?? l.firebase_id, ...l }));

      console.log(`📅 Found ${oct31Leads.length} leads created by Rakesh on Oct 31, 2024`);

      if (oct31Leads.length === 0) {
        alert('✅ No leads found created on Oct 31, 2024 by Rakesh! No duplicates to remove.');
        setIsRemovingDuplicates(false);
        return;
      }

      // Group leads by phone number to identify duplicates
      const leadsByPhone = new Map<string, any[]>();
      oct31Leads.forEach(lead => {
        // 🟢 SAFE FIX: Safe contact access
        const safeContacts = Array.isArray(lead.contacts) ? lead.contacts : [];
        const phone = safeContacts[0]?.phone?.replace(/\D/g, '') || '';
        
        if (phone && phone.length >= 10) {
          if (!leadsByPhone.has(phone)) {
            leadsByPhone.set(phone, []);
          }
          leadsByPhone.get(phone)!.push(lead);
        }
      });

      // Find phones with multiple leads (duplicates)
      const duplicateGroups = Array.from(leadsByPhone.entries())
        .filter(([_, leads]) => leads.length > 1);

      console.log(`🔄 Found ${duplicateGroups.length} duplicate groups`);

      if (duplicateGroups.length === 0) {
        alert('✅ No duplicates found! All Oct 31 leads appear to be unique.');
        setIsRemovingDuplicates(false);
        return;
      }

      // Count total duplicates to remove (keeping only the first one from each group)
      const totalDuplicatesToRemove = duplicateGroups.reduce((sum, [_, leads]) => sum + leads.length - 1, 0);

      const confirmMessage = `Found ${duplicateGroups.length} duplicate groups with ${totalDuplicatesToRemove} duplicate leads created on Oct 31, 2024 by Rakesh.\n\nThis will keep the first lead from each duplicate group and remove the rest.\n\n⚠️ This action cannot be undone!\n\nClick OK to proceed, or Cancel to abort.`;
      
      if (!confirm(confirmMessage)) {
        console.log('❌ Operation cancelled by user');
        setIsRemovingDuplicates(false);
        return;
      }

      console.log('🗑️ Starting batch deletion of duplicates...');
      for (const [_phone, leads] of duplicateGroups) {
        for (let i = 1; i < leads.length; i++) {
          const id = leads[i].id ?? leads[i].firebase_id;
          if (id) await apiClient.delete('/leads/delete/' + id);
        }
      }

      console.log(`✅ Successfully removed ${totalDuplicatesToRemove} duplicate leads!`);
      alert(`✅ Successfully removed ${totalDuplicatesToRemove} duplicate leads!\n\nAll Oct 31 duplicates have been cleaned up.`);
      
      window.location.reload();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to remove Oct 31 duplicates';
      setError(errorMsg);
      console.error('❌ Fix failed:', err);
      alert(`Failed to remove Oct 31 duplicates: ${errorMsg}`);
    } finally {
      setIsRemovingDuplicates(false);
    }
  };

  const categories = ['lead', 'contact', 'followup', 'onboarding'];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Admin • Database & Field Names</h2>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Emergency Admin User Creation */}
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-red-900 mb-3">🚨 Emergency Admin User Creation</h3>
        <p className="text-sm text-red-700 mb-4">If grewalsohrab04@gmail.com is not showing in User Management, create it directly here:</p>
        <button
          onClick={createAdminUserDirect}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          👑 Create Admin User (grewalsohrab04@gmail.com)
        </button>
      </div>

      {/* Firebase Console Links Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-blue-900 mb-3">🔗 Firebase Console Links</h3>
        <p className="text-sm text-blue-700 mb-4">Click on any collection below to view and manage data directly in Firebase Console:</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <a 
            href="https://console.firebase.google.com/project/agent-follow-up-crm/firestore/data/~2FUsers" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-3 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
          >
            <span className="text-lg">👥</span>
            <div>
              <div className="font-medium text-slate-900">Users</div>
              <div className="text-xs text-slate-500">User accounts & roles</div>
            </div>
          </a>

          <a 
            href="https://console.firebase.google.com/project/agent-follow-up-crm/firestore/data/~2FLeads" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-3 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
          >
            <span className="text-lg">🏢</span>
            <div>
              <div className="font-medium text-slate-900">Leads</div>
              <div className="text-xs text-slate-500">Main CRM data</div>
            </div>
          </a>

          <a 
            href="https://console.firebase.google.com/project/agent-follow-up-crm/firestore/data/~2FAttendanceRecords" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-3 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
          >
            <span className="text-lg">⏰</span>
            <div>
              <div className="font-medium text-slate-900">Attendance</div>
              <div className="text-xs text-slate-500">Daily check-ins</div>
            </div>
          </a>

          <a 
            href="https://console.firebase.google.com/project/agent-follow-up-crm/firestore/data/~2FMeetingCheckInRecords" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-3 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
          >
            <span className="text-lg">📅</span>
            <div>
              <div className="font-medium text-slate-900">Meeting Check-ins</div>
              <div className="text-xs text-slate-500">Meeting data</div>
            </div>
          </a>

          <a 
            href="https://console.firebase.google.com/project/agent-follow-up-crm/firestore/data/~2FFieldConfigs" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-3 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
          >
            <span className="text-lg">⚙️</span>
            <div>
              <div className="font-medium text-slate-900">Field Configs</div>
              <div className="text-xs text-slate-500">Database settings</div>
            </div>
          </a>

          <a 
            href="https://console.firebase.google.com/project/agent-follow-up-crm/firestore/data/~2FPartners" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-3 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
          >
            <span className="text-lg">🤝</span>
            <div>
              <div className="font-medium text-slate-900">Partners</div>
              <div className="text-xs text-slate-500">Partner information</div>
            </div>
          </a>

          <a 
            href="https://console.firebase.google.com/project/agent-follow-up-crm/firestore/data/~2FContacts" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-3 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
          >
            <span className="text-lg">📞</span>
            <div>
              <div className="font-medium text-slate-900">Contacts</div>
              <div className="text-xs text-slate-500">Contact information</div>
            </div>
          </a>

          <a 
            href="https://console.firebase.google.com/project/agent-follow-up-crm/firestore/data/~2FFollowUps" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-3 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
          >
            <span className="text-lg">🔄</span>
            <div>
              <div className="font-medium text-slate-900">Follow-ups</div>
              <div className="text-xs text-slate-500">Follow-up tracking</div>
            </div>
          </a>

          <a 
            href="https://console.firebase.google.com/project/agent-follow-up-crm/firestore/data/~2FOnboarding" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-3 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
          >
            <span className="text-lg">🚀</span>
            <div>
              <div className="font-medium text-slate-900">Onboarding</div>
              <div className="text-xs text-slate-500">Onboarding data</div>
            </div>
          </a>
        </div>
      </div>

      {/* Fix Deactivated Leads Section */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
        <h3 className="text-lg font-semibold text-amber-900 mb-3">🔧 Fix Import Issues</h3>
        <p className="text-sm text-amber-700 mb-4">
          If you recently imported leads and some got incorrectly marked as "Portal Deactivated", 
          use this button to restore them to their original status. The system will automatically 
          detect the most common status in your database and restore all affected leads.
        </p>
        
        <div className="flex flex-col gap-3">
          <button
            onClick={handleFixDeactivatedLeads}
            disabled={isRemovingDuplicates}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:bg-amber-300 disabled:cursor-not-allowed transition-colors"
          >
            {isRemovingDuplicates ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                <span>Fixing...</span>
              </>
            ) : (
              <>
                <span>🔧</span>
                <span>Fix Deactivated Leads</span>
              </>
            )}
          </button>

          <button
            onClick={handleRemoveOct31Duplicates}
            disabled={isRemovingDuplicates}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-red-300 disabled:cursor-not-allowed transition-colors"
          >
            {isRemovingDuplicates ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                <span>Cleaning...</span>
              </>
            ) : (
              <>
                <span>🗑️</span>
                <span>Remove Oct 31 Duplicates</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Deduplication Section */}
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-orange-900 mb-3">🧹 Duplicate Leads Cleanup</h3>
        <p className="text-sm text-orange-700 mb-4">
          Scan for and remove duplicate leads in your database. This will identify leads with the same mobile number, 
          keeping the oldest lead and removing the duplicates. Mobile number is used as the unique identifier.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <button
            onClick={handleScanDuplicates}
            disabled={isScanningDuplicates}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-orange-300 disabled:cursor-not-allowed transition-colors"
          >
            {isScanningDuplicates ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                <span>Scanning...</span>
              </>
            ) : (
              <>
                <span>🔍</span>
                <span>Scan for Duplicates</span>
              </>
            )}
          </button>
          
          <button
            onClick={handleRemoveDuplicates}
            disabled={isRemovingDuplicates || !duplicateReport || duplicateReport.duplicateGroups === 0}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-red-300 disabled:cursor-not-allowed transition-colors"
          >
            {isRemovingDuplicates ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                <span>Removing...</span>
              </>
            ) : (
              <>
                <span>🗑️</span>
                <span>Remove Duplicates</span>
              </>
            )}
          </button>
        </div>

        {/* Progress Bar */}
        {removalProgress && (
          <div className="bg-white border border-orange-200 rounded-lg p-4 mb-4">
            <h4 className="font-semibold text-orange-900 mb-3">🚀 Fast Removal in Progress</h4>
            <div className="space-y-3">
              <div className="flex justify-between text-sm text-orange-700">
                <span>Progress: {removalProgress.processed} / {removalProgress.total} duplicates</span>
                <span>{Math.round((removalProgress.processed / removalProgress.total) * 100)}%</span>
              </div>
              <div className="w-full bg-orange-200 rounded-full h-3">
                <div 
                  className="bg-gradient-to-r from-orange-500 to-red-500 h-3 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${(removalProgress.processed / removalProgress.total) * 100}%` }}
                ></div>
              </div>
              <div className="text-sm text-orange-600 text-center">
                {removalProgress.current}
              </div>
            </div>
          </div>
        )}

        {duplicateReport && (
          <div className="bg-white border border-orange-200 rounded-lg p-4">
            <h4 className="font-semibold text-orange-900 mb-3">📊 Duplicate Report</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{duplicateReport.totalLeads}</div>
                <div className="text-sm text-blue-800">Total Leads</div>
              </div>
              <div className="text-center p-3 bg-orange-50 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">{duplicateReport.duplicateGroups}</div>
                <div className="text-sm text-orange-800">Duplicate Groups</div>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{duplicateReport.totalDuplicates}</div>
                <div className="text-sm text-red-800">Total Duplicates</div>
              </div>
            </div>
            
            {duplicateReport.duplicates.length > 0 && (
              <div className="max-h-60 overflow-y-auto">
                <h5 className="font-medium text-orange-900 mb-2">Duplicate Details:</h5>
                <div className="space-y-2">
                  {duplicateReport.duplicates.slice(0, 10).map((duplicate, index) => (
                    <div key={index} className="p-2 bg-orange-50 rounded border border-orange-200">
                      <div className="font-medium text-orange-900">
                        {/* 🟢 SAFE FIX: Contact Access */}
                        📱 {(Array.isArray(duplicate.originalLead.contacts) ? duplicate.originalLead.contacts : [])[0]?.phone} - {duplicate.originalLead.agencyName}
                      </div>
                      <div className="text-sm text-orange-700">
                        Duplicates: {duplicate.duplicateLeads.length} | 
                        Original: {new Date(duplicate.originalLead.createdAt).toLocaleDateString()} |
                        Agency: {duplicate.originalLead.agencyName}
                      </div>
                    </div>
                  ))}
                  {duplicateReport.duplicates.length > 10 && (
                    <div className="text-sm text-orange-600 text-center p-2">
                      ...and {duplicateReport.duplicates.length - 10} more duplicate groups
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading field configurations…</p>
      ) : (
        <div className="space-y-6">
          {categories.map(category => (
            <div key={category} className="bg-white border rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4 capitalize">{category} Fields</h3>
              <div className="grid gap-4">
                {fields.filter(f => f.category === category).map(field => (
                  <div key={field.id} className="border rounded p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="font-medium">{field.displayName}</span>
                        <span className="text-sm text-slate-500 ml-2">({field.fieldType})</span>
                        {field.required && <span className="text-red-500 ml-1">*</span>}
                      </div>
                      <button 
                        onClick={() => setEditingField(editingField?.id === field.id ? null : field)}
                        className="px-2 py-1 text-xs bg-indigo-600 text-white rounded"
                      >
                        {editingField?.id === field.id ? 'Cancel' : 'Edit'}
                      </button>
                    </div>
                    
                    {editingField?.id === field.id && (
                      <div className="space-y-3 mt-3 p-3 bg-slate-50 rounded">
                        <div>
                          <label className="block text-sm font-medium mb-1">Display Name</label>
                          <input
                            type="text"
                            value={editingField.displayName}
                            onChange={(e) => setEditingField({...editingField, displayName: e.target.value})}
                            className="w-full p-2 border rounded"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium mb-1">Field Type</label>
                          <select
                            value={editingField.fieldType}
                            onChange={(e) => setEditingField({...editingField, fieldType: e.target.value as any})}
                            className="w-full p-2 border rounded"
                          >
                            <option value="text">Text</option>
                            <option value="select">Select</option>
                            <option value="date">Date</option>
                            <option value="email">Email</option>
                            <option value="phone">Phone</option>
                          </select>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={editingField.required}
                            onChange={(e) => setEditingField({...editingField, required: e.target.checked})}
                          />
                          <label className="text-sm">Required field</label>
                        </div>
                        
                        {editingField.fieldType === 'select' && (
                          <div>
                            <label className="block text-sm font-medium mb-1">Options</label>
                            <div className="space-y-2">
                              {(Array.isArray(editingField.options) ? editingField.options : []).map((option, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={option}
                                    onChange={(e) => {
                                      // 🟢 SAFE FIX: Array check
                                      const newOptions = [...(Array.isArray(editingField.options) ? editingField.options : [])];
                                      newOptions[idx] = e.target.value;
                                      setEditingField({...editingField, options: newOptions});
                                    }}
                                    className="flex-1 p-1 border rounded"
                                  />
                                  <button
                                    onClick={() => removeOption(editingField, option)}
                                    className="px-2 py-1 text-xs bg-red-600 text-white rounded"
                                  >
                                    Remove
                                  </button>
                                </div>
                              ))}
                              <button
                                onClick={() => {
                                  // 🟢 SAFE FIX: Array check
                                  const newOptions = [...(Array.isArray(editingField.options) ? editingField.options : []), 'New Option'];
                                  setEditingField({...editingField, options: newOptions});
                                }}
                                className="px-2 py-1 text-xs bg-green-600 text-white rounded"
                              >
                                Add Option
                              </button>
                            </div>
                          </div>
                        )}
                        
                        <div className="flex gap-2">
                          <button
                            onClick={() => updateField(editingField)}
                            className="px-3 py-1 text-sm bg-indigo-600 text-white rounded"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingField(null)}
                            className="px-3 py-1 text-sm bg-slate-600 text-white rounded"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lead Import History Section */}
      <div className="mt-8">
        <LeadImportHistory />
      </div>

      <div className="text-xs text-slate-500 mt-6">
        Tip: Edit field names and options to customize your CRM. Changes will apply to all forms and displays.
      </div>
    </div>
  );
};