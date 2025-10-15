import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type PresenceStatus = 'online' | 'away' | 'dnd' | 'offline';

/**
 * Hook to automatically update user presence based on activity
 */
export const usePresenceUpdater = () => {
  console.log('[usePresenceUpdater] Hook initialized');
  const updatePresence = useCallback(async (status: PresenceStatus) => {
    console.log('[usePresenceUpdater] updatePresence called with status:', status);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log('[usePresenceUpdater] No user found, skipping update');
      return;
    }

    console.log('[usePresenceUpdater] Upserting presence for user:', user.id, 'status:', status);
    await supabase
      .from('user_presence')
      .upsert({
        user_id: user.id,
        status,
        last_seen: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });
    console.log('[usePresenceUpdater] Presence updated successfully');
  }, []);

  useEffect(() => {
    console.log('[usePresenceUpdater] useEffect mounted, setting initial presence to online');
    // Set online on mount
    updatePresence('online');

    // Update presence on visibility change
    const handleVisibilityChange = () => {
      console.log('[usePresenceUpdater] Visibility changed, hidden:', document.hidden);
      if (document.hidden) {
        updatePresence('away');
      } else {
        updatePresence('online');
      }
    };

    // Update presence on user activity
    const handleActivity = () => {
      console.log('[usePresenceUpdater] User activity detected');
      updatePresence('online');
    };

    // Set offline on page unload
    const handleBeforeUnload = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      // Simple offline update - sendBeacon has limitations with auth
      updatePresence('offline');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // Update every 2 minutes if still active
    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    activityEvents.forEach(event => {
      window.addEventListener(event, handleActivity);
    });

    console.log('[usePresenceUpdater] Setting up 2-minute presence update interval');
    const presenceInterval = setInterval(() => {
      console.log('[usePresenceUpdater] Periodic presence update (2min), hidden:', document.hidden);
      if (!document.hidden) {
        updatePresence('online');
      }
    }, 120000); // 2 minutes

    return () => {
      console.log('[usePresenceUpdater] Cleanup: Removing event listeners and setting offline');
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      activityEvents.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      clearInterval(presenceInterval);
      
      // Set offline on unmount
      updatePresence('offline');
    };
  }, [updatePresence]);

  return { updatePresence };
};