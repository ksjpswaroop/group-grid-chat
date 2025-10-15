/**
 * Offline message queue for storing messages when network is unavailable
 * Messages are persisted to localStorage and sent when connection is restored
 */

import { log } from '@/lib/logger';

interface QueuedMessage {
  id: string;
  channelId: string;
  content: string;
  timestamp: number;
  retryCount: number;
}

const QUEUE_KEY = 'teamsync_offline_messages';
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 seconds

class OfflineQueue {
  private queue: QueuedMessage[] = [];
  private processing = false;
  private listeners: Set<() => void> = new Set();

  constructor() {
    log.info('OfflineQueue', 'constructor', 'Initializing offline queue');
    this.loadQueue();
    // Listen for online/offline events
    window.addEventListener('online', () => {
      log.info('OfflineQueue', 'online', 'Network online, processing queue');
      this.processQueue();
    });
    window.addEventListener('offline', () => {
      log.info('OfflineQueue', 'offline', 'Network offline, queueing messages');
      this.notifyListeners();
    });
  }

  /**
   * Add a message to the offline queue
   */
  add(channelId: string, content: string): string {
    const message: QueuedMessage = {
      id: crypto.randomUUID(),
      channelId,
      content,
      timestamp: Date.now(),
      retryCount: 0,
    };
    
    log.info('OfflineQueue', 'add', 'Adding message to queue', { 
      messageId: message.id, 
      channelId, 
      contentLength: content.length 
    });
    
    this.queue.push(message);
    this.saveQueue();
    this.notifyListeners();
    
    // Try to process immediately (will check network status)
    this.processQueue();
    
    return message.id;
  }

  /**
   * Get all queued messages for a specific channel
   */
  getForChannel(channelId: string): QueuedMessage[] {
    return this.queue.filter(msg => msg.channelId === channelId);
  }

  /**
   * Get total count of queued messages
   */
  getCount(): number {
    return this.queue.length;
  }

  /**
   * Check if device is online
   */
  isOnline(): boolean {
    return navigator.onLine;
  }

  /**
   * Register a listener for queue changes
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Process the queue (send all pending messages)
   */
  async processQueue(): Promise<void> {
    if (this.processing || !this.isOnline() || this.queue.length === 0) {
      log.debug('OfflineQueue', 'processQueue', 'Skipping queue processing', { 
        processing: this.processing, 
        online: this.isOnline(), 
        queueLength: this.queue.length 
      });
      return;
    }

    const startTime = log.timeStart('OfflineQueue', 'processQueue');
    log.info('OfflineQueue', 'processQueue', 'Processing offline queue', { 
      messageCount: this.queue.length 
    });

    this.processing = true;

    const messagesToProcess = [...this.queue];
    
    for (const message of messagesToProcess) {
      try {
        log.debug('OfflineQueue', 'processQueue', 'Processing message', { 
          messageId: message.id, 
          retryCount: message.retryCount 
        });
        
        // This will be called by the Channel component
        const success = await this.sendMessage(message);
        
        if (success) {
          log.info('OfflineQueue', 'processQueue', 'Message sent successfully', { messageId: message.id });
          this.remove(message.id);
        } else {
          message.retryCount++;
          if (message.retryCount >= MAX_RETRIES) {
            log.error('OfflineQueue', 'processQueue', 'Max retries reached for message', { message });
            console.error('Max retries reached for message:', message);
            this.remove(message.id);
          } else {
            log.warn('OfflineQueue', 'processQueue', 'Message send failed, will retry', { 
              messageId: message.id, 
              retryCount: message.retryCount 
            });
          }
        }
      } catch (error) {
        log.error('OfflineQueue', 'processQueue', 'Error processing queued message', { error, messageId: message.id });
        console.error('Error processing queued message:', error);
        message.retryCount++;
        if (message.retryCount >= MAX_RETRIES) {
          this.remove(message.id);
        }
      }
      
      await this.delay(RETRY_DELAY);
    }

    this.processing = false;
    this.saveQueue();
    this.notifyListeners();
    
    log.timeEnd('OfflineQueue', 'processQueue', startTime, 'Queue processing complete');
  }

  /**
   * Send a single message (to be implemented by consumer)
   */
  private async sendMessage(message: QueuedMessage): Promise<boolean> {
    // This is a placeholder - actual implementation will be in Channel component
    // Return false to retry, true if sent successfully
    return false;
  }

  /**
   * Set the send function from external component
   */
  setSendFunction(fn: (message: QueuedMessage) => Promise<boolean>) {
    this.sendMessage = fn;
  }

  private remove(messageId: string): void {
    this.queue = this.queue.filter(msg => msg.id !== messageId);
    this.saveQueue();
    this.notifyListeners();
  }

  private loadQueue(): void {
    try {
      const stored = localStorage.getItem(QUEUE_KEY);
      if (stored) {
        this.queue = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error loading offline queue:', error);
      this.queue = [];
    }
  }

  private saveQueue(): void {
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(this.queue));
    } catch (error) {
      console.error('Error saving offline queue:', error);
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clear all queued messages (use with caution)
   */
  clear(): void {
    this.queue = [];
    this.saveQueue();
    this.notifyListeners();
  }
}

// Export singleton instance
export const offlineQueue = new OfflineQueue();
