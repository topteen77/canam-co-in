import { useEffect } from 'react';

export function useSessionTimeout(currentUser: string | null, onTimeout: () => void) {
  useEffect(() => {
    if (!currentUser) return;

    let inactivityTimer: NodeJS.Timeout;

    const resetTimer = () => {
      clearTimeout(inactivityTimer);
      // 30 minutes timeout
      inactivityTimer = setTimeout(() => {
        onTimeout();
      }, 30 * 60 * 1000);

      localStorage.setItem('lastActivityTime', Date.now().toString());
    };

    resetTimer();

    const activityHandler = () => {
      const lastActivity = parseInt(localStorage.getItem('lastActivityTime') || '0', 10);

      // If computer went to sleep and woke up after 30 mins
      if (Date.now() - lastActivity > 30 * 60 * 1000) {
        clearTimeout(inactivityTimer);
        onTimeout();
        return;
      }

      // Throttle updates to at most once per second
      if (Date.now() - lastActivity > 1000) {
        resetTimer();
      }
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => {
      document.addEventListener(event, activityHandler, true);
    });

    const intervalId = setInterval(() => {
      const lastActivity = parseInt(localStorage.getItem('lastActivityTime') || '0', 10);
      if (Date.now() - lastActivity > 30 * 60 * 1000) {
        clearTimeout(inactivityTimer);
        onTimeout();
      }
    }, 60000); // Check every minute

    return () => {
      clearTimeout(inactivityTimer);
      clearInterval(intervalId);
      events.forEach(event => {
        document.removeEventListener(event, activityHandler, true);
      });
    };
  }, [currentUser, onTimeout]);
}
