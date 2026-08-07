import React, { useState } from 'react';

interface PendingApprovalProps {
  userEmail: string;
  onLogout: () => void;
}

export const PendingApproval: React.FC<PendingApprovalProps> = ({ userEmail, onLogout }) => {
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // 🟢 SAFE FIX: Robust logout handler
  const handleLogoutSafe = async () => {
    setIsLoggingOut(true);
    try {
      await onLogout();
    } catch (error) {
      console.error("Logout failed within Pending view:", error);
      // Force reload if graceful logout fails
      window.location.reload();
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight">Agency Partner CRM</h1>
          <p className="text-slate-400 mt-2 text-sm uppercase tracking-wider font-semibold">Account Status</p>
        </div>
        
        <div className="bg-white rounded-2xl shadow-2xl p-8 border-t-4 border-amber-500">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-amber-100 mb-6 animate-pulse">
              <svg className="h-8 w-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Approval Pending</h2>
            <p className="text-slate-600 mb-6 leading-relaxed">
              Your account {userEmail ? <strong>{userEmail}</strong> : ''} is currently under review by the administrator.
            </p>
            
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6 text-left">
              <p className="text-xs font-bold text-slate-500 uppercase mb-2">Next Steps:</p>
              <ul className="text-sm text-slate-700 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5">•</span> An admin will verify your details
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5">•</span> You'll gain access immediately upon approval
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5">•</span> Contact support if this takes longer than 24h
                </li>
              </ul>
            </div>
            
            <div className="space-y-3">
              <button
                onClick={handleRefresh}
                className="w-full flex justify-center py-2.5 px-4 border border-slate-300 rounded-lg shadow-sm text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
              >
                ↻ Check Status Again
              </button>

              <button
                onClick={handleLogoutSafe}
                disabled={isLoggingOut}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-slate-800 hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isLoggingOut ? 'Signing Out...' : 'Sign Out'}
              </button>
            </div>
          </div>
        </div>
        
        <p className="text-center text-xs text-slate-500 mt-8">
          &copy; {new Date().getFullYear()} Canam Application. All rights reserved.
        </p>
      </div>
    </div>
  );
};