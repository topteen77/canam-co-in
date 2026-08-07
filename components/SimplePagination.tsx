import React, { useState } from 'react';

interface SimplePaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (itemsPerPage: number) => void;
  startIndex: number;
  endIndex: number;
}

export const SimplePagination: React.FC<SimplePaginationProps> = ({
  currentPage,
  totalPages = 0, // Default to 0
  totalItems = 0, // Default to 0
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
  startIndex,
  endIndex
}) => {
  const [isLoadingAll, setIsLoadingAll] = useState(false);

  // 🟢 SAFE FIX: Handle empty states gracefully
  const displayStart = totalItems === 0 ? 0 : startIndex + 1;
  const displayEnd = Math.min(endIndex, totalItems);
  const safeTotalPages = Math.max(0, totalPages);

  const handlePageChange = (newPage: number) => {
    // 🟢 SAFE FIX: Prevent navigating out of bounds
    if (newPage >= 1 && newPage <= safeTotalPages) {
      onPageChange(newPage);
    }
  };

  const handleItemsPerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === "all") {
      setIsLoadingAll(true);
      // Let the browser paint the loader
      setTimeout(() => {
        onItemsPerPageChange(1000000);
        // This next timeout will run after React finishes the heavy rendering
        setTimeout(() => {
          setIsLoadingAll(false);
        }, 0);
      }, 50);
    } else {
      onItemsPerPageChange(parseInt(val, 10));
    }
  };

  return (
    <>
      {isLoadingAll && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white p-6 rounded-lg shadow-xl flex flex-col items-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
            <p className="text-slate-800 font-medium text-lg">Loading all records...</p>
            <p className="text-sm text-slate-500 mt-2">This may take a moment depending on the data size.</p>
          </div>
        </div>
      )}
      <div className="bg-white border border-slate-200 rounded-lg p-4 mb-6 shadow-sm mt-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          {/* Left side - Info and items per page */}
          <div className="flex items-center gap-4">
            <div className="text-sm text-slate-600">
              Showing {displayStart}-{displayEnd} of {totalItems} records
            </div>
            
            {/* Items per page selector */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600">Show</span>
              <select
                value={itemsPerPage >= 1000000 ? "all" : itemsPerPage}
                onChange={handleItemsPerPageChange}
                className="px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value="all">All</option>
              </select>
              <span className="text-sm text-slate-600">per page</span>
            </div>
          </div>

          {/* Right side - Navigation */}
          <div className="flex items-center gap-2">
            {safeTotalPages > 1 ? (
              <>
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage <= 1}
                  className="px-3 py-1 text-sm font-medium text-slate-600 bg-slate-100 rounded-md hover:bg-slate-200 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, safeTotalPages) }, (_, i) => {
                    let pageNum;
                    if (safeTotalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= safeTotalPages - 2) {
                      pageNum = safeTotalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
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
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage >= safeTotalPages}
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
    </>
  );
};

export default SimplePagination;