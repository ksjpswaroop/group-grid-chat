import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

export type ConnectionState = 'connected' | 'connecting' | 'disconnected' | 'error';
export type PresenceStatus = 'online' | 'away' | 'dnd' | 'offline';

interface RealtimeManagerConfig {
  onConnectionChange?: (state: ConnectionState) => void;
  onError?: (error: Error) => void;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
}

export class RealtimeManager {
  private channels: Map<string, RealtimeChannel> = new Map();
  private connectionState: ConnectionState = 'disconnected';
  private reconnectAttempts = 0;
  private config: RealtimeManagerConfig;
  private messageQueue: Array<{ channel: string; event: string; payload: any }> = [];
  private currentUserId: string | null = null;

  constructor(config: RealtimeManagerConfig = {}) {
    console.log('[RealtimeManager] Constructor called');
    this.config = {
      reconnectDelay: 1000,
      maxReconnectAttempts: 5,
      ...config
    };
    
    console.log('[RealtimeManager] Initializing presence');
    this.initializePresence();
  }

  private async initializePresence() {
    console.log('[RealtimeManager] initializePresence started');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log('[RealtimeManager] No user found, skipping presence initialization');
      return;
    }
    
    console.log('[RealtimeManager] Setting up presence for user:', user.id);
    this.currentUserId = user.id;
    
    console.log('[RealtimeManager] Upserting user presence to online');
    await supabase
      .from('user_presence')
      .upsert({
        user_id: user.id,
        status: 'online',
        last_seen: new Date().toISOString()
      });

    console.log('[RealtimeManager] Setting up 30s presence update interval');
    setInterval(() => {
      console.log('[RealtimeManager] Periodic presence update (30s)');
      this.updatePresence('online');
    }, 30000);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.updatePresence('away');
      } else {
        this.updatePresence('online');
      }
    });

    window.addEventListener('beforeunload', () => {
      this.updatePresence('offline');
    });
  }

  async updatePresence(status: PresenceStatus) {
    if (!this.currentUserId) {
      console.log('[RealtimeManager] updatePresence: No currentUserId, skipping');
      return;
    }
    
    console.log('[RealtimeManager] updatePresence:', status, 'for user:', this.currentUserId);
    await supabase
      .from('user_presence')
      .upsert({
        user_id: this.currentUserId,
        status,
        last_seen: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
  }

  private updateConnectionState(state: ConnectionState) {
    this.connectionState = state;
    this.config.onConnectionChange?.(state);
    console.log(`[RealtimeManager] Connection state: ${state}`);
  }

  subscribeToChannel(
    channelName: string,
    options: {
      onMessage?: (payload: any) => void;
      filter?: { event: string; schema: string; table: string; filter?: string };
    }
  ): RealtimeChannel {
    console.log('[RealtimeManager] subscribeToChannel called:', channelName);
    
    if (this.channels.has(channelName)) {
      console.log('[RealtimeManager] Channel already exists, returning existing:', channelName);
      return this.channels.get(channelName)!;
    }

    console.log('[RealtimeManager] Creating new channel subscription:', channelName);
    this.updateConnectionState('connecting');

    const channel = supabase.channel(channelName);

    if (options.filter) {
      channel.on(
        'postgres_changes' as any,
        options.filter as any,
        (payload: any) => {
          console.log(`[RealtimeManager] Message received on ${channelName}:`, payload);
          options.onMessage?.(payload);
        }
      );
    }

    channel.subscribe((status) => {
      console.log(`[RealtimeManager] Channel ${channelName} status:`, status);
      
      if (status === 'SUBSCRIBED') {
        this.updateConnectionState('connected');
        this.reconnectAttempts = 0;
        this.flushMessageQueue();
      } else if (status === 'CHANNEL_ERROR') {
        this.updateConnectionState('error');
        this.handleReconnect(channelName, options);
      } else if (status === 'TIMED_OUT') {
        this.updateConnectionState('disconnected');
        this.handleReconnect(channelName, options);
      }
    });

    this.channels.set(channelName, channel);
    return channel;
  }

  private handleReconnect(channelName: string, options: any) {
    console.log('[RealtimeManager] handleReconnect called for:', channelName, 'attempt:', this.reconnectAttempts);
    
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts!) {
      console.error(`[RealtimeManager] ⚠️ Max reconnect attempts reached for ${channelName}`);
      this.config.onError?.(new Error('Max reconnect attempts reached'));
      return;
    }

    this.reconnectAttempts++;
    const delay = this.config.reconnectDelay! * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`[RealtimeManager] Reconnecting ${channelName} in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      this.unsubscribeFromChannel(channelName);
      this.subscribeToChannel(channelName, options);
    }, delay);
  }

  unsubscribeFromChannel(channelName: string) {
    const channel = this.channels.get(channelName);
    if (channel) {
      channel.unsubscribe();
      this.channels.delete(channelName);
      console.log(`[RealtimeManager] Unsubscribed from ${channelName}`);
    }
  }

  async sendMessage(channelName: string, event: string, payload: any) {
    if (this.connectionState !== 'connected') {
      console.log(`[RealtimeManager] Queueing message for ${channelName}`);
      this.messageQueue.push({ channel: channelName, event, payload });
      return;
    }

    const channel = this.channels.get(channelName);
    if (channel) {
      channel.send({
        type: 'broadcast',
        event,
        payload
      });
    }
  }

  private flushMessageQueue() {
    console.log(`[RealtimeManager] Flushing ${this.messageQueue.length} queued messages`);
    while (this.messageQueue.length > 0) {
      const { channel, event, payload } = this.messageQueue.shift()!;
      this.sendMessage(channel, event, payload);
    }
  }

  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  cleanup() {
    console.log('[RealtimeManager] Cleaning up all channels');
    this.channels.forEach((_, channelName) => {
      this.unsubscribeFromChannel(channelName);
    });
    if (this.currentUserId) {
      this.updatePresence('offline');
    }
  }
}

let realtimeManager: RealtimeManager | null = null;

export const getRealtimeManager = (config?: RealtimeManagerConfig): RealtimeManager => {
  if (!realtimeManager) {
    console.log('[getRealtimeManager] Creating new RealtimeManager instance');
    realtimeManager = new RealtimeManager(config);
  } else {
    console.log('[getRealtimeManager] Returning existing RealtimeManager instance');
  }
  return realtimeManager;
};

export const cleanupRealtimeManager = () => {
  if (realtimeManager) {
    realtimeManager.cleanup();
    realtimeManager = null;
  }
};
