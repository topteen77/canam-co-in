import React, { useEffect, useState } from 'react';
import { pwaAuthService } from '../services/pwaAuthService';

interface PWALoginProps {
  onLogin: (username: string) => boolean;
}

export const PWALogin: React.FC<PWALoginProps> = ({ onLogin }) => {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isPWA, setIsPWA] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<any>(null);

  useEffect(() => {
    // Check if running in PWA mode
    const checkPWAMode = () => {
      const pwaMode = pwaAuthService.isPWAMode();
      setIsPWA(pwaMode);
      setDeviceInfo(pwaAuthService.getDeviceInfo());
      
      console.log('📱 PWA Login: Device info:', pwaAuthService.getDeviceInfo());
    };

    checkPWAMode();

    // Set up authentication state listener
    const handleAuthStateChange = (user: any) => {
      if (user) {
        console.log('✅ PWA Login: User authenticated:', user.email);
        setLoading(false);
        setError(null);
        setSuccess('Login successful!');
        
        // Trigger the login callback
        const loginSuccess = onLogin(user.email);
        if (!loginSuccess) {
          setError('Login failed. Please try again.');
        }
      } else {
        console.log('👋 PWA Login: User not authenticated');
        setLoading(false);
      }
    };

    pwaAuthService.addAuthStateListener(handleAuthStateChange);

    // Cleanup listener on unmount
    return () => {
      pwaAuthService.removeAuthStateListener(handleAuthStateChange);
    };
  }, [onLogin]);

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      
      console.log('🔄 PWA Login: Starting Google sign-in...');
      await pwaAuthService.signInWithGoogle();
      
    } catch (error: any) {
      console.error('❌ PWA Login: Google sign-in failed:', error);
      setError(error.message || 'Sign-in failed. Please try again.');
      setLoading(false);
    }
  };

  const handleClearCacheAndReauth = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      
      console.log('🔄 PWA Login: ULTRA-AGGRESSIVE cache clearing...');
      
      // ULTRA-AGGRESSIVE CACHE CLEARING - Clear everything and force fresh start
      try {
        // Step 1: Clear all storage
        localStorage.clear();
        sessionStorage.clear();
        console.log('✅ All storage cleared');
        
        // Step 2: Clear IndexedDB completely
        if ('indexedDB' in window) {
          try {
            const databases = await indexedDB.databases();
            await Promise.all(
              databases.map(db => {
                if (db.name) {
                  return new Promise<void>((resolve, reject) => {
                      const req = indexedDB.deleteDatabase(db.name!);
                      req.onsuccess = () => resolve();
                      req.onerror = () => reject('Failed to delete DB');
                      req.onblocked = () => resolve(); // Proceed if blocked
                  });
                }
                return Promise.resolve();
              })
            );
            console.log('✅ IndexedDB cleared');
          } catch (indexedError) {
            console.warn('⚠️ IndexedDB clear failed:', indexedError);
          }
        }
        
        // Step 3: Clear all caches
        if ('caches' in window) {
          try {
            const cacheNames = await caches.keys();
            await Promise.all(
              cacheNames.map(cacheName => caches.delete(cacheName))
            );
            console.log('✅ All caches cleared');
          } catch (cacheError) {
            console.warn('⚠️ Cache API clear failed:', cacheError);
          }
        }
        
        // Step 4: Unregister ALL service workers
        if ('serviceWorker' in navigator) {
          try {
            const registrations = await navigator.serviceWorker.getRegistrations();
            await Promise.all(
              registrations.map(registration => registration.unregister())
            );
            console.log('✅ All service workers unregistered');
          } catch (swError) {
            console.warn('⚠️ Service worker unregister failed:', swError);
          }
        }
        
        // Step 5: Clear browser history and state (if possible)
        try {
          if (window.history && window.history.replaceState) {
            window.history.replaceState(null, '', window.location.href);
          }
        } catch (historyError) {
          console.warn('⚠️ History clear failed:', historyError);
        }
        
        // Step 6: Clear cookies
        try {
          document.cookie.split(";").forEach(function(c) { 
            document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
          });
          console.log('✅ Cookies cleared');
        } catch (cookieError) {
          console.warn('⚠️ Cookie clear failed:', cookieError);
        }
        
        console.log('✅ ULTRA-AGGRESSIVE cache clearing completed');
        
      } catch (error) {
        console.error('❌ Cache clearing failed:', error);
        // Continue anyway - partial clear is better than none
      }
      
      setSuccess('✅ Cache & History cleared! Redirecting to fresh login...');
      
      // Force complete page reload with cache bypass
      setTimeout(() => {
        // Use location.replace to prevent back button issues
        window.location.replace(window.location.origin + window.location.pathname + '?v=' + Date.now());
      }, 1500);
      
    } catch (error: any) {
      console.error('❌ PWA Login: Cache clearing failed:', error);
      setError('Failed to clear cache. Please try refreshing the page manually.');
      setLoading(false);
    }
  };

  const handleServiceWorkerReauth = () => {
    try {
      console.log('🔄 PWA Login: Requesting service worker re-authentication...');
      
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'PWA_REAUTH'
        });
        
        setSuccess('Service worker cache cleared. Please refresh the page.');
      } else {
        setError('Service worker not available. Please refresh the page manually.');
      }
      
    } catch (error: any) {
      console.error('❌ PWA Login: Service worker re-authentication failed:', error);
      setError('Failed to clear service worker cache.');
    }
  };

  const handleForceFreshAuth = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      
      console.log('🔄 PWA Login: Force fresh authentication...');
      
      // Use the new forceFreshAuth method
      await pwaAuthService.forceFreshAuth();
      
      setSuccess('🔄 Fresh authentication initiated. Redirecting...');
      
    } catch (error: any) {
      console.error('❌ PWA Login: Force fresh auth failed:', error);
      setError('Failed to initiate fresh authentication. Please try the cache clearing option.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-2xl p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl text-white">📱</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {isPWA ? 'PWA CRM Login' : 'CRM Login'}
          </h1>
          <p className="text-gray-600">
            Sign in to access your CRM dashboard
          </p>
        </div>

        {/* PWA-specific information */}
        {isPWA && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2 text-blue-800 mb-2">
              <span className="text-lg">📱</span>
              <span className="font-semibold">PWA Mode Detected</span>
            </div>
            <p className="text-sm text-blue-700">
              You're using the Progressive Web App. If you're having sign-in issues after clearing browser data, use the troubleshooting options below.
            </p>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-800 mb-2">
              <span className="text-lg">❌</span>
              <span className="font-semibold">Error</span>
            </div>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Success Display */}
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 text-green-800 mb-2">
              <span className="text-lg">✅</span>
              <span className="font-semibold">Success</span>
            </div>
            <p className="text-sm text-green-700">{success}</p>
          </div>
        )}

        {/* Main Sign-in Button */}
        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-semibold"
        >
          {loading ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Signing in...</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span>Sign in with Google</span>
            </>
          )}
        </button>

        {/* PROMINENT Clear Cache & History Button */}
        <div className="mt-6 p-4 bg-red-50 border-2 border-red-200 rounded-lg">
          <div className="text-center mb-3">
            <span className="text-sm font-semibold text-red-800">Having trouble signing in?</span>
          </div>
          
          <button
            onClick={handleClearCacheAndReauth}
            disabled={loading}
            className="w-full px-6 py-3 text-sm font-bold text-white bg-red-600 border-2 border-red-700 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-all transform hover:scale-105 shadow-lg"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block mr-2"></div>
                Clearing Cache...
              </>
            ) : (
              <>
                🧹 Clear Cache & History
              </>
            )}
          </button>
          
          <div className="text-xs text-red-700 mt-2 text-center">
            This will clear all cached data and reload the page
          </div>
        </div>

        {/* Additional PWA Troubleshooting Options */}
        {isPWA && (
          <div className="mt-4 space-y-2">
            <button
              onClick={handleServiceWorkerReauth}
              disabled={loading}
              className="w-full px-4 py-2 text-sm text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 disabled:opacity-50 transition-colors"
            >
              🛠️ Clear Service Worker Cache Only
            </button>
            
            <button
              onClick={handleForceFreshAuth}
              disabled={loading}
              className="w-full px-4 py-2 text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 disabled:opacity-50 transition-colors"
            >
              🔄 Force Fresh Authentication
            </button>
          </div>
        )}

        {/* Device Information (Debug) */}
        {deviceInfo && (
          <div className="mt-6 p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="text-xs text-gray-600">
              <div className="font-semibold mb-1">Device Info:</div>
              <div>PWA Mode: {deviceInfo.isPWA ? 'Yes' : 'No'}</div>
              <div>Mobile: {deviceInfo.isMobile ? 'Yes' : 'No'}</div>
              <div>LocalStorage: {deviceInfo.localStorage ? 'Available' : 'Not Available'}</div>
              <div>Service Worker: {deviceInfo.serviceWorker ? 'Available' : 'Not Available'}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};