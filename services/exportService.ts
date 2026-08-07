import type { Lead, MeetingCheckInRecord } from '../types';

// Define Export Interfaces locally to avoid dependency issues
interface ExportLeadData {
  'Lead ID': string;
  'Agency Name': string;
  'Status': string;
  'Category': string;
  'ICP Score': string | number;
  'Created Date': string;
  'Created Time': string;
  'Created By': string;
  'Last Updated': string;
  'Last Updated Time': string;
  'Contact Name': string;
  'Contact Role': string;
  'Phone': string;
  'Email': string;
  'Address': string;
  'City': string;
  'Country': string;
  'Account Manager': string;
  'Sales Person': string;
  'Follow-up ID': string;
  'Follow-up Type': string;
  'Follow-up Status': string;
  'Follow-up Date': string;
  'Follow-up Time': string;
  'Follow-up Notes': string;
  'Follow-up Created By': string;
  'Tags': string;
  'Onboarded By': string;
  'Onboarded Date': string;
  'Onboarded Time': string;
}

interface ExportMeetingCheckInData {
  'Record ID': string;
  'User': string;
  'Sales Person Name': string;
  'Sales Person Email': string;
  'Meeting Type': string;
  'Date': string;
  'Check-in Time': string;
  'Lead ID': string;
  'Lead/Agency Name': string;
  'Location Address': string;
  'Latitude': string;
  'Longitude': string;
  'Notes': string;
  'Created By': string;
  'Created At': string;
}

// --- HELPER: Safe Date Formatting ---
const safeDate = (dateStr: string | undefined): Date | null => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
};

// --- HELPER: Download Text File ---
const downloadTextFile = (content: string, filename: string, mimeType = 'text/plain;charset=utf-8;') => {
    const blob = new Blob([content], { type: mimeType });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// --- HELPER: Download CSV File ---
const downloadCSV = (data: any[], filename: string) => {
    if (data.length === 0) return;
    const headers = Object.keys(data[0]);
    const csvContent = [
        headers.join(','),
        ...data.map(row => 
        headers.map(header => {
            const value = row[header];
            if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
            return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
        }).join(',')
        )
    ].join('\n');

    downloadTextFile(csvContent, filename, 'text/csv;charset=utf-8;');
};

// --- EXPORT LEADS TO CSV ---
export const exportLeadsToCSV = (leads: Lead[]): void => {
  const exportData: ExportLeadData[] = [];
  
  leads.forEach(lead => {
    const createdDate = safeDate(lead.createdAt) || new Date();
    const lastUpdated = safeDate(lead.updatedAt) || createdDate;
    const onboardedDate = safeDate(lead.onboardedAt);
    
    // Safety check for arrays
    const contacts = Array.isArray(lead.contacts) ? lead.contacts : [];
    const followUps = Array.isArray(lead.followUps) ? lead.followUps : [];
    const tags = Array.isArray(lead.tags) ? lead.tags : [];

    if (followUps.length > 0) {
      followUps.forEach((followUp) => {
        const followUpDate = safeDate(followUp.date) || new Date();
        
        exportData.push({
          'Lead ID': lead.id,
          'Agency Name': lead.agencyName,
          'Status': lead.status,
          'Category': lead.agentCategory,
          'ICP Score': lead.icpScore ?? 'NA',
          'Created Date': createdDate.toLocaleDateString(),
          'Created Time': createdDate.toLocaleTimeString(),
          'Created By': lead.createdBy,
          'Last Updated': lastUpdated.toLocaleDateString(),
          'Last Updated Time': lastUpdated.toLocaleTimeString(),
          
          'Contact Name': contacts[0]?.name || '',
          'Contact Role': contacts[0]?.role || '',
          'Phone': contacts[0]?.phone || '',
          'Email': contacts[0]?.email || '',
          'Address': contacts[0]?.address || '',
          'City': contacts[0]?.city || '',
          'Country': contacts[0]?.country || '',
          
          'Account Manager': lead.accountManager || '',
          'Sales Person': lead.salesPerson || '',
          
          'Follow-up ID': followUp.id,
          'Follow-up Type': followUp.type,
          'Follow-up Status': followUp.status,
          'Follow-up Date': followUpDate.toLocaleDateString(),
          'Follow-up Time': followUpDate.toLocaleTimeString(),
          'Follow-up Notes': followUp.notes || '',
          'Follow-up Created By': followUp.createdBy || lead.createdBy,
          
          'Tags': tags.join(', '),
          'Onboarded By': lead.onboardedBy || '',
          'Onboarded Date': onboardedDate ? onboardedDate.toLocaleDateString() : '',
          'Onboarded Time': onboardedDate ? onboardedDate.toLocaleTimeString() : '',
        });
      });
    } else {
      exportData.push({
        'Lead ID': lead.id,
        'Agency Name': lead.agencyName,
        'Status': lead.status,
        'Category': lead.agentCategory,
        'ICP Score': lead.icpScore ?? 'NA',
        'Created Date': createdDate.toLocaleDateString(),
        'Created Time': createdDate.toLocaleTimeString(),
        'Created By': lead.createdBy,
        'Last Updated': lastUpdated.toLocaleDateString(),
        'Last Updated Time': lastUpdated.toLocaleTimeString(),
        
        'Contact Name': contacts[0]?.name || '',
        'Contact Role': contacts[0]?.role || '',
        'Phone': contacts[0]?.phone || '',
        'Email': contacts[0]?.email || '',
        'Address': contacts[0]?.address || '',
        'City': contacts[0]?.city || '',
        'Country': contacts[0]?.country || '',
        
        'Account Manager': lead.accountManager || '',
        'Sales Person': lead.salesPerson || '',
        
        'Follow-up ID': '',
        'Follow-up Type': '',
        'Follow-up Status': '',
        'Follow-up Date': '',
        'Follow-up Time': '',
        'Follow-up Notes': '',
        'Follow-up Created By': '',
        
        'Tags': tags.join(', '),
        'Onboarded By': lead.onboardedBy || '',
        'Onboarded Date': onboardedDate ? onboardedDate.toLocaleDateString() : '',
        'Onboarded Time': onboardedDate ? onboardedDate.toLocaleTimeString() : '',
      });
    }
  });
  
  downloadCSV(exportData, `leads_export_${new Date().toISOString().split('T')[0]}.csv`);
};

// --- EXPORT LEADS TO EXCEL ---
export const exportLeadsToExcel = async (leads: Lead[]): Promise<void> => {
  try {
    const XLSX = await import('xlsx');
    const exportData: ExportLeadData[] = [];
    
    leads.forEach(lead => {
      const createdDate = safeDate(lead.createdAt) || new Date();
      const lastUpdated = safeDate(lead.updatedAt) || createdDate;
      const onboardedDate = safeDate(lead.onboardedAt);
      
      const contacts = Array.isArray(lead.contacts) ? lead.contacts : [];
      const followUps = Array.isArray(lead.followUps) ? lead.followUps : [];
      const tags = Array.isArray(lead.tags) ? lead.tags : [];

      if (followUps.length > 0) {
        followUps.forEach((followUp) => {
          const followUpDate = safeDate(followUp.date) || new Date();
          exportData.push({
            'Lead ID': lead.id,
            'Agency Name': lead.agencyName,
            'Status': lead.status,
            'Category': lead.agentCategory,
            'ICP Score': lead.icpScore ?? 'NA',
            'Created Date': createdDate.toLocaleDateString(),
            'Created Time': createdDate.toLocaleTimeString(),
            'Created By': lead.createdBy,
            'Last Updated': lastUpdated.toLocaleDateString(),
            'Last Updated Time': lastUpdated.toLocaleTimeString(),
            'Contact Name': contacts[0]?.name || '',
            'Contact Role': contacts[0]?.role || '',
            'Phone': contacts[0]?.phone || '',
            'Email': contacts[0]?.email || '',
            'Address': contacts[0]?.address || '',
            'City': contacts[0]?.city || '',
            'Country': contacts[0]?.country || '',
            'Account Manager': lead.accountManager || '',
            'Sales Person': lead.salesPerson || '',
            'Follow-up ID': followUp.id,
            'Follow-up Type': followUp.type,
            'Follow-up Status': followUp.status,
            'Follow-up Date': followUpDate.toLocaleDateString(),
            'Follow-up Time': followUpDate.toLocaleTimeString(),
            'Follow-up Notes': followUp.notes || '',
            'Follow-up Created By': followUp.createdBy || lead.createdBy,
            'Tags': tags.join(', '),
            'Onboarded By': lead.onboardedBy || '',
            'Onboarded Date': onboardedDate ? onboardedDate.toLocaleDateString() : '',
            'Onboarded Time': onboardedDate ? onboardedDate.toLocaleTimeString() : '',
          });
        });
      } else {
        exportData.push({
          'Lead ID': lead.id,
          'Agency Name': lead.agencyName,
          'Status': lead.status,
          'Category': lead.agentCategory,
          'ICP Score': lead.icpScore ?? 'NA',
          'Created Date': createdDate.toLocaleDateString(),
          'Created Time': createdDate.toLocaleTimeString(),
          'Created By': lead.createdBy,
          'Last Updated': lastUpdated.toLocaleDateString(),
          'Last Updated Time': lastUpdated.toLocaleTimeString(),
          'Contact Name': contacts[0]?.name || '',
          'Contact Role': contacts[0]?.role || '',
          'Phone': contacts[0]?.phone || '',
          'Email': contacts[0]?.email || '',
          'Address': contacts[0]?.address || '',
          'City': contacts[0]?.city || '',
          'Country': contacts[0]?.country || '',
          'Account Manager': lead.accountManager || '',
          'Sales Person': lead.salesPerson || '',
          'Follow-up ID': '',
          'Follow-up Type': '',
          'Follow-up Status': '',
          'Follow-up Date': '',
          'Follow-up Time': '',
          'Follow-up Notes': '',
          'Follow-up Created By': '',
          'Tags': tags.join(', '),
          'Onboarded By': lead.onboardedBy || '',
          'Onboarded Date': onboardedDate ? onboardedDate.toLocaleDateString() : '',
          'Onboarded Time': onboardedDate ? onboardedDate.toLocaleTimeString() : '',
        });
      }
    });
    
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);
    XLSX.utils.book_append_sheet(wb, ws, 'Leads Data');
    XLSX.writeFile(wb, `leads_export_${new Date().toISOString().split('T')[0]}.xlsx`);
    
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    exportLeadsToCSV(leads); // Fallback
  }
};

// --- EXPORT SUMMARY REPORT ---
export const exportSummaryReport = (leads: Lead[]): void => {
  const safeLeads = Array.isArray(leads) ? leads : [];
  
  const summary = {
    'Total Leads': safeLeads.length,
    'Leads by Status': safeLeads.reduce((acc, lead) => {
      acc[lead.status] = (acc[lead.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    'Leads by Category': safeLeads.reduce((acc, lead) => {
      acc[lead.agentCategory] = (acc[lead.agentCategory] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    'Total Follow-ups': safeLeads.reduce((total, lead) => total + (Array.isArray(lead.followUps) ? lead.followUps.length : 0), 0),
    'Follow-ups by Status': safeLeads.reduce((acc, lead) => {
      if(Array.isArray(lead.followUps)) {
          lead.followUps.forEach(followUp => {
            acc[followUp.status] = (acc[followUp.status] || 0) + 1;
          });
      }
      return acc;
    }, {} as Record<string, number>),
    'Export Date': new Date().toLocaleString(),
  };
  
  const summaryText = `LEADS EXPORT SUMMARY REPORT
Generated on: ${summary['Export Date']}

TOTAL LEADS: ${summary['Total Leads']}

LEADS BY STATUS:
${Object.entries(summary['Leads by Status']).map(([status, count]) => `  ${status}: ${count}`).join('\n')}

LEADS BY CATEGORY:
${Object.entries(summary['Leads by Category']).map(([category, count]) => `  ${category}: ${count}`).join('\n')}

TOTAL FOLLOW-UPS: ${summary['Total Follow-ups']}

FOLLOW-UPS BY STATUS:
${Object.entries(summary['Follow-ups by Status']).map(([status, count]) => `  ${status}: ${count}`).join('\n')}
`;
  
  downloadTextFile(summaryText, `leads_summary_${new Date().toISOString().split('T')[0]}.txt`);
};

// --- EXPORT MEETING CHECK-IN SUMMARY ---
export const exportMeetingCheckInSummary = (meetingCheckIns: MeetingCheckInRecord[]): void => {
  const summary = {
    'Total Meeting Check-ins': meetingCheckIns.length,
    'Unique Sales People': new Set(meetingCheckIns.map(rec => rec.salesPersonName || rec.username)).size,
    'Meeting Types': meetingCheckIns.reduce((acc, rec) => {
      const type = rec.meetingType || 'Unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    'Unique Leads': new Set(meetingCheckIns.map(rec => rec.leadName).filter(Boolean)).size,
    'Check-ins by Date': meetingCheckIns.reduce((acc, rec) => {
      const date = rec.date || 'Unknown';
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    'Export Date': new Date().toLocaleString(),
  };

  const summaryText = `MEETING CHECK-IN EXPORT SUMMARY REPORT
Generated on: ${summary['Export Date']}

TOTAL MEETING CHECK-INS: ${summary['Total Meeting Check-ins']}
UNIQUE SALES PEOPLE: ${summary['Unique Sales People']}
UNIQUE LEADS: ${summary['Unique Leads']}

MEETING TYPES:
${Object.entries(summary['Meeting Types']).map(([type, count]) => `  ${type}: ${count}`).join('\n')}

CHECK-INS BY DATE (Last 10 days):
${Object.entries(summary['Check-ins by Date'])
  .sort(([a], [b]) => b.localeCompare(a))
  .slice(0, 10)
  .map(([date, count]) => `  ${date}: ${count}`).join('\n')}
`;

  downloadTextFile(summaryText, `meeting_checkins_summary_${new Date().toISOString().split('T')[0]}.txt`);
};

// --- EXPORT MEETING CHECK-INS ---
export const exportMeetingCheckInsToCSV = (meetingCheckIns: MeetingCheckInRecord[]): void => {
  const exportData = prepareMeetingCheckInData(meetingCheckIns);
  downloadCSV(exportData, `meeting_checkins_export_${new Date().toISOString().split('T')[0]}.csv`);
};

export const exportMeetingCheckInsToExcel = async (meetingCheckIns: MeetingCheckInRecord[]): Promise<void> => {
  try {
    const XLSX = await import('xlsx');
    const exportData = prepareMeetingCheckInData(meetingCheckIns);
    
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);
    XLSX.utils.book_append_sheet(wb, ws, 'Meeting Check-ins');
    XLSX.writeFile(wb, `meeting_checkins_export_${new Date().toISOString().split('T')[0]}.xlsx`);
    
  } catch (error) {
    console.error('Error exporting meeting check-ins to Excel:', error);
    exportMeetingCheckInsToCSV(meetingCheckIns);
  }
};

// --- HELPERS ---

const prepareMeetingCheckInData = (meetingCheckIns: MeetingCheckInRecord[]): ExportMeetingCheckInData[] => {
    return meetingCheckIns.map((record, index) => {
        const checkInDate = safeDate(record.checkInTime) || new Date();
        const createdDate = safeDate(record.createdAt) || checkInDate;
        
        return {
          'Record ID': `MC-${index + 1}`,
          'User': record.username,
          'Sales Person Name': record.salesPersonName || '',
          'Sales Person Email': record.salesPersonEmail || '',
          'Meeting Type': record.meetingType || '',
          'Date': record.date,
          'Check-in Time': checkInDate.toLocaleTimeString(),
          'Lead ID': record.leadId || '',
          'Lead/Agency Name': record.leadName || '',
          'Location Address': record.location?.address || '',
          'Latitude': record.location?.latitude?.toString() || '',
          'Longitude': record.location?.longitude?.toString() || '',
          'Notes': record.notes || '',
          'Created By': record.createdBy || record.username,
          'Created At': createdDate.toLocaleString(),
        };
    });
};