import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type PresenceStatus = 'online' | 'away' | 'dnd' | 'offline';

interface UserPresence {
  user_id: string;
  status: PresenceStatus;
  last_seen: string;
}

export const usePresence = (userIds?: string[]) => {
  const [presenceMap, setPresenceMap] = useState<Map<string, UserPresence>>(new Map());

  useEffect(() => {
    const loadPresence = async () => {
      let query = supabase.from('user_presence').select('*');
      
      if (userIds && userIds.length > 0) {
        query = query.in('user_id', userIds);
      }

      const { data } = await query;
      
      if (data) {
        const map = new Map<string, UserPresence>();
        data.forEach(presence => {
          map.set(presence.user_id, presence as UserPresence);
        });
        setPresenceMap(map);
      }
    };

    loadPresence();

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
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            setPresenceMap(prev => {
              const newMap = new Map(prev);
              newMap.set(payload.new.user_id, payload.new as UserPresence);
              return newMap;
            });
          }
        }
      )
      .subscribe();

    return () => {
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
