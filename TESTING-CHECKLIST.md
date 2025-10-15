# Testing Checklist: Verify Logging and Find Infinite Loops

Use this checklist to systematically test the application and verify that logging is working correctly.

## Pre-Test Setup

- [ ] Open browser DevTools (F12)
- [ ] Navigate to Console tab
- [ ] Enable "Preserve log" in console settings
- [ ] Clear console (Ctrl+L or Cmd+K)
- [ ] Note the current time

## Test 1: Initial App Load

### Actions:
1. [ ] Navigate to the app root URL
2. [ ] Wait for authentication
3. [ ] Let the app fully load

### Expected Logs:
```
[Index] Component rendering
[Index] Initializing presence updater
[usePresenceUpdater] Hook initialized
[Index] Main useEffect: Checking auth
[getRealtimeManager] Creating new RealtimeManager instance
[RealtimeManager] Constructor called
[RealtimeManager] initializePresence started
```

### Check:
- [ ] No infinite loop warnings appear
- [ ] Logs show clear initialization sequence
- [ ] App loads to first channel successfully

### Issues Found:
```
(Document any issues here)
```

---

## Test 2: Channel Loading

### Actions:
1. [ ] Click on a channel in sidebar
2. [ ] Wait for channel to load
3. [ ] Observe console logs

### Expected Logs:
```
[Channel] Component rendering, channelId: XXX
[Channel] Main useEffect triggered, channelId: XXX
[Channel] initChannel started for channelId: XXX
[Channel] Step 1: joinChannel
[Channel] Step 2: loadChannel
[Channel] Step 3: loadMessages
[Channel] Step 4: getCurrentUser
[Channel] Step 5: loadChannelMembers
[Channel] Step 6: checkAdminStatus
[Channel] initChannel completed successfully
[Channel] Setting up realtime subscription for messages-XXX
```

### Check:
- [ ] All 6 init steps complete
- [ ] `loadMessages called, count: 1` (not 2, 3, 4...)
- [ ] No ⚠️ warnings
- [ ] Channel loads properly

### Issues Found:
```
(Document any issues here)
```

---

## Test 3: Send a Message

### Actions:
1. [ ] Type a message in the channel
2. [ ] Press Enter to send
3. [ ] Watch console

### Expected Logs:
```
[useTypingIndicator] startTyping called for channelId: XXX
[RealtimeManager] Message received on messages-XXX
[Channel] Realtime message received, reloading messages
[Channel] loadMessages called, count: 2
[Channel] loadMessages: fetched N messages
```

### Check:
- [ ] `loadMessages` count increases by 1 (to 2)
- [ ] No further increases after message sent
- [ ] Message appears in UI
- [ ] No infinite loop warnings

### Issues Found:
```
(Document any issues here)
```

---

## Test 4: Switch Between Channels

### Actions:
1. [ ] Click on Channel A
2. [ ] Wait for load
3. [ ] Click on Channel B
4. [ ] Wait for load
5. [ ] Click back to Channel A

### Expected Logs:
```
[Channel] Cleanup: Unsubscribing from all channels for channelId: A
[Channel] Component rendering, channelId: B
[Channel] Main useEffect triggered, channelId: B
...
[Channel] Cleanup: Unsubscribing from all channels for channelId: B
[Channel] Component rendering, channelId: A
```

### Check:
- [ ] Cleanup happens before new channel loads
- [ ] Each channel initializes from scratch
- [ ] Call counts don't carry over
- [ ] No subscription leaks

### Issues Found:
```
(Document any issues here)
```

---

## Test 5: Presence Updates

### Actions:
1. [ ] Leave app running for 2+ minutes
2. [ ] Switch to another tab (make app hidden)
3. [ ] Switch back to app tab
4. [ ] Move mouse/type to trigger activity

### Expected Logs:
```
[usePresenceUpdater] Periodic presence update (2min)
[usePresenceUpdater] updatePresence called with status: online

(When tab hidden)
[usePresenceUpdater] Visibility changed, hidden: true
[usePresenceUpdater] updatePresence called with status: away

(When tab visible)
[usePresenceUpdater] Visibility changed, hidden: false
[usePresenceUpdater] updatePresence called with status: online

(On activity)
[usePresenceUpdater] User activity detected
[usePresenceUpdater] updatePresence called with status: online
```

### Check:
- [ ] Presence updates every ~2 minutes when idle
- [ ] Status changes to 'away' when tab hidden
- [ ] Status changes to 'online' when tab active
- [ ] Activity triggers update (but not too frequently)

### Issues Found:
```
(Document any issues here)
```

---

## Test 6: Direct Messages

### Actions:
1. [ ] Navigate to a direct message conversation
2. [ ] Send a message
3. [ ] Watch for infinite loops

### Expected Logs:
```
[DirectMessage] Component rendering, userId: XXX
[DirectMessage] Main useEffect triggered, userId: XXX
[DirectMessage] Loading messages, user, and DM conversation
[DirectMessage] loadMessages called, count: 1
[DirectMessage] loadOrCreateDmConversation called, count: 1
```

### Check:
- [ ] `loadMessages count: 1` on initial load
- [ ] `loadOrCreateDmConversation` called only once or twice
- [ ] No infinite loops
- [ ] Messages send and receive properly

### Issues Found:
```
(Document any issues here)
```

---

## Test 7: Typing Indicators

### Actions:
1. [ ] In a channel, start typing (don't send)
2. [ ] Stop typing for 3 seconds
3. [ ] Start typing again

### Expected Logs:
```
[useTypingIndicator] startTyping called for channelId: XXX
[useTypingIndicator] Removing typing user after 3s: [name]
[useTypingIndicator] startTyping called for channelId: XXX
```

### Check:
- [ ] Typing indicator sent when typing starts
- [ ] Typing indicator auto-removed after 3s
- [ ] Can restart typing without issues
- [ ] Not too many typing updates

### Issues Found:
```
(Document any issues here)
```

---

## Test 8: Realtime Connection

### Actions:
1. [ ] Open DevTools Network tab
2. [ ] Throttle connection to "Slow 3G"
3. [ ] Watch console logs
4. [ ] Restore normal connection

### Expected Logs:
```
[RealtimeManager] Connection state: connecting
[RealtimeManager] Connection state: disconnected
[RealtimeManager] handleReconnect called for: XXX, attempt: 1
[RealtimeManager] Reconnecting XXX in 1000ms (attempt 1)
...
[RealtimeManager] Connection state: connected
```

### Check:
- [ ] Connection state changes logged
- [ ] Reconnection attempts with exponential backoff
- [ ] Max reconnect attempts respected (5)
- [ ] Recovers when connection restored

### Issues Found:
```
(Document any issues here)
```

---

## Test 9: Call Functionality

### Actions:
1. [ ] Start a voice/video call
2. [ ] End the call
3. [ ] Check logs

### Expected Logs:
```
[useCall] Hook initialized, channelId: XXX
[useCall] useEffect triggered, channelId: XXX
[useCall] Checking active call and subscribing to changes
[useCall] startCall initiated, type: video
[useCall] Call started successfully, id: XXX
...
[useCall] endCall called, activeCall: XXX
[useCall] Call ended successfully
```

### Check:
- [ ] Call lifecycle is clear in logs
- [ ] No duplicate call creation
- [ ] Call ends cleanly
- [ ] Subscriptions managed properly

### Issues Found:
```
(Document any issues here)
```

---

## Test 10: Stress Test - Rapid Actions

### Actions:
1. [ ] Rapidly click between different channels (5-10 clicks)
2. [ ] Send multiple messages quickly
3. [ ] React to multiple messages
4. [ ] Check for infinite loops

### Expected Behavior:
- [ ] Call counts might increase but stay under 10
- [ ] No ⚠️ infinite loop warnings
- [ ] App remains responsive
- [ ] Eventually stabilizes

### Check Console For:
```
(Any of these would indicate problems)
⚠️ INFINITE LOOP DETECTED
[Channel] loadMessages called, count: 11
[DirectMessage] loadMessages called, count: 11
```

### Issues Found:
```
(Document any issues here)
```

---

## Test 11: Long Session

### Actions:
1. [ ] Leave app open for 10+ minutes
2. [ ] Perform various actions periodically
3. [ ] Check if any functions grow out of control

### Expected Behavior:
- [ ] Presence updates continue every 2 min
- [ ] No memory leaks
- [ ] Console logs remain reasonable
- [ ] No accumulated infinite loops

### Monitor:
- [ ] Total console log count (shouldn't be > 1000)
- [ ] Browser memory usage (shouldn't grow continuously)
- [ ] App responsiveness (should stay smooth)

### Issues Found:
```
(Document any issues here)
```

---

## Summary

### Statistics
- Total tests run: ___/11
- Tests passed: ___
- Tests failed: ___
- Infinite loops found: ___
- Critical issues: ___
- Minor issues: ___

### Critical Issues Found
```
1. 
2. 
3. 
```

### Infinite Loop Patterns Detected
```
Pattern 1:
- Triggered by: 
- Component: 
- Function: 
- Stack trace line: 

Pattern 2:
- Triggered by:
- Component:
- Function:
- Stack trace line:
```

### Recommendations
```
Based on testing, recommend:
1. 
2. 
3. 
```

### Next Steps
- [ ] Document all findings
- [ ] Create issues for critical problems
- [ ] Fix infinite loops identified
- [ ] Re-test after fixes
- [ ] Consider optimization for any excessive logging

---

**Test Date**: __________  
**Tested By**: __________  
**Browser**: __________  
**Version**: __________  
**Branch**: cursor/debug-and-trace-execution-flows-e521
