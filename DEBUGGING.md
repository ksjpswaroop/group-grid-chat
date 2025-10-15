# Debugging and Flow Tracking System

This document describes the comprehensive logging and debugging system implemented to track execution flows, detect infinite loops, and monitor performance issues.

## Features

### 1. Comprehensive Logging System (`src/lib/logger.ts`)

- **Multi-level logging**: debug, info, warn, error
- **Categorized logging**: app, channel, hooks, realtime, offline, auth, performance, infinite-loop
- **Performance tracking**: Automatic timing of operations
- **Infinite loop detection**: Tracks function call frequency and alerts on potential loops
- **Call statistics**: Monitors function call patterns and frequency

### 2. Debug Panel (`src/components/DebugPanel.tsx`)

A visual interface to monitor the application's behavior in real-time:

- **Logs Tab**: View all application logs with filtering and search
- **Call Stats Tab**: Monitor function call frequency and patterns
- **Infinite Loops Tab**: Detect and alert on potential infinite loops
- **Performance Tab**: Identify slow operations and performance bottlenecks

### 3. Enhanced Component Logging

All major components now include detailed logging:

- **App Component**: Application lifecycle, performance metrics, memory usage
- **Channel Component**: Message handling, realtime subscriptions, user interactions
- **Hooks**: usePresenceUpdater, useCall, and other custom hooks
- **RealtimeManager**: Connection state, message handling, reconnection logic
- **OfflineQueue**: Message queuing and processing

## Usage

### Accessing the Debug Panel

1. **Keyboard Shortcut**: Press `Ctrl+Shift+D` to open the debug panel
2. **Programmatic**: The debug panel can be opened programmatically by setting `showDebugPanel` state

### Logging in Your Code

```typescript
import { log } from '@/lib/logger';

// Basic logging
log.info('ComponentName', 'functionName', 'Message', { data });

// Performance tracking
const startTime = log.timeStart('ComponentName', 'functionName');
// ... your code ...
log.timeEnd('ComponentName', 'functionName', startTime, 'Operation completed');

// Function tracking
const trackedFunction = log.track('ComponentName', 'functionName', originalFunction, 'category');
```

### Infinite Loop Detection

The system automatically detects potential infinite loops by:
- Tracking function call frequency
- Alerting when a function is called more than 10 times per second
- Providing visual indicators in the debug panel

### Performance Monitoring

- Operations taking longer than 100ms are flagged
- Memory usage is logged every 30 seconds
- Slow operations are highlighted in the debug panel

## Configuration

### Enabling/Disabling Logging

```typescript
// Enable logging
logger.setEnabled(true);

// Disable logging
logger.setEnabled(false);

// Check if enabled
const isEnabled = logger.isEnabled;
```

### Adjusting Thresholds

```typescript
// In logger.ts, you can adjust these thresholds:
const performanceThreshold = 100; // ms - flag operations slower than this
const infiniteLoopThreshold = 10; // calls per second - flag functions called more frequently
const infiniteLoopWindow = 1000; // ms - time window for call counting
```

## Debug Panel Features

### Logs Tab
- Real-time log viewing
- Color-coded by log level
- Filterable by category and component
- Shows performance timing
- Displays associated data

### Call Stats Tab
- Function call frequency monitoring
- Total call counts
- Calls per second tracking
- Visual alerts for high-frequency calls

### Infinite Loops Tab
- Automatic detection of potential infinite loops
- Red alerts for functions called too frequently
- Detailed call pattern analysis

### Performance Tab
- Slow operation detection
- Duration tracking
- Performance bottleneck identification

## Export and Analysis

### Exporting Logs
- Click "Export" in the debug panel to download all logs as JSON
- Includes call statistics and performance data
- Useful for offline analysis and bug reports

### Clearing Logs
- Click "Clear" to reset all logs and statistics
- Useful for starting fresh debugging sessions

## Best Practices

### 1. Logging Guidelines
- Use appropriate log levels (debug for detailed info, error for failures)
- Include relevant context data
- Use consistent component and function naming
- Don't log sensitive information

### 2. Performance Considerations
- Logging is automatically disabled in production builds
- Use debug level for verbose logging that can be disabled
- Be mindful of logging frequency in hot paths

### 3. Debugging Workflow
1. Open the debug panel when investigating issues
2. Monitor the "Infinite Loops" tab for immediate issues
3. Check the "Performance" tab for slow operations
4. Use the "Logs" tab to trace execution flow
5. Export logs for detailed analysis if needed

## Troubleshooting

### Common Issues

1. **High Memory Usage**: Check the performance tab for memory leaks
2. **Slow Performance**: Look for operations flagged in the performance tab
3. **Infinite Loops**: Check the infinite loops tab for functions called too frequently
4. **Missing Logs**: Ensure logging is enabled and check the browser console

### Debug Panel Not Opening
- Ensure you're using the correct keyboard shortcut (Ctrl+Shift+D)
- Check that the component is properly imported and rendered
- Verify the debug panel state is being managed correctly

## Integration with Development Tools

The logging system integrates with:
- Browser DevTools console
- React DevTools
- Performance monitoring tools
- Error tracking services

## Future Enhancements

Potential improvements:
- Log persistence across page reloads
- Advanced filtering and search capabilities
- Integration with external monitoring services
- Automated performance regression detection
- Real-time collaboration debugging features