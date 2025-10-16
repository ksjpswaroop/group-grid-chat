import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Call {
  id: string;
  room_name: string;
  is_active: boolean;
  started_by: string;
  started_at: string;
  call_type: 'audio' | 'video';
}

export function useCall(channelId?: string, dmConversationId?: string) {
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (channelId || dmConversationId) {
      checkActiveCall();
      const unsubscribe = subscribeToCallChanges();
      return unsubscribe;
    }
  }, [channelId, dmConversationId]);

  const checkActiveCall = async () => {
    try {
      let query = supabase
        .from('calls')
        .select('*')
        .eq('is_active', true);

      if (channelId) {
        query = query.eq('channel_id', channelId);
      } else if (dmConversationId) {
        query = query.eq('dm_conversation_id', dmConversationId);
      }

      const { data, error } = await query.maybeSingle();
      
      if (error) {
        console.error('Error checking active call:', error);
        return;
      }

      setActiveCall(data as Call | null);
    } catch (error) {
      console.error('Error checking active call:', error);
    }
  };

  const subscribeToCallChanges = () => {
    const channel = supabase
      .channel('call-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'calls',
          filter: channelId
            ? `channel_id=eq.${channelId}`
            : `dm_conversation_id=eq.${dmConversationId}`,
        },
        () => {
          checkActiveCall();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const startCall = async (type: 'audio' | 'video' = 'video') => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const roomName = `${channelId || dmConversationId}-${Date.now()}`;

      const insertData: any = {
        room_name: roomName,
        started_by: user.id,
        call_type: type,
      };

      if (channelId) {
        insertData.channel_id = channelId;
      } else if (dmConversationId) {
        insertData.dm_conversation_id = dmConversationId;
      }

      const { data, error } = await supabase
        .from('calls')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      setActiveCall(data as Call);
      toast.success('Call started');
      return data;
    } catch (error: any) {
      console.error('Error starting call:', error);
      toast.error(error.message || 'Failed to start call');
    } finally {
      setLoading(false);
    }
  };

  const endCall = async () => {
    if (!activeCall) return;

    try {
      const { error } = await supabase.functions.invoke('end-call', {
        body: { callId: activeCall.id },
      });

      if (error) throw error;

      setActiveCall(null);
      toast.success('Call ended');
    } catch (error: any) {
      console.error('Error ending call:', error);
      toast.error(error.message || 'Failed to end call');
    }
  };

  return {
    activeCall,
    startCall,
    endCall,
    loading,
  };
}
