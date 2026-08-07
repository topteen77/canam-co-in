import React, { useState } from 'react';
import type { Lead } from '../types';
import { exportLeadsToCSV, exportLeadsToExcel, exportSummaryReport } from '../services/exportService';
import { DownloadIcon } from './icons/ActionIcons';

interface DataExportProps {
  leads: Lead[];
  isAdmin: boolean;
}

export const DataExport: React.FC<DataExportProps> = ({ leads, isAdmin }) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<'csv' | 'excel' | 'summary'>('excel');

  if (!isAdmin) {
    return null;
  }

  const handleExport = async () => {
    console.log('🚀 Export button clicked');
    console.log('📊 Leads available for export:', leads.length);
    console.log('📋 Export format selected:', exportFormat);
    
    // 🟢 SAFE FIX: Ensure leads is an array
    const safeLeads = Array.isArray(leads) ? leads : [];

    if (safeLeads.length === 0) {
      alert('No leads data available to export.');
      return;
    }

    setIsExporting(true);
    
    try {
      console.log('🔄 Starting export process...');
      switch (exportFormat) {
        case 'csv':
          console.log('📄 Exporting to CSV...');
          exportLeadsToCSV(safeLeads);
          break;
        case 'excel':
          console.log('📊 Exporting to Excel...');
          await exportLeadsToExcel(safeLeads);
          break;
        case 'summary':
          console.log('📋 Exporting summary...');
          exportSummaryReport(safeLeads);
          break;
      }
      console.log('✅ Export completed successfully');
    } catch (error) {
      console.error('❌ Export failed:', error);
      alert('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const getExportStats = () => {
    // 🟢 SAFE FIX: Use safe array for stats
    const safeLeads = Array.isArray(leads) ? leads : [];
    
    const totalFollowUps = safeLeads.reduce((total, lead) => {
      const followUps = Array.isArray(lead.followUps) ? lead.followUps : [];
      return total + followUps.length;
    }, 0);
    
    const leadsWithFollowUps = safeLeads.filter(lead => {
      const followUps = Array.isArray(lead.followUps) ? lead.followUps : [];
      return followUps.length > 0;
    }).length;
    
    return {
      totalLeads: safeLeads.length,
      totalFollowUps,
      leadsWithFollowUps,
      leadsWithoutFollowUps: safeLeads.length - leadsWithFollowUps
    };
  };

  const stats = getExportStats();

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-blue-800 flex items-center gap-2">
            <DownloadIcon className="h-5 w-5" />
            Export Data
          </h3>
          <p className="text-sm text-slate-600 mt-1">
            Download comprehensive lead data with all follow-ups and timestamps
          </p>
        </div>
      </div>

      {/* Export Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="bg-slate-50 rounded-lg p-3">
          <div className="text-2xl font-bold text-slate-800">{stats.totalLeads}</div>
          <div className="text-sm text-slate-600">Total Leads</div>
        </div>
        <div className="bg-slate-50 rounded-lg p-3">
          <div className="text-2xl font-bold text-slate-800">{stats.totalFollowUps}</div>
          <div className="text-sm text-slate-600">Total Follow-ups</div>
        </div>
        <div className="bg-slate-50 rounded-lg p-3">
          <div className="text-2xl font-bold text-slate-800">{stats.leadsWithFollowUps}</div>
          <div className="text-sm text-slate-600">Leads with Follow-ups</div>
        </div>
        <div className="bg-slate-50 rounded-lg p-3">
          <div className="text-2xl font-bold text-slate-800">{stats.leadsWithoutFollowUps}</div>
          <div className="text-sm text-slate-600">Leads without Follow-ups</div>
        </div>
      </div>

      {/* Export Options */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Export Format</label>
          <div className="grid grid-cols-3 gap-3">
            <label className="flex items-center p-3 border border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50">
              <input
                type="radio"
                name="exportFormat"
                value="excel"
                checked={exportFormat === 'excel'}
                onChange={(e) => setExportFormat(e.target.value as 'excel')}
                className="mr-2"
              />
              <div>
                <div className="font-medium text-blue-800">Excel (.xlsx)</div>
                <div className="text-xs text-slate-600">Recommended format</div>
              </div>
            </label>
            
            <label className="flex items-center p-3 border border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50">
              <input
                type="radio"
                name="exportFormat"
                value="csv"
                checked={exportFormat === 'csv'}
                onChange={(e) => setExportFormat(e.target.value as 'csv')}
                className="mr-2"
              />
              <div>
                <div className="font-medium text-blue-800">CSV (.csv)</div>
                <div className="text-xs text-slate-600">Universal format</div>
              </div>
            </label>
            
            <label className="flex items-center p-3 border border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50">
              <input
                type="radio"
                name="exportFormat"
                value="summary"
                checked={exportFormat === 'summary'}
                onChange={(e) => setExportFormat(e.target.value as 'summary')}
                className="mr-2"
              />
              <div>
                <div className="font-medium text-blue-800">Summary (.txt)</div>
                <div className="text-xs text-slate-600">Statistics only</div>
              </div>
            </label>
          </div>
        </div>

        {/* Export Button */}
        <button
          onClick={handleExport}
          disabled={isExporting || leads.length === 0}
          className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isExporting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Exporting...
            </>
          ) : (
            <>
              <DownloadIcon className="h-4 w-4" />
              Export {exportFormat.toUpperCase()} Data
            </>
          )}
        </button>
      </div>

      {/* Export Information */}
      <div className="mt-4 p-3 bg-blue-50 rounded-lg">
        <h4 className="font-medium text-blue-800 mb-2">What's included in the export:</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Complete lead information (ID, name, status, category)</li>
          <li>• Contact details (name, phone, email, address, city, country)</li>
          <li>• Assignment information (account manager, sales person)</li>
          <li>• All follow-ups with exact dates and times</li>
          <li>• Follow-up notes and remarks</li>
          <li>• Creation and update timestamps</li>
          <li>• Tags and onboarding information</li>
        </ul>
      </div>
    </div>
  );
};