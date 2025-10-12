import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface TypingUser {
  user_id: string;
  full_name: string | null;
  email: string;
}

export const useTypingIndicator = (channelId: string) => {
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const typingTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const loadCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    };

    loadCurrentUser();

    const channel = supabase
      .channel(`typing-${channelId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'typing_indicators',
          filter: `channel_id=eq.${channelId}`,
        },
        async (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const { data: profile } = await supabase
              .from('profiles')
              .select('id, full_name, email')
              .eq('id', payload.new.user_id)
              .single();

            if (profile && profile.id !== currentUserId) {
              setTypingUsers(prev => {
                const filtered = prev.filter(u => u.user_id !== profile.id);
                return [...filtered, {
                  user_id: profile.id,
                  full_name: profile.full_name,
                  email: profile.email
                }];
              });

              setTimeout(() => {
                setTypingUsers(prev => prev.filter(u => u.user_id !== profile.id));
              }, 3000);
            }
          } else if (payload.eventType === 'DELETE') {
            setTypingUsers(prev => prev.filter(u => u.user_id !== payload.old.user_id));
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [channelId, currentUserId]);

  const startTyping = useCallback(async () => {
    if (!currentUserId) return;

    if (typingTimeout.current) {
      clearTimeout(typingTimeout.current);
    }

    await supabase
      .from('typing_indicators')
      .upsert({
        channel_id: channelId,
        user_id: currentUserId,
        updated_at: new Date().toISOString()
      });

    typingTimeout.current = setTimeout(async () => {
      await supabase
        .from('typing_indicators')
        .delete()
        .eq('channel_id', channelId)
        .eq('user_id', currentUserId);
    }, 3000);
  }, [channelId, currentUserId]);

  const stopTyping = useCallback(async () => {
    if (!currentUserId) return;

    if (typingTimeout.current) {
      clearTimeout(typingTimeout.current);
    }

    await supabase
      .from('typing_indicators')
      .delete()
      .eq('channel_id', channelId)
      .eq('user_id', currentUserId);
  }, [channelId, currentUserId]);

  return { typingUsers, startTyping, stopTyping };
};
