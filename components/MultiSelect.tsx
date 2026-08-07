import React, { useState, useRef, useEffect } from 'react';

interface Option {
  value: string;
  label: string;
  disabled?: boolean;
}

interface MultiSelectProps {
  options: Option[];
  selectedValues: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  label?: string;
  className?: string;
  disabled?: boolean;
  maxHeight?: string;
}

export const MultiSelect: React.FC<MultiSelectProps> = ({
  options = [], // 🟢 SAFE FIX: Default to empty array
  selectedValues = [], // 🟢 SAFE FIX: Default to empty array
  onChange,
  placeholder = 'Select options...',
  label,
  className = '',
  disabled = false,
  maxHeight = "200px"
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // 🟢 SAFE FIX: Robust click-outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm("");
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // 🟢 SAFE FIX: Ensure options are valid; never call toLowerCase on null
  const rawOptions = Array.isArray(options) ? options : [];
  const safeOptions = rawOptions.filter(
    (o): o is Option => o != null && (o.value != null || o.label != null)
  ).map((o, i) => ({
    value: o.value ?? `opt-${i}`,
    label: o.label ?? String(o.value ?? ''),
    disabled: o.disabled
  }));
  const safeSelectedValues = (Array.isArray(selectedValues) ? selectedValues : []).filter(v => v != null);

  const search = (typeof searchTerm === 'string' ? searchTerm : '') || '';
  const searchLower = search.toLowerCase();
  const filteredOptions = safeOptions.filter(option => {
    const label = option?.label;
    const labelStr = label != null && typeof label === 'string' ? label : String(label ?? '');
    return labelStr.toLowerCase().includes(searchLower);
  });

  const toggleOption = (value: string) => {
    const newSelected = safeSelectedValues.includes(value)
      ? safeSelectedValues.filter(v => v !== value)
      : [...safeSelectedValues, value];
    
    onChange(newSelected);
  };

  const handleSelectAll = () => {
    const allValues = filteredOptions.filter(o => !o.disabled).map(option => option.value);
    const allSelected = allValues.every(value => safeSelectedValues.includes(value));
    
    if (allSelected) {
      // Deselect all filtered options
      onChange(safeSelectedValues.filter(value => !allValues.includes(value)));
    } else {
      // Select all filtered options
      const newSelected = [...safeSelectedValues];
      allValues.forEach(value => {
        if (!newSelected.includes(value)) {
          newSelected.push(value);
        }
      });
      onChange(newSelected);
    }
  };

  const handleClearAll = () => {
    onChange([]);
  };

  const removeValue = (valueToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(safeSelectedValues.filter(value => value !== valueToRemove));
  };

  const getDisplayText = () => {
    if (safeSelectedValues.length === 0) {
      return placeholder;
    }
    if (safeSelectedValues.length === 1) {
      const option = safeOptions.find(opt => opt.value === safeSelectedValues[0]);
      return option?.label || safeSelectedValues[0];
    }
    return `${safeSelectedValues.length} selected`;
  };

  const allFilteredSelected = filteredOptions.length > 0 && 
    filteredOptions.filter(o => !o.disabled).every(option => safeSelectedValues.includes(option.value));

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-slate-700 mb-1">
          {label}
        </label>
      )}
      
      <div
        className={`w-full px-3 py-2 text-left bg-white border border-slate-300 rounded-lg shadow-sm cursor-pointer flex items-center justify-between transition-all ${
          disabled ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'hover:border-slate-400'
        } ${isOpen ? 'ring-2 ring-indigo-500 border-indigo-500' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <span className={`block truncate ${safeSelectedValues.length === 0 ? 'text-slate-500' : 'text-slate-900'}`}>
          {getDisplayText()}
        </span>
        
        <div className="flex items-center space-x-1">
          {safeSelectedValues.length > 0 && !disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleClearAll();
              }}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100"
              title="Clear all"
            >
              ✕
            </button>
          )}
          <svg
            className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg animate-fadeIn overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b border-slate-200">
            <input
              type="text"
              placeholder="Search options..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          </div>

          {/* Select All / Clear All buttons */}
          {filteredOptions.length > 0 && (
            <div className="flex justify-between p-2 border-b border-slate-200 bg-slate-50">
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium px-2 py-1 rounded hover:bg-indigo-50"
              >
                {allFilteredSelected ? 'Deselect All' : 'Select All'}
              </button>
              {safeSelectedValues.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-xs text-red-600 hover:text-red-800 font-medium px-2 py-1 rounded hover:bg-red-50"
                >
                  Clear All
                </button>
              )}
            </div>
          )}

          {/* Options list */}
          <div className="overflow-y-auto" style={{ maxHeight }}>
            {filteredOptions.length === 0 ? (
              <div className="px-4 py-3 text-sm text-slate-500 text-center">No options found</div>
            ) : (
              filteredOptions.map((option, idx) => (
                <label
                  key={option.value ?? `option-${idx}`}
                  className={`
                    flex items-center px-4 py-2 text-sm cursor-pointer transition-colors
                    ${option.disabled ? 'text-slate-400 cursor-not-allowed bg-slate-50' : 'text-slate-700 hover:bg-indigo-50'}
                    ${safeSelectedValues.includes(option.value) ? 'bg-indigo-50 font-medium text-indigo-900' : ''}
                  `}
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={safeSelectedValues.includes(option.value)}
                    onChange={() => !option.disabled && toggleOption(option.value)}
                    disabled={option.disabled}
                    className="mr-3 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="truncate flex-1">{option.label}</span>
                  {safeSelectedValues.includes(option.value) && (
                    <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </label>
              ))
            )}
          </div>

          {/* Selected count footer */}
          {safeSelectedValues.length > 0 && (
            <div className="px-3 py-2 text-xs text-slate-500 bg-slate-50 border-t border-slate-200 font-medium">
              {safeSelectedValues.length} option{safeSelectedValues.length !== 1 ? 's' : ''} selected
            </div>
          )}
        </div>
      )}
      
      {/* Selected tags display (optional, can be commented out if too cluttered) */}
      {safeSelectedValues.length > 0 && !isOpen && (
        <div className="flex flex-wrap gap-1 mt-2">
          {safeSelectedValues.slice(0, 5).map((value, idx) => {
            const option = safeOptions.find(o => o.value === value);
            return (
              <span
                key={value ?? `sel-${idx}`}
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800 border border-indigo-200"
              >
                {option ? option.label : value}
                {!disabled && (
                  <button
                    type="button"
                    onClick={(e) => removeValue(value, e)}
                    className="ml-1 text-indigo-600 hover:text-indigo-900 focus:outline-none"
                  >
                    ×
                  </button>
                )}
              </span>
            );
          })}
          {safeSelectedValues.length > 5 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
              +{safeSelectedValues.length - 5} more
            </span>
          )}
        </div>
      )}
    </div>
  );
};