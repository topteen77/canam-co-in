import apiClient from './apiClient';

interface UserData {
  email: string;
  id: string;
  name: string;
  role: string;
  approved: boolean;
  status: string;
  signup_method: string;
  created_at: string;
  updated_at: string;
  token?: string; // JWT Token
}

// Enhanced localStorage with error handling
const safeLocalStorageSet = (key: string, value: string): boolean => {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.error('❌ localStorage set failed:', error);
    return false;
  }
};

const safeLocalStorageGet = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    console.error('❌ localStorage get failed:', error);
    return null;
  }
};

const safeLocalStorageRemove = (key: string): boolean => {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error('❌ localStorage remove failed:', error);
    return false;
  }
};

// PWA-specific authentication state management
export class PWAAuthService {
  private static instance: PWAAuthService;
  private authStateListeners: Array<(user: UserData | null) => void> = [];
  private isInitialized = false;
  private currentUser: UserData | null = null;

  private constructor() {
    this.initializeAuthState();
  }

  public static getInstance(): PWAAuthService {
    if (!PWAAuthService.instance) {
      PWAAuthService.instance = new PWAAuthService();
    }
    return PWAAuthService.instance;
  }

  private async initializeAuthState() {
    if (this.isInitialized) return;
    
    console.log('🔄 PWA Auth Service: Initializing authentication state...');
    
    try {
      // Check if this is a fresh start after cache clearing
      const urlParams = new URLSearchParams(window.location.search);
      const isFreshStart = urlParams.has('v') || urlParams.has('fresh') || urlParams.has('cleared');
      
      if (isFreshStart) {
        console.log('🔄 PWA Auth Service: Fresh start detected - clearing all auth state');
        this.handleUserSignOut();
      } else {
        // Check for cached user data first
        const cachedUser = this.getCachedUser();
        const token = safeLocalStorageGet('authToken');

        if (cachedUser && token) {
          console.log('📱 PWA Auth Service: Found cached user data');
          this.currentUser = cachedUser;
          this.notifyListeners(cachedUser);
          
          // Optional: You can implement a verify endpoint later
          // this.verifySession();
        } else {
            this.notifyListeners(null);
        }
      }

      this.isInitialized = true;
      console.log('✅ PWA Auth Service: Initialization complete');
      
    } catch (error) {
      console.error('❌ PWA Auth Service: Initialization failed:', error);
      this.handleAuthError(error);
    }
  }

  /* * session verification logic can be added here if you create a /api/auth/me endpoint
   * For now, we rely on the token being present and valid
   */
  // private async verifySession() { ... }

  private handleUserSignOut() {
    console.log('👋 PWA Auth Service: User signed out');
    this.currentUser = null;
    safeLocalStorageRemove('crmUser');
    safeLocalStorageRemove('authToken');
    this.notifyListeners(null);
  }

  private handleAuthError(error: any) {
    console.error('❌ PWA Auth Service: Authentication error:', error);
    this.currentUser = null;
    safeLocalStorageRemove('crmUser');
    safeLocalStorageRemove('authToken');
    this.notifyListeners(null);
  }

  private getCachedUser(): UserData | null {
    try {
      const cachedData = safeLocalStorageGet('crmUser');
      if (cachedData) {
        const userData = JSON.parse(cachedData);
        // Basic validation of cached data
        if (userData.email && userData.role) {
          return userData;
        }
      }
    } catch (error) {
      console.error('❌ PWA Auth Service: Failed to parse cached user data:', error);
    }
    return null;
  }

  private notifyListeners(user: UserData | null) {
    this.authStateListeners.forEach(listener => {
      try {
        listener(user);
      } catch (error) {
        console.error('❌ PWA Auth Service: Listener notification failed:', error);
      }
    });
  }

  // Public methods
  public getCurrentUser(): UserData | null {
    return this.currentUser;
  }

  public addAuthStateListener(listener: (user: UserData | null) => void) {
    this.authStateListeners.push(listener);
    // Immediately notify with current state
    listener(this.currentUser);
  }

  public removeAuthStateListener(listener: (user: UserData | null) => void) {
    const index = this.authStateListeners.indexOf(listener);
    if (index > -1) {
      this.authStateListeners.splice(index, 1);
    }
  }

  // Login with Email/Password (Connecting to SQL Backend)
  public async signIn(email: string, password: string): Promise<UserData> {
      try {
          // This calls your new Node.js SQL Backend
          const response = await apiClient.post('/auth/login', { email, password });
          
          // Backend returns { success: true, user: {...} }
          // We don't have JWT generation in the simple backend yet, so we mock it or rely on session
          const { user } = response.data;

          if (!user) throw new Error('Invalid response from server');
          
          // Generate a mock token if none exists (since we stripped Firebase)
          // In production, your backend should generate a real JWT.
          const token = response.data.token || `mock-token-${Date.now()}`;

          // Store session
          safeLocalStorageSet('authToken', token);
          safeLocalStorageSet('crmUser', JSON.stringify(user));

          this.currentUser = user;
          this.notifyListeners(user);
          return user;
      } catch (error: any) {
          console.error('Login failed:', error);
          const msg = error.response?.data?.message || 'Login failed';
          throw new Error(msg);
      }
  }

  public async signOut(): Promise<void> {
    try {
      console.log('🔄 PWA Auth Service: Signing out...');
      this.handleUserSignOut();
      console.log('✅ PWA Auth Service: Sign-out successful');
    } catch (error) {
      console.error('❌ PWA Auth Service: Sign-out failed:', error);
      this.handleUserSignOut();
    }
  }

  // Force fresh authentication after cache clearing
  public async forceFreshAuth(): Promise<void> {
    try {
      console.log('🔄 PWA Auth Service: Force fresh authentication...');
      this.handleUserSignOut();
      await new Promise(resolve => setTimeout(resolve, 500));
      window.location.reload(); 
    } catch (error: any) {
      console.error('❌ PWA Auth Service: Force fresh auth failed:', error);
      this.handleAuthError(error);
      throw error;
    }
  }

  // PWA-specific methods
  public async clearCacheAndReauth(): Promise<void> {
    console.log('🔄 PWA Auth Service: Clearing cache and re-authenticating...');
    
    try {
      safeLocalStorageRemove('crmUser');
      safeLocalStorageRemove('authToken');
      this.currentUser = null;
      
      // Clear service worker cache
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
        console.log('✅ PWA Auth Service: Service worker cache cleared');
      }
      
      console.log('✅ PWA Auth Service: Cache cleared and ready for re-authentication');
      window.location.reload();
      
    } catch (error) {
      console.error('❌ PWA Auth Service: Cache clearing failed:', error);
      throw error;
    }
  }

  public isPWAMode(): boolean {
    return window.matchMedia('(display-mode: standalone)').matches ||
           (window.navigator as any).standalone === true ||
           document.referrer.includes('android-app://');
  }

  public getDeviceInfo() {
    return {
      userAgent: navigator.userAgent,
      isPWA: this.isPWAMode(),
      isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
      localStorage: typeof Storage !== 'undefined',
      serviceWorker: 'serviceWorker' in navigator
    };
  }
}



// Export singleton instance
export const pwaAuthService = PWAAuthService.getInstance();