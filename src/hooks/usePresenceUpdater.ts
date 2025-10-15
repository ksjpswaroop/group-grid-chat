import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { log } from '@/lib/logger';

export type PresenceStatus = 'online' | 'away' | 'dnd' | 'offline';

/**
 * Hook to automatically update user presence based on activity
 */
export const usePresenceUpdater = () => {
  const updatePresence = useCallback(async (status: PresenceStatus) => {
    const startTime = log.timeStart('usePresenceUpdater', 'updatePresence');
    log.debug('usePresenceUpdater', 'updatePresence', 'Updating presence status', { status });
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        log.warn('usePresenceUpdater', 'updatePresence', 'No user found, skipping presence update');
        return;
      }

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
        
      log.debug('usePresenceUpdater', 'updatePresence', 'Presence updated successfully', { 
        userId: user.id, 
        status 
      });
    } catch (error) {
      log.error('usePresenceUpdater', 'updatePresence', 'Failed to update presence', { error });
    } finally {
      log.timeEnd('usePresenceUpdater', 'updatePresence', startTime, 'Presence update complete');
    }
  }, []);

  useEffect(() => {
    log.info('usePresenceUpdater', 'useEffect', 'Setting up presence tracking');
    
    // Set online on mount
    updatePresence('online');

    // Update presence on visibility change
    const handleVisibilityChange = () => {
      log.debug('usePresenceUpdater', 'handleVisibilityChange', 'Visibility changed', { 
        hidden: document.hidden 
      });
      if (document.hidden) {
        updatePresence('away');
      } else {
        updatePresence('online');
      }
    };

    // Update presence on user activity
    const handleActivity = () => {
      log.debug('usePresenceUpdater', 'handleActivity', 'User activity detected');
      updatePresence('online');
    };

    // Set offline on page unload
    const handleBeforeUnload = async () => {
      log.info('usePresenceUpdater', 'handleBeforeUnload', 'Page unloading, setting offline');
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
        log.debug('usePresenceUpdater', 'presenceInterval', 'Periodic presence update');
        updatePresence('online');
      }
    }, 120000); // 2 minutes

    return () => {
      log.info('usePresenceUpdater', 'useEffect', 'Cleaning up presence tracking');
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