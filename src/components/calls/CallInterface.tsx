import { useEffect, useState } from 'react';
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { Room } from 'livekit-client';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { toast } from 'sonner';

interface CallInterfaceProps {
  callId: string;
  roomName: string;
  onLeave: () => void;
  audioDeviceId?: string;
  videoDeviceId?: string;
  videoEnabled?: boolean;
}

export default function CallInterface({
  callId,
  roomName,
  onLeave,
  audioDeviceId,
  videoDeviceId,
  videoEnabled = true,
}: CallInterfaceProps) {
  const [token, setToken] = useState<string>('');
  const [serverUrl, setServerUrl] = useState<string>('');
  const [room, setRoom] = useState<Room>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchToken();
    return () => {
      if (room) {
        room.disconnect();
      }
    };
  }, []);

  const fetchToken = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('create-livekit-token', {
        body: { roomName, callId },
      });

      if (error) throw error;

      // Get LiveKit server URL from config
      const { data: config, error: configError } = await supabase
        .from('livekit_config')
        .select('api_url')
        .limit(1)
        .maybeSingle();

      if (configError) {
        console.error('Error fetching config:', configError);
        throw new Error('Failed to fetch LiveKit configuration');
      }

      if (!config) {
        throw new Error('LiveKit not configured. Please configure LiveKit in Admin settings.');
      }

      setToken(data.token);
      setServerUrl(config.api_url);
    } catch (error: any) {
      console.error('Error fetching token:', error);
      toast.error(error.message || 'Failed to join call');
      onLeave();
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    // Update participant left time
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from('call_participants')
        .update({ left_at: new Date().toISOString() })
        .eq('call_id', callId)
        .eq('user_id', user.id);
    }
    onLeave();
  };

  if (loading) {
    return (
      <Dialog open>
        <DialogContent className="sm:max-w-[400px]">
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="text-sm text-muted-foreground">Connecting to call...</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!token) {
    return null;
  }

  return (
    <Dialog open onOpenChange={handleDisconnect}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] p-0">
        <LiveKitRoom
          video={videoEnabled}
          audio={true}
          token={token}
          serverUrl={serverUrl}
          connect={true}
          onDisconnected={handleDisconnect}
          onConnected={() => {
            console.log('Connected to room');
          }}
          options={{
            audioCaptureDefaults: {
              deviceId: audioDeviceId,
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
            videoCaptureDefaults: {
              deviceId: videoDeviceId,
            },
          }}
        >
          <VideoConference />
          <RoomAudioRenderer />
        </LiveKitRoom>
      </DialogContent>
    </Dialog>
  );
}
