# Quick Reference: Debug Infinite Loops

## 🔍 Console Filters

Open browser console and use these filters:

```
⚠️                          - See all warnings
[Channel]                   - Channel component logs
[DirectMessage]             - Direct message logs
[RealtimeManager]           - Realtime service logs
[usePresence]               - Presence tracking
[usePresenceUpdater]        - Presence updates
[useCall]                   - Call functionality
[useTypingIndicator]        - Typing indicators
[Index]                     - Main app routing
INFINITE LOOP               - Only loop warnings
```

## 📊 What to Look For

### ✅ Healthy App
```
[Channel] loadMessages called, count: 1
[Channel] loadMessages: fetched 10 messages
[Channel] Messages array changed, length: 10
✓ Counts stay at 1-2
```

### ❌ Infinite Loop
```
[Channel] loadMessages called, count: 1
[Channel] loadMessages called, count: 2
[Channel] loadMessages called, count: 3
...
[Channel] loadMessages called, count: 11
⚠️ INFINITE LOOP DETECTED: loadMessages called more than 10 times!
```

## 🎯 Common Issues & Quick Fixes

### Issue 1: Messages Keep Reloading
**Symptom**: `loadMessages called, count: X` increases rapidly  
**Cause**: useEffect watching messages array  
**Check Lines**: Channel.tsx:231-236  
**Fix**: Add proper dependency management or memoization

### Issue 2: High CPU Usage
**Symptom**: Browser tab uses 100% CPU  
**Cause**: Presence updates or activity handlers  
**Check**: `[usePresenceUpdater]` frequency  
**Fix**: Add debouncing to activity handlers

### Issue 3: Can't Load Channel
**Symptom**: Stuck on loading screen  
**Look for**: Errors in initChannel steps  
**Check Lines**: Channel.tsx:139-153  
**Fix**: Check each init step completion

### Issue 4: Realtime Not Working
**Symptom**: Messages don't appear until refresh  
**Look for**: `Connection state: disconnected`  
**Check**: `[RealtimeManager]` subscription logs  
**Fix**: Check network and Supabase connection

## 🛠️ Debug Commands (Run in Console)

### Count how many times loadMessages was called:
```javascript
$$('div').length; // Refresh console first
// Then search for: [Channel] loadMessages called, count:
```

### Monitor state changes live:
```javascript
// Right-click console > Settings > Enable "Preserve log"
// Then filter by: "Setting" OR "Updating"
```

### Check subscriptions vs cleanups:
```javascript
// Search: "Setting up realtime subscription"
// vs "Cleanup: Unsubscribing"
// Counts should match!
```

## 🚨 Emergency Stop

If app is frozen in infinite loop:

1. **Immediate**: Close browser tab
2. **Temporary**: Comment out the useEffect at the logged line
3. **Proper Fix**: Add proper dependencies/memoization

## 📈 Call Count Thresholds

- `loadMessages`: Max 10 calls ⚠️
- `loadReactionsForMessages`: Max 10 calls ⚠️
- `loadThreadReplyCounts`: Max 10 calls ⚠️
- `loadOrCreateDmConversation`: Max 5 calls ⚠️

## 🔄 Normal Flow Sequences

### Channel Load (Should see once):
```
[Channel] Component rendering, channelId: 123
[Channel] Main useEffect triggered
[Channel] initChannel started
[Channel] Step 1: joinChannel
[Channel] Step 2: loadChannel
[Channel] Step 3: loadMessages
[Channel] Step 4: getCurrentUser
[Channel] Step 5: loadChannelMembers
[Channel] Step 6: checkAdminStatus
[Channel] initChannel completed successfully
[Channel] Setting up realtime subscription
```

### Presence Update (Every 2 min):
```
[usePresenceUpdater] Periodic presence update (2min)
[usePresenceUpdater] updatePresence called with status: online
[usePresenceUpdater] Upserting presence for user: xxx
[usePresenceUpdater] Presence updated successfully
```

### New Message (Should see once per message):
```
[RealtimeManager] Message received on messages-123
[Channel] Realtime message received, reloading messages
[Channel] loadMessages called, count: 2
[Channel] loadMessages: fetched 11 messages
```

## 📞 When to Worry

| Log Pattern | Severity | Action |
|------------|----------|---------|
| Count > 10 in any function | 🔴 CRITICAL | Stop and debug immediately |
| Same log repeating rapidly | 🟡 WARNING | Investigate cause |
| Stack trace appears | 🔴 CRITICAL | Check line numbers in trace |
| Connection state: error | 🟠 ERROR | Check network/DB |
| Multiple "Component rendering" | 🟡 WARNING | Check for unnecessary re-renders |

## 💡 Pro Tips

1. **Enable Preserve Log** in console settings to see logs across page reloads
2. **Use Timeline** feature in DevTools to see function call sequences
3. **Watch Network tab** for excessive API calls
4. **Check React DevTools** Profiler for render counts
5. **Monitor Memory** tab if app slows down over time

---

For detailed explanations, see `DEBUGGING-GUIDE.md`
