import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type PresenceStatus = 'online' | 'away' | 'dnd' | 'offline';

/**
 * Hook to automatically update user presence based on activity
 */
export const usePresenceUpdater = () => {
  const updatePresence = useCallback(async (status: PresenceStatus) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

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
  }, []);

  useEffect(() => {
    // Set online on mount
    updatePresence('online');

    // Update presence on visibility change
    const handleVisibilityChange = () => {
      if (document.hidden) {
        updatePresence('away');
      } else {
        updatePresence('online');
      }
    };

    // Update presence on user activity
    const handleActivity = () => {
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

    const presenceInterval = setInterval(() => {
      if (!document.hidden) {
        updatePresence('online');
      }
    }, 120000); // 2 minutes

    return () => {
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