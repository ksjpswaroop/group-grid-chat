import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type PresenceStatus = 'online' | 'away' | 'dnd' | 'offline';

interface UserPresence {
  user_id: string;
  status: PresenceStatus;
  last_seen: string;
}

export const usePresence = (userIds?: string[]) => {
  console.log('[usePresence] Hook initialized with userIds:', userIds);
  const [presenceMap, setPresenceMap] = useState<Map<string, UserPresence>>(new Map());

  useEffect(() => {
    console.log('[usePresence] useEffect triggered, userIds:', userIds);
    const loadPresence = async () => {
      console.log('[usePresence] loadPresence started');
      let query = supabase.from('user_presence').select('*');
      
      if (userIds && userIds.length > 0) {
        console.log('[usePresence] Filtering by userIds:', userIds);
        query = query.in('user_id', userIds);
      }

      const { data } = await query;
      console.log('[usePresence] Loaded presence data:', data?.length, 'records');
      
      if (data) {
        const map = new Map<string, UserPresence>();
        data.forEach(presence => {
          map.set(presence.user_id, presence as UserPresence);
        });
        console.log('[usePresence] Setting presence map with', map.size, 'entries');
        setPresenceMap(map);
      }
    };

    loadPresence();

    console.log('[usePresence] Setting up realtime subscription for presence-changes');
    const channel = supabase
      .channel('presence-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_presence',
        },
        (payload) => {
          console.log('[usePresence] Realtime presence change:', payload.eventType, 'for user:', payload.new?.user_id);
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            setPresenceMap(prev => {
              const newMap = new Map(prev);
              newMap.set(payload.new.user_id, payload.new as UserPresence);
              console.log('[usePresence] Updated presence map, now has', newMap.size, 'entries');
              return newMap;
            });
          }
        }
      )
      .subscribe();

    return () => {
      console.log('[usePresence] Cleanup: Unsubscribing from presence-changes');
      channel.unsubscribe();
    };
  }, [userIds?.join(',')]);

  const getPresence = (userId: string): PresenceStatus => {
    const presence = presenceMap.get(userId);
    if (!presence) return 'offline';
    
    const lastSeen = new Date(presence.last_seen);
    const now = new Date();
    const diffMinutes = (now.getTime() - lastSeen.getTime()) / 1000 / 60;
    
    if (diffMinutes > 5) return 'offline';
    return presence.status;
  };

  return { presenceMap, getPresence };
};
