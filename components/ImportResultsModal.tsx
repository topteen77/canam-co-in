import React from 'react';

interface ImportResult {
  index: number;
  agencyName: string;
  error?: string;
  success: boolean;
  isDuplicate?: boolean;
}

interface ImportResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  results: {
    successCount: number;
    duplicateCount?: number;
    errorCount: number;
    allResults: ImportResult[];
    importDate: string;
    importedBy: string;
  };
}

export const ImportResultsModal: React.FC<ImportResultsModalProps> = ({
  isOpen,
  onClose,
  results
}) => {
  if (!isOpen) return null;

  // 🟢 SAFE FIX: Default values and array checks
  const { 
      successCount = 0, 
      duplicateCount = 0, 
      errorCount = 0, 
      allResults = [], 
      importDate = new Date().toLocaleDateString(), 
      importedBy = 'Unknown' 
  } = results || {};

  const failedResults = allResults.filter(r => !r.success);
  const duplicateResults = allResults.filter(r => r.isDuplicate);
  const actualErrors = failedResults.filter(r => !r.isDuplicate);

  const downloadReport = async (format: 'csv' | 'excel' = 'csv') => {
    try {
      if (format === 'excel') {
        // Use Excel export
        try {
            const XLSX = await import('xlsx');
            
            const exportData = allResults.map(result => ({
            'Lead Index': result.index + 1,
            'Agency Name': result.agencyName,
            'Status': result.success ? 'Success' : 'Failed',
            'Error Message': result.error || '',
            'Import Date': importDate,
            'Imported By': importedBy
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
            
            const fileName = `lead-import-report-${importDate.replace(/[:.]/g, '-')}.xlsx`;
            XLSX.writeFile(wb, fileName);
        } catch (xlsxError) {
            console.warn('XLSX library failed to load, falling back to CSV', xlsxError);
            downloadReport('csv');
        }
      } else {
        // Use CSV export
        const csvContent = [
          'Lead Index, Agency Name, Status, Error Message, Import Date, Imported By',
          ...allResults.map(result => 
            `${result.index + 1}, "${result.agencyName}", ${result.success ? 'Success' : 'Failed'}, "${result.error || ''}", "${importDate}", "${importedBy}"`
          )
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `lead-import-report-${importDate.replace(/[:.]/g, '-')}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      console.error('Error downloading report:', error);
      alert('Failed to download report. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-2xl font-bold text-slate-900">📊 Lead Import Results</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Import Summary */}
          <div className="mb-6 p-4 bg-slate-50 rounded-lg">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{successCount}</div>
                <div className="text-sm text-slate-600">✅ Successful</div>
              </div>
              {duplicateCount > 0 && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">{duplicateCount}</div>
                  <div className="text-sm text-slate-600">⚠️ Duplicates</div>
                </div>
              )}
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{actualErrors.length}</div>
                <div className="text-sm text-slate-600">❌ Failed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{allResults.length}</div>
                <div className="text-sm text-slate-600">📊 Total</div>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
              <div className="text-slate-600">
                <span className="font-medium">Imported by:</span> {importedBy}
              </div>
              <div className="text-slate-600">
                <span className="font-medium">Import Date:</span> {importDate}
              </div>
            </div>
          </div>

          {/* Download Buttons */}
          <div className="mb-6 flex justify-center gap-4">
            <button
              onClick={() => downloadReport('csv')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download CSV
            </button>
            <button
              onClick={() => downloadReport('excel')}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download Excel
            </button>
          </div>

          {/* Duplicate Leads Details */}
          {duplicateResults.length > 0 && (
            <div className="space-y-4 mb-6">
              <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <span className="text-orange-600">⚠️</span>
                Duplicate Leads ({duplicateResults.length})
              </h3>
              <div className="border border-orange-200 rounded-lg overflow-hidden">
                <div className="bg-orange-50 px-4 py-2 border-b border-orange-200">
                  <div className="grid grid-cols-12 gap-4 font-medium text-sm text-orange-800">
                    <div className="col-span-1">#</div>
                    <div className="col-span-4">Agency Name</div>
                    <div className="col-span-7">Reason</div>
                  </div>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {duplicateResults.map((result, index) => (
                    <div key={index} className="px-4 py-3 border-b border-orange-100 hover:bg-orange-50">
                      <div className="grid grid-cols-12 gap-4 text-sm">
                        <div className="col-span-1 text-slate-600 font-mono">{result.index + 1}</div>
                        <div className="col-span-4 font-medium text-slate-900">{result.agencyName}</div>
                        <div className="col-span-7 text-orange-700">{result.error}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Failed Leads Details */}
          {actualErrors.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <span className="text-red-600">❌</span>
                Failed Leads ({actualErrors.length})
              </h3>
              <div className="border border-red-200 rounded-lg overflow-hidden">
                <div className="bg-red-50 px-4 py-2 border-b border-red-200">
                  <div className="grid grid-cols-12 gap-4 font-medium text-sm text-red-800">
                    <div className="col-span-1">#</div>
                    <div className="col-span-4">Agency Name</div>
                    <div className="col-span-7">Error Reason</div>
                  </div>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {actualErrors.map((result, index) => (
                    <div key={index} className="px-4 py-3 border-b border-red-100 hover:bg-red-50">
                      <div className="grid grid-cols-12 gap-4 text-sm">
                        <div className="col-span-1 text-slate-600 font-mono">{result.index + 1}</div>
                        <div className="col-span-4 font-medium text-slate-900">{result.agencyName}</div>
                        <div className="col-span-7 text-red-600">{result.error}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Successful Leads Summary */}
          {successCount > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2 mb-3">
                <span className="text-green-600">✅</span>
                Successfully Imported ({successCount})
              </h3>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="text-sm text-green-700">
                  All {successCount} leads have been successfully imported and are now available in the system.
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end p-6 border-t border-slate-200 bg-slate-50">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-200 text-slate-800 rounded-lg hover:bg-slate-300 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};