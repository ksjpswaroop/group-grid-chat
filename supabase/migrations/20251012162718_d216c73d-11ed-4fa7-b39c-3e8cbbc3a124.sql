-- Phase 6: Performance optimizations with database indexes

-- Messages table indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_messages_channel_created 
  ON public.messages(channel_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_user 
  ON public.messages(user_id);

CREATE INDEX IF NOT EXISTS idx_messages_parent 
  ON public.messages(parent_message_id) 
  WHERE parent_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_messages_pinned 
  ON public.messages(channel_id, is_pinned, pinned_at) 
  WHERE is_pinned = true;

-- Full text search index for message content
CREATE INDEX IF NOT EXISTS idx_messages_content_search 
  ON public.messages USING GIN(to_tsvector('english', content));

-- Direct messages indexes
CREATE INDEX IF NOT EXISTS idx_direct_messages_dm_created 
  ON public.direct_messages(dm_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_direct_messages_sender 
  ON public.direct_messages(sender_id);

CREATE INDEX IF NOT EXISTS idx_direct_messages_unread 
  ON public.direct_messages(recipient_id, read_at) 
  WHERE read_at IS NULL;

-- Channel members for faster membership checks
CREATE INDEX IF NOT EXISTS idx_channel_members_user 
  ON public.channel_members(user_id);

CREATE INDEX IF NOT EXISTS idx_channel_members_channel 
  ON public.channel_members(channel_id);

-- DM participants for faster lookups
CREATE INDEX IF NOT EXISTS idx_dm_participants_user 
  ON public.dm_participants(user_id);

CREATE INDEX IF NOT EXISTS idx_dm_participants_dm 
  ON public.dm_participants(dm_id);

-- Reactions for faster aggregation
CREATE INDEX IF NOT EXISTS idx_message_reactions_message 
  ON public.message_reactions(message_id, emoji);

-- Mentions for faster notification queries
CREATE INDEX IF NOT EXISTS idx_mentions_user_unread 
  ON public.mentions(mentioned_user_id, read_at) 
  WHERE read_at IS NULL;

-- User presence for online status queries
CREATE INDEX IF NOT EXISTS idx_user_presence_status 
  ON public.user_presence(status, last_seen DESC);

-- Typing indicators for active channels
CREATE INDEX IF NOT EXISTS idx_typing_indicators_channel 
  ON public.typing_indicators(channel_id, updated_at DESC);

-- File uploads for storage management
CREATE INDEX IF NOT EXISTS idx_file_uploads_channel 
  ON public.file_uploads(channel_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_file_uploads_user 
  ON public.file_uploads(user_id, created_at DESC);

-- Calls for active call lookups
CREATE INDEX IF NOT EXISTS idx_calls_channel_active 
  ON public.calls(channel_id, is_active) 
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_calls_dm_active 
  ON public.calls(dm_conversation_id, is_active) 
  WHERE is_active = true;

-- Call participants for participant lookups
CREATE INDEX IF NOT EXISTS idx_call_participants_call 
  ON public.call_participants(call_id, joined_at DESC);

CREATE INDEX IF NOT EXISTS idx_call_participants_user 
  ON public.call_participants(user_id, left_at) 
  WHERE left_at IS NULL;

-- Analyze tables to update query planner statistics
ANALYZE public.messages;
ANALYZE public.direct_messages;
ANALYZE public.channel_members;
ANALYZE public.message_reactions;
ANALYZE public.user_presence;