import React, { useEffect, useState } from 'react';
import apiClient from '../services/apiClient';

interface ImportRecord {
  id: string;
  importDate: string;
  importedBy: string;
  successCount: number;
  errorCount: number;
  totalCount: number;
  allResults: Array<{
    index: number;
    agencyName: string;
    error?: string;
    success: boolean;
  }>;
  createdAt: any; // Firestore timestamp
}

export const LeadImportHistory: React.FC = () => {
  const [importHistory, setImportHistory] = useState<ImportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImport, setSelectedImport] = useState<ImportRecord | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const { data } = await apiClient.get('/import-history');
        if (cancelled) return;
        const rows = Array.isArray(data) ? data : [];
        const records: ImportRecord[] = rows.map((row: any) => ({
          id: row.id ?? row.firebase_id ?? '',
          importDate: row.import_date ?? row.importDate ?? 'Unknown Date',
          importedBy: row.imported_by ?? row.importedBy ?? 'Unknown User',
          successCount: row.success_count ?? row.successCount ?? 0,
          errorCount: row.error_count ?? row.errorCount ?? 0,
          totalCount: row.total_count ?? row.totalCount ?? 0,
          allResults: row.all_results ?? row.allResults ?? [],
          createdAt: row.created_at ?? row.createdAt ?? new Date(),
        })) as ImportRecord[];
        records.sort((a, b) => {
          const aTime = (a.createdAt as any)?.seconds ? (a.createdAt as any).seconds * 1000 : new Date(a.createdAt as any).getTime();
          const bTime = (b.createdAt as any)?.seconds ? (b.createdAt as any).seconds * 1000 : new Date(b.createdAt as any).getTime();
          return bTime - aTime;
        });
        setImportHistory(records);
      } catch (error) {
        if (!cancelled) console.error('Error loading import history:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const downloadImportReport = async (record: ImportRecord, format: 'csv' | 'excel' = 'csv') => {
    try {
      if (format === 'excel') {
        // Use Excel export
        const XLSX = await import('xlsx');
        
        const exportData = record.allResults.map(result => ({
          'Lead Index': result.index + 1,
          'Agency Name': result.agencyName,
          'Status': result.success ? 'Success' : 'Failed',
          'Error Message': result.error || '',
          'Import Date': record.importDate,
          'Imported By': record.importedBy
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(exportData);
        
        // Set column widths
        ws['!cols'] = [
          { wch: 12 }, // Lead Index
          { wch: 30 }, // Agency Name
          { wch: 15 }, // Status
          { wch: 50 }, // Error Message
          { wch: 20 }, // Import Date
          { wch: 25 }  // Imported By
        ];
        
        XLSX.utils.book_append_sheet(wb, ws, 'Import Report');
        
        const fileName = `lead-import-report-${record.importDate.replace(/[:.]/g, '-')}.xlsx`;
        XLSX.writeFile(wb, fileName);
      } else {
        // Use CSV export
        const csvContent = [
          'Lead Index, Agency Name, Status, Error Message, Import Date, Imported By',
          ...record.allResults.map(result => 
            `${result.index + 1}, "${result.agencyName}", ${result.success ? 'Success' : 'Failed'}, "${result.error || ''}", "${record.importDate}", "${record.importedBy}"`
          )
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `lead-import-report-${record.importDate.replace(/[:.]/g, '-')}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      console.error('Error downloading report:', error);
      // Fallback to CSV if Excel fails
      if (format === 'excel') {
        downloadImportReport(record, 'csv');
      }
    }
  };

  const downloadAllImportHistory = async () => {
    try {
      const XLSX = await import('xlsx');
      
      // Prepare all import history data
      const allExportData = importHistory.flatMap(record => 
        record.allResults.map(result => ({
          'Import Date': record.importDate,
          'Imported By': record.importedBy,
          'Lead Index': result.index + 1,
          'Agency Name': result.agencyName,
          'Status': result.success ? 'Success' : 'Failed',
          'Error Message': result.error || '',
          'Total Count': record.totalCount,
          'Success Count': record.successCount,
          'Error Count': record.errorCount
        }))
      );

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(allExportData);
      
      // Set column widths
      ws['!cols'] = [
        { wch: 20 }, // Import Date
        { wch: 25 }, // Imported By
        { wch: 12 }, // Lead Index
        { wch: 30 }, // Agency Name
        { wch: 15 }, // Status
        { wch: 50 }, // Error Message
        { wch: 12 }, // Total Count
        { wch: 15 }, // Success Count
        { wch: 12 }  // Error Count
      ];
      
      XLSX.utils.book_append_sheet(wb, ws, 'All Import History');
      
      const fileName = `all-lead-import-history-${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);
      
      console.log(`📊 Downloaded all import history: ${allExportData.length} records`);
    } catch (error) {
      console.error('Error downloading all import history:', error);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <span className="ml-2 text-slate-600">Loading import history...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                📊 Lead Import History
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                View all lead import records, including successful and failed imports
              </p>
            </div>
            {importHistory.length > 0 && (
              <button
                onClick={downloadAllImportHistory}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download All (Excel)
              </button>
            )}
          </div>
        </div>

        {importHistory.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-slate-400 mb-2">📊</div>
            <p className="text-slate-600">No import history found.</p>
            <p className="text-sm text-slate-500">Import history will appear here after leads are imported.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Import Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Imported By
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Total
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    ✅ Success
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    ❌ Failed
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {importHistory.map((record) => (
                  <tr key={record.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      {new Date(record.createdAt?.seconds ? record.createdAt.seconds * 1000 : record.createdAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {record.importedBy}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 font-medium">
                      {record.totalCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                      {record.successCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-medium">
                      {record.errorCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={() => setSelectedImport(record)}
                          className="text-indigo-600 hover:text-indigo-800 font-medium text-xs"
                        >
                          View Details
                        </button>
                        <button
                          onClick={() => downloadImportReport(record, 'csv')}
                          className="text-blue-600 hover:text-blue-800 font-medium text-xs"
                        >
                          CSV
                        </button>
                        <button
                          onClick={() => downloadImportReport(record, 'excel')}
                          className="text-green-600 hover:text-green-800 font-medium text-xs"
                        >
                          Excel
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Import Details Modal */}
      {selectedImport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-900">Import Details</h2>
              <button
                onClick={() => setSelectedImport(null)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="text-center p-4 bg-slate-50 rounded-lg">
                  <div className="text-2xl font-bold text-slate-900">{selectedImport.totalCount}</div>
                  <div className="text-sm text-slate-600">Total</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{selectedImport.successCount}</div>
                  <div className="text-sm text-green-600">Success</div>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">{selectedImport.errorCount}</div>
                  <div className="text-sm text-red-600">Failed</div>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-sm font-bold text-blue-600">
                    {selectedImport.errorCount > 0 
                      ? `${((selectedImport.totalCount - selectedImport.errorCount) / selectedImport.totalCount * 100).toFixed(1)}%`
                      : '100%'
                    }
                  </div>
                  <div className="text-sm text-blue-600">Success Rate</div>
                </div>
              </div>

              <div className="mb-4">
                <button
                  onClick={() => downloadImportReport(selectedImport)}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Download Full Report
                </button>
              </div>

              {/* Failed leads */}
              {selectedImport.errorCount > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-slate-900">
                    Failed Leads ({selectedImport.errorCount})
                  </h3>
                  <div className="border border-red-200 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                    <div className="bg-red-50 px-4 py-2 border-b border-red-200">
                      <div className="grid grid-cols-12 gap-4 font-medium text-sm text-red-800">
                        <div className="col-span-1">#</div>
                        <div className="col-span-4">Agency Name</div>
                        <div className="col-span-7">Error Reason</div>
                      </div>
                    </div>
                    {selectedImport.allResults.filter(r => !r.success).map((result, index) => (
                      <div key={index} className="px-4 py-2 border-b border-red-100">
                        <div className="grid grid-cols-12 gap-4 text-sm">
                          <div className="col-span-1 text-slate-600 font-mono">{result.index + 1}</div>
                          <div className="col-span-4 font-medium text-slate-900">{result.agencyName}</div>
                          <div className="col-span-7 text-red-600">{result.error}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end p-6 border-t border-slate-200 bg-slate-50">
              <button
                onClick={() => setSelectedImport(null)}
                className="px-6 py-2 bg-slate-200 text-slate-800 rounded-lg hover:bg-slate-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};