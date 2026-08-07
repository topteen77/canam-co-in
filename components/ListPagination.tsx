import React from 'react';

interface ListPaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (itemsPerPage: number) => void;
  startIndex: number;
  endIndex: number;
  paginatedLeads: any[];
  selectedLeads: string[];
  filteredLeads: any[];
  onSelectVisibleLeads: () => void;
  onSelectAllFilteredLeads: () => void;
}

export const ListPagination: React.FC<ListPaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
  startIndex,
  endIndex,
  paginatedLeads,
  selectedLeads,
  filteredLeads,
  onSelectVisibleLeads,
  onSelectAllFilteredLeads
}) => {
  // 🟢 SAFE FIX: Prevent displaying invalid ranges (e.g. "Showing 11-10 of 5")
  const safeEndIndex = Math.min(endIndex, totalItems);
  const safeStartIndex = totalItems === 0 ? 0 : startIndex + 1;
  const showPaginationControls = totalPages > 1 || totalItems > 0;

  // 🟢 SAFE FIX: Array checks
  const safePaginatedLeads = Array.isArray(paginatedLeads) ? paginatedLeads : [];
  const safeFilteredLeads = Array.isArray(filteredLeads) ? filteredLeads : [];
  const safeSelectedLeads = Array.isArray(selectedLeads) ? selectedLeads : [];

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 mb-6 shadow-sm mt-4">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        {/* Left side - Info and controls */}
        <div className="flex items-center gap-4">
          <div className="text-sm text-slate-600">
            Showing {safeStartIndex}-{safeEndIndex} of {totalItems} leads
          </div>
          
          <div className="flex items-center gap-4">
            {/* Items per page selector */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-slate-700">Show:</label>
              <select
                value={itemsPerPage}
                onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
                className="px-3 py-1 border border-slate-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              >
                <option value={5}>5 per page</option>
                <option value={10}>10 per page</option>
                <option value={25}>25 per page</option>
                <option value={50}>50 per page</option>
                <option value={100}>100 per page</option>
              </select>
            </div>
            
            {/* Selection Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={onSelectVisibleLeads}
                className="px-3 py-1 text-sm font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-md hover:bg-indigo-100 transition-colors"
              >
                {safePaginatedLeads.length > 0 && safePaginatedLeads.every(lead => safeSelectedLeads.includes(lead.id)) 
                  ? 'Deselect Page' 
                  : 'Select Page'
                }
              </button>
              
              <button
                onClick={onSelectAllFilteredLeads}
                className="px-3 py-1 text-sm font-medium text-green-600 bg-green-50 border border-green-200 rounded-md hover:bg-green-100 transition-colors"
              >
                {safeFilteredLeads.length > 0 && safeFilteredLeads.every(lead => safeSelectedLeads.includes(lead.id)) 
                  ? 'Deselect Filtered' 
                  : `Select All Filtered (${safeFilteredLeads.length})`
                }
              </button>
            </div>
          </div>
        </div>
        
        {/* Right side - Navigation */}
        <div className="flex items-center gap-2">
          {showPaginationControls ? (
            <>
              <button
                onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm font-medium text-slate-600 bg-slate-100 rounded-md hover:bg-slate-200 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => onPageChange(pageNum)}
                      className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                        currentPage === pageNum
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-600 bg-slate-100 hover:bg-slate-200'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              
              <button
                onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages || totalPages === 0}
                className="px-3 py-1 text-sm font-medium text-slate-600 bg-slate-100 rounded-md hover:bg-slate-200 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span>Page 1 of 1</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ListPagination;