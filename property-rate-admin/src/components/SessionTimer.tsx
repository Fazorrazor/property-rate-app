'use client';

import { useEffect, useRef } from 'react';

interface SessionTimerProps {
  initialMinutes?: number;
  onExpire?: () => void;
  className?: string;
  enableActivityReset?: boolean;
}

const STORAGE_KEY = 'heinz_admin_session_expiry';

/**
 * Headless Persistent Session Guard
 * - Zero visual UI footprint: completely invisible to the user
 * - Strictly persistent 7-minute lifespan from login (never resets on activity)
 * - Persists across page refreshes, tab switches, and wake-from-sleep
 * - Synchronizes across multiple browser tabs
 */
export function SessionTimer({
  initialMinutes = 7,
  onExpire,
}: SessionTimerProps) {
  const durationMs = initialMinutes * 60 * 1000;
  const isExpiringRef = useRef(false);

  useEffect(() => {
    // Determine or initialize target expiration timestamp
    let targetExpiry: number = Date.now() + durationMs;

    try {
      // Check cookie first
      const cookieMatch = document.cookie.match(/(?:^|;\s*)admin_session_expires_at=([^;]+)/);
      if (cookieMatch && cookieMatch[1]) {
        const parsedCookie = parseInt(cookieMatch[1], 10);
        if (!isNaN(parsedCookie) && parsedCookie > 0) {
          targetExpiry = parsedCookie;
        }
      } else {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = parseInt(stored, 10);
          if (!isNaN(parsed) && parsed > 0) {
            targetExpiry = parsed;
          } else {
            localStorage.setItem(STORAGE_KEY, targetExpiry.toString());
          }
        } else {
          localStorage.setItem(STORAGE_KEY, targetExpiry.toString());
        }
      }
    } catch {
      targetExpiry = Date.now() + durationMs;
    }

    const checkExpiration = () => {
      if (isExpiringRef.current) return;

      let currentTarget = targetExpiry;
      try {
        const cookieMatch = document.cookie.match(/(?:^|;\s*)admin_session_expires_at=([^;]+)/);
        if (cookieMatch && cookieMatch[1]) {
          const parsedCookie = parseInt(cookieMatch[1], 10);
          if (!isNaN(parsedCookie) && parsedCookie > 0) {
            currentTarget = parsedCookie;
          }
        } else {
          const stored = localStorage.getItem(STORAGE_KEY);
          if (stored) {
            const parsed = parseInt(stored, 10);
            if (!isNaN(parsed) && parsed > 0) {
              currentTarget = parsed;
            }
          }
        }
      } catch {}

      if (Date.now() >= currentTarget) {
        isExpiringRef.current = true;
        if (onExpire) {
          onExpire();
        }
      }
    };

    // Immediate check on mount
    checkExpiration();

    // 1-second interval ticker
    const interval = setInterval(checkExpiration, 1000);

    // Cross-tab synchronization
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        const parsed = parseInt(e.newValue, 10);
        if (!isNaN(parsed)) {
          targetExpiry = parsed;
          checkExpiration();
        }
      }
    };
    window.addEventListener('storage', handleStorage);

    // Immediate check when waking from sleep or returning to tab
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkExpiration();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorage);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [durationMs, onExpire]);

  // Headless: zero visible DOM elements rendered
  return null;
}
