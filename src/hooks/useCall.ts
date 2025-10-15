import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { log } from '@/lib/logger';

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

  log.info('useCall', 'useCall', 'Hook initializing', { channelId, dmConversationId });

  useEffect(() => {
    if (channelId || dmConversationId) {
      log.info('useCall', 'useEffect', 'Setting up call monitoring', { channelId, dmConversationId });
      checkActiveCall();
      const unsubscribe = subscribeToCallChanges();
      return unsubscribe;
    }
  }, [channelId, dmConversationId]);

  const checkActiveCall = async () => {
    const startTime = log.timeStart('useCall', 'checkActiveCall');
    log.debug('useCall', 'checkActiveCall', 'Checking for active calls', { channelId, dmConversationId });
    
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
        log.error('useCall', 'checkActiveCall', 'Error checking active call', { error });
        console.error('Error checking active call:', error);
        return;
      }

      log.info('useCall', 'checkActiveCall', 'Active call check complete', { 
        hasActiveCall: !!data,
        callId: data?.id 
      });
      setActiveCall(data as Call | null);
    } catch (error) {
      log.error('useCall', 'checkActiveCall', 'Unexpected error checking active call', { error });
      console.error('Error checking active call:', error);
    } finally {
      log.timeEnd('useCall', 'checkActiveCall', startTime, 'Active call check complete');
    }
  };

  const subscribeToCallChanges = () => {
    log.info('useCall', 'subscribeToCallChanges', 'Setting up call change subscription', { 
      channelId, 
      dmConversationId 
    });
    
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
        (payload) => {
          log.debug('useCall', 'onCallChange', 'Call change received', { payload });
          checkActiveCall();
        }
      )
      .subscribe();

    return () => {
      log.info('useCall', 'subscribeToCallChanges', 'Cleaning up call change subscription');
      supabase.removeChannel(channel);
    };
  };

  const startCall = async (type: 'audio' | 'video' = 'video') => {
    const startTime = log.timeStart('useCall', 'startCall');
    log.info('useCall', 'startCall', 'Starting call', { type, channelId, dmConversationId });
    
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        log.error('useCall', 'startCall', 'User not authenticated');
        throw new Error('Not authenticated');
      }

      const roomName = `${channelId || dmConversationId}-${Date.now()}`;
      log.debug('useCall', 'startCall', 'Generated room name', { roomName });

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

      log.debug('useCall', 'startCall', 'Inserting call data', { insertData });

      const { data, error } = await supabase
        .from('calls')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        log.error('useCall', 'startCall', 'Error inserting call', { error });
        throw error;
      }

      log.info('useCall', 'startCall', 'Call started successfully', { callId: data.id });
      setActiveCall(data as Call);
      toast.success('Call started');
      return data;
    } catch (error: any) {
      log.error('useCall', 'startCall', 'Failed to start call', { error });
      console.error('Error starting call:', error);
      toast.error(error.message || 'Failed to start call');
    } finally {
      setLoading(false);
      log.timeEnd('useCall', 'startCall', startTime, 'Call start complete');
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
