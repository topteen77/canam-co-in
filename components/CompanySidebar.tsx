import React, { useEffect, useState } from 'react';
import CompanyBranding from './CompanyBranding';

interface CompanySidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
  isAdmin: boolean;
  isSubAdmin: boolean;
  currentUser: string | null;
  onSignOut: () => void;
  companyName: string;
  companyId?: string;
  forceExpanded?: boolean;
}

const CompanySidebar: React.FC<CompanySidebarProps> = ({
  currentView,
  onViewChange,
  isAdmin,
  isSubAdmin,
  currentUser,
  onSignOut,
  companyName,
  companyId,
  forceExpanded = false
}) => {
  const [isPinnedOpen, setIsPinnedOpen] = useState(() => forceExpanded);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (forceExpanded) {
      setIsPinnedOpen(true);
    } else {
      setIsPinnedOpen((prev) => prev && !forceExpanded);
    }
  }, [forceExpanded]);

  // Company-specific navigation items (no admin-only features)
  const navigationItems = [
    { id: 'leads', label: 'Lead List', icon: '🌐', view: 'leads' },
    { id: 'followups', label: 'Follow-ups', icon: '📞', view: 'followups' },
    { id: 'notifications', label: 'Notifications', icon: '🔔', view: 'notifications' },
    { id: 'reports', label: 'Reports', icon: '📈', view: 'reports' },
    { id: 'bulk-email', label: 'Bulk Email', icon: '📧', view: 'bulk-email' },
    { id: 'users', label: 'Users', icon: '👥', view: 'users' }
  ];

  const isExpanded = forceExpanded || isPinnedOpen || isHovered;
  const sidebarWidthClass = isExpanded ? 'w-64' : 'w-16';

  // 🟢 SAFE FIX: Robust user name handling
  const safeUserName = currentUser || 'Company Admin';
  const userInitial = safeUserName.charAt(0).toUpperCase();

  return (
    <div 
      className={`bg-slate-900 text-white transition-all duration-300 ${sidebarWidthClass} flex flex-col min-h-screen h-full flex-none`}
      onMouseEnter={() => {
        if (!forceExpanded) {
          setIsHovered(true);
        }
      }}
      onMouseLeave={() => {
        if (!forceExpanded) {
          setIsHovered(false);
        }
      }}
    >
      {/* Header */}
      <div className="p-3 sm:p-4 border-b border-slate-700">
        <div className="flex items-center justify-between gap-2">
          {!forceExpanded && (
            <button
              onClick={() => setIsPinnedOpen((prev) => !prev)}
              className="p-2 rounded-lg hover:bg-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900"
              title={isPinnedOpen ? 'Collapse menu' : 'Pin menu open'}
              aria-pressed={isPinnedOpen}
              aria-label="Toggle company menu"
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 6h16M4 12h16M4 18h10" />
              </svg>
            </button>
          )}
          <div className={`transition-opacity duration-300 ${isExpanded ? 'opacity-100' : 'opacity-0'} flex-1`}>
            <CompanyBranding 
              companyId={companyId || 'canam'} 
              companyName={companyName || 'Company CRM'} 
              size="medium"
              showText={true}
            />
            <p className="text-xs text-slate-400 mt-1">Company-specific CRM</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {navigationItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onViewChange(item.view)}
            className={`w-full flex items-center px-2.5 py-2 rounded-lg text-left transition-colors ${
              currentView === item.view
                ? 'bg-indigo-600 text-white'
                : 'text-slate-300 hover:bg-slate-700 hover:text-white'
            }`}
            title={!isExpanded ? item.label : undefined}
          >
            <span className="text-xl mr-0.5 sm:mr-3">{item.icon}</span>
            {isExpanded && (
              <span className="transition-opacity duration-300 text-sm font-medium">
                {item.label}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3 sm:p-4 border-t border-slate-700">
        {isExpanded ? (
          <div className="transition-opacity duration-300 space-y-3">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                <span className="text-sm font-medium text-indigo-600">
                  {userInitial}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate" title={safeUserName}>
                  {safeUserName}
                </p>
                <p className="text-xs text-slate-400">{isAdmin ? 'Admin' : isSubAdmin ? 'Sub-Admin' : 'User'}</p>
              </div>
            </div>
            
            {/* 🟢 SAFE FIX: Added proper Sign Out button */}
            <button
              onClick={onSignOut}
              className="w-full flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
            >
              Sign Out
            </button>

            <button
              onClick={() => window.location.href = 'https://agent-follow-up-crm.web.app'}
              className="w-full text-xs text-slate-400 hover:text-white text-center mt-2"
            >
              Switch to Main CRM
            </button>
          </div>
        ) : (
             // Collapsed footer icon
             <div className="flex flex-col items-center gap-4">
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center cursor-help" title={safeUserName}>
                    <span className="text-sm font-medium text-indigo-600">
                    {userInitial}
                    </span>
                </div>
                <button 
                    onClick={onSignOut}
                    className="p-2 text-slate-400 hover:text-red-400 transition-colors"
                    title="Sign Out"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                </button>
             </div>
        )}
      </div>
    </div>
  );
};

export default CompanySidebar;