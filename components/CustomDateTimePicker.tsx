import React, { useState, useEffect, useRef } from 'react';

interface CustomDateTimePickerProps {
  value: string; // ISO format or YYYY-MM-DDTHH:mm
  onChange: (value: string) => void;
  label?: string;
  min?: string;
  required?: boolean;
}

export const CustomDateTimePicker: React.FC<CustomDateTimePickerProps> = ({
  label,
  value,
  onChange,
  min,
  required
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Helper to get local ISO string (YYYY-MM-DDTHH:mm)
  const toLocalISO = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Parse value or fallback to now
  const parseValue = (val: string) => {
    if (!val) return new Date();
    const d = new Date(val);
    return isNaN(d.getTime()) ? new Date() : d;
  };

  const [selectedDate, setSelectedDate] = useState(() => parseValue(value));
  const [viewDate, setViewDate] = useState(() => parseValue(value));

  // Keep internal state in sync with external value, but only if it actually changed
  useEffect(() => {
    const nextDate = parseValue(value);
    if (toLocalISO(nextDate) !== toLocalISO(selectedDate)) {
      setSelectedDate(nextDate);
      setViewDate(nextDate);
    }
  }, [value]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Components for display
  const hour = selectedDate.getHours();
  const minute = selectedDate.getMinutes();
  const isPM = hour >= 12;
  const displayHour = hour % 12 || 12;

  const updateSelection = (newDate: Date) => {
    setSelectedDate(newDate);
    onChange(toLocalISO(newDate));
  };

  const handleDaySelect = (day: number) => {
    const newDate = new Date(selectedDate);
    newDate.setFullYear(viewDate.getFullYear(), viewDate.getMonth(), day);
    updateSelection(newDate);
    // Auto-close on day select for better UX, but time can still be adjusted
    // In this premium version, maybe we keep it open until "Done" is clicked or user clicks away
  };

  const handleMonthChange = (offset: number) => {
    const newViewDate = new Date(viewDate);
    newViewDate.setDate(1);
    newViewDate.setMonth(newViewDate.getMonth() + offset);
    setViewDate(newViewDate);
  };

  const handleTimeChange = (h: number, m: number, pm: boolean) => {
    const newDate = new Date(selectedDate);
    let finalHour = h % 12;
    if (pm) finalHour += 12;
    newDate.setHours(finalHour, m, 0, 0);
    updateSelection(newDate);
  };

  const handleQuickSelect = (daysOffset: number) => {
    const newDate = new Date();
    newDate.setDate(newDate.getDate() + daysOffset);
    newDate.setSeconds(0, 0);
    updateSelection(newDate);
    setViewDate(newDate);
    setIsOpen(false);
  };

  // Calendar Generation
  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDayOfMonth }, (_, i) => i);

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const hoursList = Array.from({ length: 12 }, (_, i) => i + 1);
  const minutesList = Array.from({ length: 12 }, (_, i) => i * 5);

  return (
    <div className="relative w-full" ref={containerRef}>
      {label && (
        <label className="block text-sm font-bold text-slate-800 mb-1">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-2.5 text-sm border-2 border-slate-300 rounded-xl shadow-sm cursor-pointer bg-white hover:border-indigo-500 transition-all duration-200 flex items-center justify-between"
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="text-slate-500">📅</span>
          <span className="text-slate-800 font-medium">
            {toLocalISO(selectedDate).replace('T', ' ')}
          </span>
        </div>
        <svg className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {isOpen && (
        <div className="absolute z-[100] mt-2 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden w-[340px] animate-in fade-in zoom-in duration-200 origin-top">
          {/* Header / Month Nav */}
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <button type="button" onClick={() => handleMonthChange(-1)} className="p-2 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-slate-200 shadow-sm">←</button>
            <div className="text-sm font-bold text-slate-800">
              {months[viewDate.getMonth()]} {viewDate.getFullYear()}
            </div>
            <button type="button" onClick={() => handleMonthChange(1)} className="p-2 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-slate-200 shadow-sm">→</button>
          </div>

          <div className="p-4">
            {/* Quick Actions */}
            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={() => handleQuickSelect(0)}
                className="flex-1 py-1.5 text-[10px] uppercase font-bold text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100 border border-indigo-200 transition-colors"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => handleQuickSelect(1)}
                className="flex-1 py-1.5 text-[10px] uppercase font-bold text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 border border-blue-200 transition-colors"
              >
                Tomorrow
              </button>
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1 mb-4 text-center">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                <div key={d} className="text-[10px] font-bold text-slate-400 uppercase pb-1">{d}</div>
              ))}
              {blanks.map(i => <div key={`b-${i}`} />)}
              {days.map(d => {
                const isSelected = selectedDate.getDate() === d &&
                  selectedDate.getMonth() === viewDate.getMonth() &&
                  selectedDate.getFullYear() === viewDate.getFullYear();
                
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => handleDaySelect(d)}
                    className={`py-2 text-xs rounded-lg transition-all ${isSelected
                        ? 'bg-indigo-600 text-white font-bold shadow-md transform scale-110 z-10'
                        : 'text-slate-700 hover:bg-indigo-50 hover:text-indigo-600'
                      }`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>

            {/* Time Picker */}
            <div className="border-t border-slate-100 pt-4 flex items-center justify-between gap-4">
              <div className="flex-1">
                <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">Hour</div>
                <select
                  value={displayHour}
                  onChange={(e) => handleTimeChange(Number(e.target.value), minute, isPM)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-sm font-bold text-slate-700 focus:border-indigo-500 outline-none"
                >
                  {hoursList.map(h => <option key={h} value={h}>{String(h).padStart(2, '0')}</option>)}
                </select>
              </div>

              <div className="flex-1">
                <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">Min</div>
                <select
                  value={Math.floor(minute / 5) * 5}
                  onChange={(e) => handleTimeChange(hour, Number(e.target.value), isPM)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-sm font-bold text-slate-700 focus:border-indigo-500 outline-none"
                >
                  {minutesList.map(m => <option key={m} value={m}>{String(m).padStart(2, '0')}</option>)}
                </select>
              </div>

              <div className="flex-1">
                <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">AM/PM</div>
                <div className="flex border border-slate-200 rounded-lg overflow-hidden bg-white">
                  <button
                    type="button"
                    onClick={() => handleTimeChange(hour, minute, false)}
                    className={`flex-1 py-1.5 text-[10px] font-bold transition-colors ${!isPM ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                  >
                    AM
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTimeChange(hour, minute, true)}
                    className={`flex-1 py-1.5 text-[10px] font-bold transition-colors ${isPM ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                  >
                    PM
                  </button>
                </div>
              </div>
            </div>

            {/* Done Button */}
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="w-full mt-4 py-2.5 bg-indigo-600 text-white text-xs font-bold uppercase rounded-xl shadow-lg hover:bg-indigo-700 transition-all active:scale-95"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
