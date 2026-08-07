import React, { useEffect, useState } from 'react';

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
  isAdmin: boolean;
  isSubAdmin: boolean;
  currentUser: string | null;
  onSignOut: () => void;
  forceExpanded?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onViewChange,
  isAdmin,
  isSubAdmin,
  currentUser,
  onSignOut,
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

  const navigationItems = [
    { id: 'leads', label: 'Leads', icon: '🌐', view: 'leads' },
    { id: 'pipeline', label: 'Pipeline', icon: '📊', view: 'pipeline' },
    { id: 'meetings', label: 'Meetings', icon: '📅', view: 'meetings' },
    { id: 'followups', label: 'Follow-ups', icon: '📞', view: 'followups' },
    { id: 'notifications', label: 'Notifications', icon: '🔔', view: 'notifications' },
    // { id: 'calls-report', label: 'Calls Report', icon: '📞', view: 'calls-report' },
    { id: 'travel-claims', label: 'Travel Claims', icon: '🚗', view: 'travel-claims' },
    { id: 'reports', label: 'Reports', icon: '📈', view: 'reports' },
    { id: 'bulk-email', label: 'Bulk Email', icon: '📧', view: 'bulk-email' },
    { id: 'live-tracking', label: isAdmin || isSubAdmin ? 'Live GPS Tracking' : 'My Location', icon: '📱', view: 'live-tracking' },
    ...(isAdmin || isSubAdmin ? [
      // { id: 'website-control', label: 'Website Control Panel', icon: '🌐', view: 'website-control' },
      { id: 'users', label: 'Users', icon: '👥', view: 'admin-users' },
      { id: 'usage-report', label: 'Usage Report', icon: '📊', view: 'usage-report' },
      // { id: 'database', label: 'Database', icon: '🗄️', view: 'database-admin' },
      { id: 'export', label: 'Export', icon: '📥', view: 'data-export' },
      // { id: 'meeting-photos', label: 'Meeting Photos', icon: '📸', view: 'meeting-photos' }
    ] : [])
  ];

  const isExpanded = forceExpanded || isPinnedOpen || isHovered;
  const sidebarWidthClass = isExpanded ? 'w-64' : 'w-16';

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
              aria-label="Toggle main menu"
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 6h16M4 12h16M4 18h10" />
              </svg>
            </button>
          )}
          {isExpanded && (
            <h1 className="text-xl font-bold text-white">Canam CRM</h1>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 overflow-y-auto">
        <ul className="space-y-1">
          {navigationItems.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => onViewChange(item.view)}
                className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-lg transition-colors ${
                  currentView === item.view
                    ? 'bg-indigo-600 text-white'
                    : 'hover:bg-slate-700 text-slate-300'
                }`}
                title={!isExpanded ? item.label : undefined}
              >
                <span className="text-lg flex-shrink-0">{item.icon}</span>
                {isExpanded && (
                  <span className="text-sm font-medium">{item.label}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
};

export default Sidebar;