// components/CompanyLogin.tsx – uses API auth (no Firebase)
import React, { useState } from 'react';
import { login } from '../services/authService';
import CompanyBranding from './CompanyBranding';

interface CompanyLoginProps {
  companyId: string;
  companyName: string;
  onLoginSuccess: (user: any) => void;
}

const CompanyLogin: React.FC<CompanyLoginProps> = ({
  companyId,
  companyName,
  onLoginSuccess
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const safeCompanyId = (companyId || 'canam').toLowerCase();
  const safeCompanyName = companyName || 'CRM';

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Please enter email and password.');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const user = await login(email.trim(), password);
      try {
        localStorage.setItem('companyContext', JSON.stringify({
          companyId: safeCompanyId,
          companyName: safeCompanyName,
          loginTime: new Date().toISOString()
        }));
      } catch (storageError) {
        console.warn('Could not save to localStorage:', storageError);
      }
      if (onLoginSuccess) {
        onLoginSuccess(user);
      }
    } catch (err: any) {
      setError(err?.message || 'Login failed. Check email and password.');
    } finally {
      setLoading(false);
    }
  };

  const clearCacheAndReload = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      console.warn('Could not clear storage', e);
    }
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Company Logo and Title */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <CompanyBranding 
              companyId={safeCompanyId} 
              companyName={safeCompanyName} 
              size="large"
              showText={true}
            />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            {safeCompanyName} CRM
          </h1>
          <p className="text-slate-300">
            Sign in with your email and password to continue
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <form onSubmit={handleEmailSignIn} className="space-y-4">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-slate-300 rounded-xl"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-slate-300 rounded-xl"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white font-semibold py-4 px-6 rounded-xl"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          {/* Download App Button */}
          <button className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-4 px-6 rounded-xl transition-colors duration-200 flex items-center justify-center space-x-3 mt-4">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Download App</span>
          </button>

          {/* Troubleshooting Section */}
          <div className="mt-6 p-4 bg-red-50 rounded-lg border border-red-200">
            <h3 className="text-red-800 font-semibold text-sm mb-2">
              Having trouble signing in?
            </h3>
            <button
              onClick={clearCacheAndReload}
              className="w-full bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200"
            >
              Clear Cache & Reload
            </button>
            <p className="text-red-600 text-xs mt-2">
              This will clear all cached data and reload the page
            </p>
          </div>

          {/* Features */}
          <div className="mt-6 space-y-2">
            <div className="flex items-center text-green-600 text-sm">
              <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Secure email login
            </div>
            <div className="flex items-center text-green-600 text-sm">
              <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Role-based access
            </div>
            <div className="flex items-center text-green-600 text-sm">
              <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              All users welcome
            </div>
          </div>

          {/* App Installation */}
          <div className="mt-4 text-center text-sm text-gray-600">
            <div className="flex items-center justify-center space-x-4">
              <div className="flex items-center">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                Mobile: Add to Home Screen
              </div>
              <div className="flex items-center">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Desktop: Install as App
              </div>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mt-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}
      </div>
    </div>
  );
};

export default CompanyLogin;