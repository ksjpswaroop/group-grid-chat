# Debugging Guide: Execution Flows and Infinite Loop Detection

This document outlines the comprehensive logging system added to track execution flows and identify infinite loops or excessive function calls in the application.

## Overview

Logging has been added to all major components, hooks, and services to help identify:
- **Infinite loops**: Detected when a function is called more than 10 times
- **Recursive calls**: Stack traces are logged when thresholds are exceeded
- **State changes**: All state updates are logged with context
- **Realtime subscriptions**: All subscription events are tracked
- **Performance issues**: Excessive function calls that may impact performance

## 🔍 Key Areas Instrumented

### 1. **Channel.tsx** (Main Channel Component)
**Location**: `/workspace/src/pages/Channel.tsx`

**Logged Operations**:
- Component rendering with channelId
- Main useEffect initialization flow (6 steps)
- Realtime subscription setup for messages, reactions, and threads
- Message loading with call counter (⚠️ alerts after 10 calls)
- Reactions loading with call counter (⚠️ alerts after 10 calls)
- Thread reply counts loading with call counter (⚠️ alerts after 10 calls)
- Channel cleanup and unsubscription

**Watch For**:
```
⚠️ INFINITE LOOP DETECTED: loadMessages called more than 10 times!
⚠️ INFINITE LOOP DETECTED: loadReactionsForMessages called more than 10 times!
⚠️ INFINITE LOOP DETECTED: loadThreadReplyCounts called more than 10 times!
```

**Common Issues**:
- `useEffect` at line 231 depends on `messages` array and calls `loadReactionsForMessages()` and `loadThreadReplyCounts()`
- Realtime subscriptions (lines 157-168) call `loadMessages()` which updates `messages` state
- This can create a loop: messages change → useEffect fires → state updates → messages change again

### 2. **DirectMessage.tsx** (Direct Messages Component)
**Location**: `/workspace/src/pages/DirectMessage.tsx`

**Logged Operations**:
- Component rendering with userId
- Main useEffect initialization
- Realtime subscription for direct messages and reactions
- Message loading with call counter (⚠️ alerts after 10 calls)
- Reactions loading with call counter (⚠️ alerts after 10 calls)
- DM conversation creation with call counter (⚠️ alerts after 5 calls)

**Watch For**:
```
⚠️ INFINITE LOOP DETECTED: loadMessages called more than 10 times!
⚠️ INFINITE LOOP DETECTED: loadReactionsForMessages called more than 10 times!
⚠️ INFINITE LOOP DETECTED: loadOrCreateDmConversation called more than 5 times!
```

**Common Issues**:
- Similar pattern to Channel.tsx with messages triggering reactions reload
- DM conversation creation might retry excessively if there are database issues

### 3. **RealtimeManager** (Realtime Service)
**Location**: `/workspace/src/lib/realtime.ts`

**Logged Operations**:
- Manager construction and initialization
- Presence initialization and updates (every 30 seconds)
- Channel subscription with connection state tracking
- Reconnection attempts with exponential backoff
- Message queueing and flushing
- Channel cleanup

**Watch For**:
```
⚠️ Max reconnect attempts reached for [channel-name]
```

**Common Issues**:
- Presence updates run every 30 seconds - check for excessive database writes
- Reconnection logic uses exponential backoff - verify delays are appropriate
- Singleton pattern ensures only one instance exists

### 4. **usePresence Hook** (User Presence Tracking)
**Location**: `/workspace/src/hooks/usePresence.ts`

**Logged Operations**:
- Hook initialization with userIds filter
- Presence data loading
- Realtime subscription to presence changes
- Presence map updates

**Common Issues**:
- Updates presence map on every change - could trigger re-renders
- Depends on `userIds?.join(',')` which changes if array reference changes

### 5. **usePresenceUpdater Hook** (Presence Updates)
**Location**: `/workspace/src/hooks/usePresenceUpdater.ts`

**Logged Operations**:
- Hook mounting and initial presence set to 'online'
- Visibility change detection (away/online)
- User activity detection (mouse, keyboard, scroll, touch)
- Periodic updates every 2 minutes
- Cleanup and offline status

**Common Issues**:
- Updates presence on EVERY user activity event - could be excessive
- Two separate intervals: 30s in RealtimeManager + 2min in this hook
- Multiple event listeners could cause performance issues

### 6. **useCall Hook** (Voice/Video Calls)
**Location**: `/workspace/src/hooks/useCall.ts`

**Logged Operations**:
- Hook initialization with channelId/dmConversationId
- Active call checking
- Realtime subscription to call changes
- Call start/end operations

**Common Issues**:
- useEffect depends on both channelId and dmConversationId
- Subscribes to call changes which triggers checkActiveCall()
- checkActiveCall() sets state which could trigger re-subscription

### 7. **useTypingIndicator Hook** (Typing Status)
**Location**: `/workspace/src/hooks/useTypingIndicator.ts`

**Logged Operations**:
- Hook initialization with channelId
- Current user loading
- Realtime subscription to typing indicators
- Start/stop typing operations
- Auto-removal of typing status after 3 seconds

**Common Issues**:
- useEffect depends on both channelId AND currentUserId
- When currentUserId changes, entire subscription is recreated
- Multiple setTimeout calls could stack up

## 🔥 Known Potential Infinite Loop Patterns

### Pattern 1: Message Loading Loop
```
Channel loads → loadMessages() → messages state updates → 
useEffect(messages) → loadReactionsForMessages() → 
state updates → messages array reference changes → 
useEffect(messages) fires again
```

**Solution**: Use `useMemo` or ensure state updates don't change array references unnecessarily.

### Pattern 2: Presence Update Loop
```
usePresenceUpdater sets online → updates database → 
usePresence receives change → updates presenceMap → 
component re-renders → usePresenceUpdater effect runs again
```

**Solution**: Ensure presence updates only happen when status actually changes, not on every render.

### Pattern 3: Realtime Subscription Recreation
```
Component mounts → creates subscription → 
state change → dependency changes → 
useEffect cleanup → creates new subscription
```

**Solution**: Stabilize dependencies using refs or memoization.

## 📊 How to Debug

### Step 1: Open Browser Console
All logs are prefixed with their source in brackets, e.g., `[Channel]`, `[useCall]`, etc.

### Step 2: Filter Logs
Use browser console filtering:
- `[Channel]` - See all channel-related logs
- `⚠️` - See all warnings and infinite loop alerts
- `INFINITE LOOP` - See only infinite loop detections

### Step 3: Check Call Counts
Look for patterns like:
```
[Channel] loadMessages called, count: 1
[Channel] loadMessages called, count: 2
[Channel] loadMessages called, count: 3
...
```

If count increases rapidly without user interaction, there's a loop.

### Step 4: Examine Stack Traces
When infinite loops are detected, stack traces are automatically logged:
```
⚠️ INFINITE LOOP DETECTED: loadMessages called more than 10 times!
[Channel] Stack trace:
  at loadMessages (Channel.tsx:278)
  at useEffect (Channel.tsx:165)
  ...
```

### Step 5: Check Realtime Events
Look for excessive realtime events:
```
[RealtimeManager] Message received on messages-123
[Channel] Realtime message received, reloading messages
```

If these appear in rapid succession, check:
- Database triggers
- RLS policies that might cause cascading updates
- Circular realtime event chains

## 🛠️ Debugging Commands

### Count specific log occurrences in last 100 logs:
```javascript
console.log(
  performance.getEntriesByType('measure')
    .filter(e => e.name.includes('loadMessages'))
    .length
);
```

### Monitor state changes:
All major state changes are logged. Search for "Setting" or "Updating":
- "Setting presence map"
- "Updating presence map"
- "Setting messages"

### Track subscription lifecycle:
Search for:
- "Setting up realtime subscription"
- "Cleanup: Unsubscribing"

Count subscriptions vs cleanups - they should match!

## 🚨 Emergency Fixes

If you encounter an infinite loop in production:

1. **Quick Fix**: Comment out the problematic `useEffect` temporarily
2. **Add Debouncing**: Use `useDebounce` or `throttle` on frequently called functions
3. **Stabilize Dependencies**: Convert dependencies to refs or add proper memoization
4. **Break Circular Dependencies**: Ensure realtime events don't trigger actions that cause more realtime events

## 📈 Performance Monitoring

Watch these metrics in console:
- Call counts should stabilize after initial load
- No function should be called more than 5-10 times per user action
- Presence updates should happen at most every 30 seconds when idle
- Message loads should only happen on:
  - Initial page load
  - New message received
  - Manual user action (refresh)

## ✅ Success Indicators

Your app is healthy when you see:
- ✅ Call counts remain at 1-2 for most operations
- ✅ No infinite loop warnings
- ✅ Realtime events are infrequent and purposeful
- ✅ Subscriptions are created once and cleaned up on unmount
- ✅ State updates happen only when necessary

## 🐛 Common Debugging Scenarios

### Scenario 1: Page won't load, infinite loading spinner
**Look for**: Excessive loadMessages calls or useEffect recreation
**Check**: Dependencies in useEffect hooks

### Scenario 2: Messages load but then disappear
**Look for**: State being reset in a loop
**Check**: Optimistic message handling and state merging

### Scenario 3: High CPU usage
**Look for**: Excessive presence updates or activity event handlers
**Check**: Event listener frequency and debouncing

### Scenario 4: Delayed message delivery
**Look for**: Realtime subscription issues or reconnection attempts
**Check**: Connection state logs in RealtimeManager

## 📝 Notes

- All logs include timestamps (via browser console)
- Stack traces are only logged when thresholds are exceeded to avoid console spam
- Call counters reset on page reload, not on component remount
- Presence intervals run independently of component lifecycle

---

**Last Updated**: 2025-10-15  
**Version**: 1.0  
