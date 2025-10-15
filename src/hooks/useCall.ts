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
  console.log('[useCall] Hook initialized, channelId:', channelId, 'dmConversationId:', dmConversationId);
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    console.log('[useCall] useEffect triggered, channelId:', channelId, 'dmConversationId:', dmConversationId);
    if (channelId || dmConversationId) {
      console.log('[useCall] Checking active call and subscribing to changes');
      checkActiveCall();
      const unsubscribe = subscribeToCallChanges();
      return unsubscribe;
    }
  }, [channelId, dmConversationId]);

  const checkActiveCall = async () => {
    console.log('[useCall] checkActiveCall started, channelId:', channelId, 'dmConversationId:', dmConversationId);
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
        console.error('[useCall] Error checking active call:', error);
        return;
      }

      console.log('[useCall] checkActiveCall result:', data ? 'Call found' : 'No active call');
      setActiveCall(data as Call | null);
    } catch (error) {
      console.error('[useCall] Exception in checkActiveCall:', error);
    }
  };

  const subscribeToCallChanges = () => {
    const filter = channelId
      ? `channel_id=eq.${channelId}`
      : `dm_conversation_id=eq.${dmConversationId}`;
    console.log('[useCall] subscribeToCallChanges with filter:', filter);
    
    const channel = supabase
      .channel('call-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'calls',
          filter,
        },
        (payload) => {
          console.log('[useCall] Realtime call change detected:', payload.eventType);
          checkActiveCall();
        }
      )
      .subscribe();

    return () => {
      console.log('[useCall] Cleanup: Unsubscribing from call-changes');
      supabase.removeChannel(channel);
    };
  };

  const startCall = async (type: 'audio' | 'video' = 'video') => {
    console.log('[useCall] startCall initiated, type:', type);
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

      console.log('[useCall] Inserting call with data:', insertData);
      const { data, error } = await supabase
        .from('calls')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      console.log('[useCall] Call started successfully, id:', data.id);
      setActiveCall(data as Call);
      toast.success('Call started');
      return data;
    } catch (error: any) {
      console.error('[useCall] Error starting call:', error);
      toast.error(error.message || 'Failed to start call');
    } finally {
      setLoading(false);
    }
  };

  const endCall = async () => {
    console.log('[useCall] endCall called, activeCall:', activeCall?.id);
    if (!activeCall) return;

    try {
      console.log('[useCall] Invoking end-call function for call:', activeCall.id);
      const { error } = await supabase.functions.invoke('end-call', {
        body: { callId: activeCall.id },
      });

      if (error) throw error;

      console.log('[useCall] Call ended successfully');
      setActiveCall(null);
      toast.success('Call ended');
    } catch (error: any) {
      console.error('[useCall] Error ending call:', error);
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
