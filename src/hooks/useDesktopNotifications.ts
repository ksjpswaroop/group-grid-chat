import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  data?: any;
}

export const useDesktopNotifications = () => {
  useEffect(() => {
    // Request permission on mount if not already granted
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const showNotification = (options: NotificationOptions) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification(options.title, {
        body: options.body,
        icon: options.icon || '/favicon.ico',
        tag: options.tag,
        data: options.data,
        badge: '/favicon.ico',
        requireInteraction: false,
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
        
        // Navigate to the channel if data is provided
        if (options.data?.channelId) {
          window.location.href = `/channel/${options.data.channelId}`;
        }
      };

      // Auto close after 5 seconds
      setTimeout(() => notification.close(), 5000);
    }
  };

  const subscribeToMentions = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const channel = supabase
      .channel('mention-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'mentions',
          filter: `mentioned_user_id=eq.${user.id}`
        },
        async (payload: any) => {
          // Fetch message details
          const { data: message } = await supabase
            .from('messages')
            .select('content, channel_id, profiles!messages_user_id_fkey(full_name)')
            .eq('id', payload.new.message_id)
            .single();

          if (message) {
            const profile = Array.isArray(message.profiles) 
              ? message.profiles[0] 
              : message.profiles;
            
            showNotification({
              title: `${profile?.full_name || 'Someone'} mentioned you`,
              body: message.content.slice(0, 100) + (message.content.length > 100 ? '...' : ''),
              tag: `mention-${payload.new.id}`,
              data: { channelId: message.channel_id }
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const subscribeToDirectMessages = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const channel = supabase
      .channel('dm-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
          filter: `recipient_id=eq.${user.id}`
        },
        async (payload: any) => {
          // Fetch sender details
          const { data: sender } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', payload.new.sender_id)
            .single();

          if (sender) {
            showNotification({
              title: `${sender.full_name} sent you a message`,
              body: payload.new.content.slice(0, 100) + (payload.new.content.length > 100 ? '...' : ''),
              tag: `dm-${payload.new.id}`,
              data: { userId: payload.new.sender_id }
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  useEffect(() => {
    let mentionsUnsubscribe: (() => void) | undefined;
    let dmsUnsubscribe: (() => void) | undefined;

    const setupSubscriptions = async () => {
      mentionsUnsubscribe = await subscribeToMentions();
      dmsUnsubscribe = await subscribeToDirectMessages();
    };

    setupSubscriptions();

    return () => {
      mentionsUnsubscribe?.();
      dmsUnsubscribe?.();
    };
  }, []);

  return { showNotification };
};