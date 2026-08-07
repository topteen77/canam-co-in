import React, { useState } from 'react';

interface MobileCacheButtonProps {
  className?: string;
}

export const MobileCacheButton: React.FC<MobileCacheButtonProps> = ({ className = '' }) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleClearCache = async () => {
    if (isLoading) return;
    
    // 🟢 SAFE FIX: Prevent accidental clicks
    if (!window.confirm('Are you sure? This will clear all app data, log you out, and reload the page.')) {
      return;
    }
    
    setIsLoading(true);
    try {
      console.log('🧹 Starting comprehensive cache clear...');
      
      // 1. Clear localStorage
      try {
        localStorage.clear();
        console.log('✅ localStorage cleared');
      } catch (e) {
        console.warn('⚠️ localStorage clear failed:', e);
      }
      
      // 2. Clear sessionStorage
      try {
        sessionStorage.clear();
        console.log('✅ sessionStorage cleared');
      } catch (e) {
        console.warn('⚠️ sessionStorage clear failed:', e);
      }
      
      // 3. Clear IndexedDB
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
      
      // 4. Clear Cache API
      if ('caches' in window) {
        try {
          const cacheNames = await caches.keys();
          await Promise.all(
            cacheNames.map(cacheName => caches.delete(cacheName))
          );
          console.log('✅ Cache API cleared');
        } catch (cacheError) {
          console.warn('⚠️ Cache API clear failed:', cacheError);
        }
      }
      
      // 5. Unregister service workers
      if ('serviceWorker' in navigator) {
        try {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(
            registrations.map(registration => registration.unregister())
          );
          console.log('✅ Service workers unregistered');
        } catch (swError) {
          console.warn('⚠️ Service worker unregister failed:', swError);
        }
      }
      
      alert('✅ Cache cleared successfully! The app will reload now.');
      window.location.reload();
      
    } catch (error: any) {
      console.error('❌ Cache clear failed:', error);
      alert('❌ Failed to clear cache: ' + (error.message || 'Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Mobile Floating Action Button - Only visible on mobile */}
      <button
        onClick={handleClearCache}
        disabled={isLoading}
        className={`fixed bottom-20 right-4 z-40 md:hidden bg-orange-500 hover:bg-orange-600 text-white rounded-full p-3 shadow-lg transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
        title="Clear Cache & Reload"
        aria-label="Clear Cache"
      >
        {isLoading ? (
          <svg className="w-6 h-6 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        )}
      </button>
    </>
  );
};

export default MobileCacheButton;