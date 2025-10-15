import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';
import { log } from '@/lib/logger';

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
    this.config = {
      reconnectDelay: 1000,
      maxReconnectAttempts: 5,
      ...config
    };
    
    this.initializePresence();
  }

  private async initializePresence() {
    log.info('RealtimeManager', 'initializePresence', 'Initializing presence tracking');
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      log.warn('RealtimeManager', 'initializePresence', 'No user found, skipping presence init');
      return;
    }
    
    this.currentUserId = user.id;
    log.debug('RealtimeManager', 'initializePresence', 'User found, setting up presence', { userId: user.id });
    
    await supabase
      .from('user_presence')
      .upsert({
        user_id: user.id,
        status: 'online',
        last_seen: new Date().toISOString()
      });

    setInterval(() => {
      log.debug('RealtimeManager', 'presenceInterval', 'Periodic presence update');
      this.updatePresence('online');
    }, 30000);

    document.addEventListener('visibilitychange', () => {
      log.debug('RealtimeManager', 'visibilityChange', 'Visibility changed', { hidden: document.hidden });
      if (document.hidden) {
        this.updatePresence('away');
      } else {
        this.updatePresence('online');
      }
    });

    window.addEventListener('beforeunload', () => {
      log.info('RealtimeManager', 'beforeUnload', 'Page unloading, setting offline');
      this.updatePresence('offline');
    });
  }

  async updatePresence(status: PresenceStatus) {
    if (!this.currentUserId) {
      log.warn('RealtimeManager', 'updatePresence', 'No current user ID, skipping presence update');
      return;
    }
    
    log.debug('RealtimeManager', 'updatePresence', 'Updating presence', { 
      userId: this.currentUserId, 
      status 
    });
    
    try {
      await supabase
        .from('user_presence')
        .upsert({
          user_id: this.currentUserId,
          status,
          last_seen: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        
      log.debug('RealtimeManager', 'updatePresence', 'Presence updated successfully');
    } catch (error) {
      log.error('RealtimeManager', 'updatePresence', 'Failed to update presence', { error });
    }
  }

  private updateConnectionState(state: ConnectionState) {
    this.connectionState = state;
    this.config.onConnectionChange?.(state);
    log.info('RealtimeManager', 'updateConnectionState', 'Connection state changed', { state });
  }

  subscribeToChannel(
    channelName: string,
    options: {
      onMessage?: (payload: any) => void;
      filter?: { event: string; schema: string; table: string; filter?: string };
    }
  ): RealtimeChannel {
    log.info('RealtimeManager', 'subscribeToChannel', 'Subscribing to channel', { 
      channelName, 
      hasFilter: !!options.filter 
    });
    
    if (this.channels.has(channelName)) {
      log.debug('RealtimeManager', 'subscribeToChannel', 'Channel already exists, returning existing', { channelName });
      return this.channels.get(channelName)!;
    }

    this.updateConnectionState('connecting');

    const channel = supabase.channel(channelName);

    if (options.filter) {
      log.debug('RealtimeManager', 'subscribeToChannel', 'Setting up filter', { 
        channelName, 
        filter: options.filter 
      });
      channel.on(
        'postgres_changes' as any,
        options.filter as any,
        (payload: any) => {
          log.debug('RealtimeManager', 'onMessage', 'Message received', { 
            channelName, 
            payload 
          });
          options.onMessage?.(payload);
        }
      );
    }

    channel.subscribe((status) => {
      log.info('RealtimeManager', 'onSubscribe', 'Channel subscription status changed', { 
        channelName, 
        status 
      });
      
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
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts!) {
      log.error('RealtimeManager', 'handleReconnect', 'Max reconnect attempts reached', { 
        channelName, 
        attempts: this.reconnectAttempts 
      });
      this.config.onError?.(new Error('Max reconnect attempts reached'));
      return;
    }

    this.reconnectAttempts++;
    const delay = this.config.reconnectDelay! * Math.pow(2, this.reconnectAttempts - 1);
    
    log.warn('RealtimeManager', 'handleReconnect', 'Scheduling reconnect', { 
      channelName, 
      delay, 
      attempt: this.reconnectAttempts 
    });

    setTimeout(() => {
      log.info('RealtimeManager', 'handleReconnect', 'Executing reconnect', { channelName });
      this.unsubscribeFromChannel(channelName);
      this.subscribeToChannel(channelName, options);
    }, delay);
  }

  unsubscribeFromChannel(channelName: string) {
    const channel = this.channels.get(channelName);
    if (channel) {
      channel.unsubscribe();
      this.channels.delete(channelName);
      log.info('RealtimeManager', 'unsubscribeFromChannel', 'Unsubscribed from channel', { channelName });
    } else {
      log.warn('RealtimeManager', 'unsubscribeFromChannel', 'Channel not found for unsubscribe', { channelName });
    }
  }

  async sendMessage(channelName: string, event: string, payload: any) {
    if (this.connectionState !== 'connected') {
      log.debug('RealtimeManager', 'sendMessage', 'Queueing message (not connected)', { 
        channelName, 
        event 
      });
      this.messageQueue.push({ channel: channelName, event, payload });
      return;
    }

    const channel = this.channels.get(channelName);
    if (channel) {
      log.debug('RealtimeManager', 'sendMessage', 'Sending message', { 
        channelName, 
        event 
      });
      channel.send({
        type: 'broadcast',
        event,
        payload
      });
    } else {
      log.warn('RealtimeManager', 'sendMessage', 'Channel not found for sending', { channelName });
    }
  }

  private flushMessageQueue() {
    log.info('RealtimeManager', 'flushMessageQueue', 'Flushing queued messages', { 
      count: this.messageQueue.length 
    });
    while (this.messageQueue.length > 0) {
      const { channel, event, payload } = this.messageQueue.shift()!;
      this.sendMessage(channel, event, payload);
    }
  }

  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  cleanup() {
    log.info('RealtimeManager', 'cleanup', 'Cleaning up all channels', { 
      channelCount: this.channels.size 
    });
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
    realtimeManager = new RealtimeManager(config);
  }
  return realtimeManager;
};

export const cleanupRealtimeManager = () => {
  if (realtimeManager) {
    realtimeManager.cleanup();
    realtimeManager = null;
  }
};
