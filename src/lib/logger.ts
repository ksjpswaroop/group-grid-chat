/**
 * Comprehensive logging system for debugging execution flows and detecting infinite loops
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogCategory = 'app' | 'channel' | 'hooks' | 'realtime' | 'offline' | 'auth' | 'performance' | 'infinite-loop';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  component: string;
  function: string;
  message: string;
  data?: any;
  stackTrace?: string;
  callCount?: number;
  duration?: number;
}

interface CallTracker {
  [key: string]: {
    count: number;
    lastCall: number;
    calls: number[];
  };
}

class Logger {
  private logs: LogEntry[] = [];
  private callTrackers: CallTracker = {};
  private maxLogs = 1000;
  private isEnabled = true;
  private performanceThreshold = 100; // ms
  private infiniteLoopThreshold = 10; // calls per second
  private infiniteLoopWindow = 1000; // ms

  constructor() {
    // Enable logging in development
    this.isEnabled = process.env.NODE_ENV === 'development' || 
                    localStorage.getItem('debug-logging') === 'true';
    
    // Expose logger to window for debugging
    if (typeof window !== 'undefined') {
      (window as any).logger = this;
    }
  }

  private createLogEntry(
    level: LogLevel,
    category: LogCategory,
    component: string,
    functionName: string,
    message: string,
    data?: any,
    startTime?: number
  ): LogEntry {
    const now = Date.now();
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      component,
      function: functionName,
      message,
      data,
      duration: startTime ? now - startTime : undefined
    };

    // Add stack trace for errors
    if (level === 'error') {
      entry.stackTrace = new Error().stack;
    }

    return entry;
  }

  private trackCall(component: string, functionName: string): void {
    const key = `${component}.${functionName}`;
    const now = Date.now();
    
    if (!this.callTrackers[key]) {
      this.callTrackers[key] = {
        count: 0,
        lastCall: 0,
        calls: []
      };
    }

    const tracker = this.callTrackers[key];
    tracker.count++;
    tracker.lastCall = now;
    tracker.calls.push(now);

    // Remove calls older than our window
    tracker.calls = tracker.calls.filter(callTime => now - callTime < this.infiniteLoopWindow);

    // Check for infinite loop
    if (tracker.calls.length >= this.infiniteLoopThreshold) {
      this.log('error', 'infinite-loop', component, functionName, 
        `POTENTIAL INFINITE LOOP DETECTED: ${tracker.calls.length} calls in ${this.infiniteLoopWindow}ms`, 
        { callCount: tracker.calls.length, calls: tracker.calls });
    }
  }

  private addLog(entry: LogEntry): void {
    if (!this.isEnabled) return;

    this.logs.push(entry);
    
    // Keep only the most recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Console output with colors
    const colorMap = {
      debug: 'color: #888',
      info: 'color: #0066cc',
      warn: 'color: #ff8800',
      error: 'color: #cc0000'
    };

    const style = colorMap[entry.level];
    const prefix = `[${entry.timestamp}] [${entry.category.toUpperCase()}] [${entry.component}.${entry.function}]`;
    
    if (entry.data) {
      console.log(`%c${prefix} ${entry.message}`, style, entry.data);
    } else {
      console.log(`%c${prefix} ${entry.message}`, style);
    }

    // Performance warnings
    if (entry.duration && entry.duration > this.performanceThreshold) {
      console.warn(`%c⚠️ SLOW OPERATION: ${entry.component}.${entry.function} took ${entry.duration}ms`, 'color: #ff8800');
    }
  }

  log(
    level: LogLevel,
    category: LogCategory,
    component: string,
    functionName: string,
    message: string,
    data?: any,
    startTime?: number
  ): void {
    this.trackCall(component, functionName);
    const entry = this.createLogEntry(level, category, component, functionName, message, data, startTime);
    this.addLog(entry);
  }

  debug(component: string, functionName: string, message: string, data?: any): void {
    this.log('debug', 'app', component, functionName, message, data);
  }

  info(component: string, functionName: string, message: string, data?: any): void {
    this.log('info', 'app', component, functionName, message, data);
  }

  warn(component: string, functionName: string, message: string, data?: any): void {
    this.log('warn', 'app', component, functionName, message, data);
  }

  error(component: string, functionName: string, message: string, data?: any): void {
    this.log('error', 'app', component, functionName, message, data);
  }

  // Performance tracking
  timeStart(component: string, functionName: string): number {
    return Date.now();
  }

  timeEnd(component: string, functionName: string, startTime: number, message?: string): void {
    const duration = Date.now() - startTime;
    this.log('info', 'performance', component, functionName, 
      message || `Operation completed`, undefined, startTime);
  }

  // Hook for tracking function calls
  trackFunction<T extends (...args: any[]) => any>(
    component: string,
    functionName: string,
    fn: T,
    category: LogCategory = 'app'
  ): T {
    return ((...args: any[]) => {
      const startTime = this.timeStart(component, functionName);
      this.log('debug', category, component, functionName, 'Function called', { args });
      
      try {
        const result = fn(...args);
        
        // Handle promises
        if (result && typeof result.then === 'function') {
          return result.then((res: any) => {
            this.timeEnd(component, functionName, startTime, 'Async function completed');
            this.log('debug', category, component, functionName, 'Async function resolved', { result: res });
            return res;
          }).catch((err: any) => {
            this.log('error', category, component, functionName, 'Async function rejected', { error: err });
            throw err;
          });
        }
        
        this.timeEnd(component, functionName, startTime, 'Function completed');
        this.log('debug', category, component, functionName, 'Function returned', { result });
        return result;
      } catch (error) {
        this.log('error', category, component, functionName, 'Function threw error', { error });
        throw error;
      }
    }) as T;
  }

  // Get logs for debugging
  getLogs(category?: LogCategory, component?: string): LogEntry[] {
    let filtered = this.logs;
    
    if (category) {
      filtered = filtered.filter(log => log.category === category);
    }
    
    if (component) {
      filtered = filtered.filter(log => log.component === component);
    }
    
    return filtered;
  }

  // Get call statistics
  getCallStats(): { [key: string]: { count: number; lastCall: number; callsPerSecond: number } } {
    const stats: { [key: string]: { count: number; lastCall: number; callsPerSecond: number } } = {};
    
    Object.entries(this.callTrackers).forEach(([key, tracker]) => {
      const now = Date.now();
      const recentCalls = tracker.calls.filter(callTime => now - callTime < 1000);
      stats[key] = {
        count: tracker.count,
        lastCall: tracker.lastCall,
        callsPerSecond: recentCalls.length
      };
    });
    
    return stats;
  }

  // Clear logs
  clear(): void {
    this.logs = [];
    this.callTrackers = {};
  }

  // Export logs for debugging
  exportLogs(): string {
    return JSON.stringify({
      logs: this.logs,
      callStats: this.getCallStats(),
      timestamp: new Date().toISOString()
    }, null, 2);
  }

  // Enable/disable logging
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    localStorage.setItem('debug-logging', enabled.toString());
  }
}

// Export singleton instance
export const logger = new Logger();

// Helper function for easy logging
export const log = {
  debug: (component: string, functionName: string, message: string, data?: any) => 
    logger.debug(component, functionName, message, data),
  info: (component: string, functionName: string, message: string, data?: any) => 
    logger.info(component, functionName, message, data),
  warn: (component: string, functionName: string, message: string, data?: any) => 
    logger.warn(component, functionName, message, data),
  error: (component: string, functionName: string, message: string, data?: any) => 
    logger.error(component, functionName, message, data),
  timeStart: (component: string, functionName: string) => 
    logger.timeStart(component, functionName),
  timeEnd: (component: string, functionName: string, startTime: number, message?: string) => 
    logger.timeEnd(component, functionName, startTime, message),
  track: <T extends (...args: any[]) => any>(
    component: string,
    functionName: string,
    fn: T,
    category: LogCategory = 'app'
  ) => logger.trackFunction(component, functionName, fn, category)
};