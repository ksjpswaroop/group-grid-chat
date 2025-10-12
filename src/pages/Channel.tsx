import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Hash, Pin, X, WifiOff, Phone } from "lucide-react";
import { toast } from "sonner";
import { getRealtimeManager } from "@/lib/realtime";
import { useTypingIndicator } from "@/hooks/useTypingIndicator";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { offlineQueue } from "@/lib/offlineQueue";
import { ChannelErrorBoundary } from "@/components/ChannelErrorBoundary";
import MessageItem from "@/components/MessageItem";
import ThreadPanel from "@/components/ThreadPanel";
import PinnedMessagesPanel from "@/components/PinnedMessagesPanel";
import MentionAutocomplete from "@/components/MentionAutocomplete";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useCall } from "@/hooks/useCall";
import CallPreflight from "@/components/calls/CallPreflight";
import CallInterface from "@/components/calls/CallInterface";
import { FileUpload } from "@/components/FileUpload";
import { FilePreview } from "@/components/FilePreview";
import { EditMessageDialog } from "@/components/EditMessageDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Message {
  id: string;
  content: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  channel_id: string;
  parent_message_id?: string | null;
  is_pinned: boolean;
  pinned_at?: string | null;
  pinned_by?: string | null;
  profiles?: {
    full_name: string;
    avatar_url?: string;
  };
}

interface Channel {
  id: string;
  name: string;
  description: string | null;
}

interface User {
  id: string;
  full_name: string;
  avatar_url?: string;
}

interface Reaction {
  emoji: string;
  count: number;
  user_ids: string[];
  current_user_reacted: boolean;
}

const Channel = () => {
  const { channelId } = useParams();
  const [channel, setChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const { typingUsers, startTyping, stopTyping } = useTypingIndicator(channelId || "");
  const realtimeManager = getRealtimeManager();
  
  // Phase 5 features
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [showPinnedPanel, setShowPinnedPanel] = useState(false);
  const [channelMembers, setChannelMembers] = useState<User[]>([]);
  const [showMentionAutocomplete, setShowMentionAutocomplete] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [messageReactions, setMessageReactions] = useState<Record<string, Reaction[]>>({});
  const [threadReplyCounts, setThreadReplyCounts] = useState<Record<string, number>>({});
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Phase 6: Network status and offline support
  const { isOnline } = useNetworkStatus();
  const [queuedCount, setQueuedCount] = useState(0);
  
  useEffect(() => {
    const unsubscribe = offlineQueue.subscribe(() => {
      setQueuedCount(offlineQueue.getCount());
    });
    return unsubscribe;
  }, []);
  
  // Phase 7: Calls
  const { activeCall, startCall, endCall, loading: callLoading } = useCall(channelId);
  const [showPreflight, setShowPreflight] = useState(false);
  const [showCallInterface, setShowCallInterface] = useState(false);
  const [callDevices, setCallDevices] = useState<any>(null);
  
  // Phase 1 completion: File upload, edit/delete, optimistic UI
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<{ url: string; name: string; type: string } | null>(null);
  const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([]);

  useEffect(() => {
    if (channelId) {
      loadChannel();
      loadMessages();
      joinChannel();
      getCurrentUser();
      loadChannelMembers();
      checkAdminStatus();

      // Subscribe to messages
      realtimeManager.subscribeToChannel(`messages-${channelId}`, {
        filter: {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${channelId}`
        },
        onMessage: () => {
          loadMessages();
          loadThreadReplyCounts();
        }
      });

      // Subscribe to reactions
      const reactionsChannel = supabase
        .channel(`reactions-${channelId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'message_reactions'
          },
          () => {
            loadReactionsForMessages();
          }
        )
        .subscribe();
      
      // Subscribe to thread replies for notification badges
      const threadsChannel = supabase
        .channel(`threads-${channelId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `channel_id=eq.${channelId}`
          },
          (payload: any) => {
            if (payload.new.parent_message_id) {
              loadThreadReplyCounts();
              // Show toast if it's a reply to a thread you're following
              if (currentUserId) {
                supabase
                  .from('thread_followers')
                  .select('id')
                  .eq('thread_id', payload.new.parent_message_id)
                  .eq('user_id', currentUserId)
                  .maybeSingle()
                  .then(({ data }) => {
                    if (data && payload.new.user_id !== currentUserId) {
                      toast.info('New reply in a thread you\'re following');
                    }
                  });
              }
            }
          }
        )
        .subscribe();

      return () => {
        realtimeManager.unsubscribeFromChannel(`messages-${channelId}`);
        supabase.removeChannel(reactionsChannel);
        supabase.removeChannel(threadsChannel);
      };
    }
  }, [channelId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (messages.length > 0) {
      loadReactionsForMessages();
      loadThreadReplyCounts();
    }
  }, [messages]);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);
  };

  const checkAdminStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      setIsAdmin(!!data);
    }
  };

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  const loadChannel = async () => {
    const { data } = await supabase
      .from("channels")
      .select("*")
      .eq("id", channelId)
      .single();
    if (data) setChannel(data);
  };

  const loadMessages = async () => {
    const { data } = await supabase
      .from("messages")
      .select("*, profiles!messages_user_id_fkey(full_name, avatar_url)")
      .eq("channel_id", channelId)
      .is("parent_message_id", null)
      .order("created_at", { ascending: true });

    if (data) {
      setMessages(data as any);
    }
  };

  const loadChannelMembers = async () => {
    const { data } = await supabase
      .from("channel_members")
      .select("user_id, profiles!channel_members_user_id_fkey(id, full_name, avatar_url)")
      .eq("channel_id", channelId);

    if (data) {
      const members = data.map(item => {
        const profile = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles;
        return {
          id: profile?.id || item.user_id,
          full_name: profile?.full_name || "Unknown User",
          avatar_url: profile?.avatar_url
        };
      }).filter(m => m.id);
      setChannelMembers(members as User[]);
    }
  };

  const loadReactionsForMessages = async () => {
    const messageIds = messages.map(m => m.id);
    if (messageIds.length === 0) return;

    const reactions: Record<string, Reaction[]> = {};
    
    for (const messageId of messageIds) {
      const { data } = await supabase.rpc('get_message_reactions_summary', { msg_id: messageId });
      if (data && data.length > 0) {
        reactions[messageId] = data as Reaction[];
      }
    }
    
    setMessageReactions(reactions);
  };

  const loadThreadReplyCounts = async () => {
    const messageIds = messages.map(m => m.id);
    if (messageIds.length === 0) return;

    const counts: Record<string, number> = {};
    
    for (const messageId of messageIds) {
      const { data } = await supabase.rpc('get_thread_reply_count', { parent_id: messageId });
      if (data) {
        counts[messageId] = Number(data);
      }
    }
    
    setThreadReplyCounts(counts);
  };

  const joinChannel = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from("channel_members")
        .upsert(
          { channel_id: channelId, user_id: user.id },
          { onConflict: "channel_id,user_id" }
        );
    }
  };

  const parseMentions = (content: string) => {
    const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
    const mentions: string[] = [];
    let match;
    
    while ((match = mentionRegex.exec(content)) !== null) {
      mentions.push(match[2]); // user_id
    }
    
    return mentions;
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || loading) return;

    setLoading(true);
    
    // Optimistic UI: Add message immediately
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const optimisticMessage: Message = {
      id: `temp-${Date.now()}`,
      content: newMessage.trim(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user_id: user.id,
      channel_id: channelId!,
      is_pinned: false,
      profiles: {
        full_name: profile?.full_name || 'You',
        avatar_url: profile?.avatar_url
      }
    };
    
    setOptimisticMessages([...optimisticMessages, optimisticMessage]);
    const messageContent = newMessage.trim();
    setNewMessage("");
    stopTyping();

    try {
      const { data: message, error } = await supabase
        .from("messages")
        .insert({
          channel_id: channelId,
          user_id: user.id,
          content: messageContent,
        })
        .select()
        .single();

      if (error) throw error;

      // Create mentions
      const mentionedUserIds = parseMentions(messageContent);
      if (mentionedUserIds.length > 0 && message) {
        await supabase
          .from("mentions")
          .insert(
            mentionedUserIds.map(userId => ({
              message_id: message.id,
              mentioned_user_id: userId
            }))
          );
      }

      // Remove optimistic message
      setOptimisticMessages(optimisticMessages.filter(m => m.id !== optimisticMessage.id));
      
      // Mark channel as read
      await supabase
        .from('channel_read_status')
        .upsert({
          user_id: user.id,
          channel_id: channelId,
          last_read: new Date().toISOString()
        });
    } catch (error: any) {
      toast.error(error.message);
      setOptimisticMessages(optimisticMessages.filter(m => m.id !== optimisticMessage.id));
      setNewMessage(messageContent); // Restore message
    } finally {
      setLoading(false);
    }
  };

  const handleEditMessage = async (content: string) => {
    if (!editingMessageId) return;

    const { error } = await supabase
      .from("messages")
      .update({
        content,
        updated_at: new Date().toISOString()
      })
      .eq("id", editingMessageId);

    if (error) {
      toast.error("Failed to edit message");
    } else {
      toast.success("Message updated");
      loadMessages();
      setEditingMessageId(null);
    }
  };

  const handleDeleteMessage = async () => {
    if (!deletingMessageId) return;

    const { error } = await supabase
      .from("messages")
      .delete()
      .eq("id", deletingMessageId);

    if (error) {
      toast.error("Failed to delete message");
    } else {
      toast.success("Message deleted");
      loadMessages();
      setDeletingMessageId(null);
    }
  };

  const handleFileUploaded = (fileUrl: string, fileName: string, fileType: string) => {
    // Add file as a message
    const fileMessage = `📎 [${fileName}](${fileUrl})`;
    setNewMessage(fileMessage);
  };

  const [profile, setProfile] = useState<{ full_name: string; avatar_url?: string } | null>(null);

  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("id", user.id)
        .single();
      if (data) setProfile(data);
    }
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    if (!currentUserId) return;

    // Check if user already reacted with this emoji
    const currentReactions = messageReactions[messageId] || [];
    const existingReaction = currentReactions.find(
      r => r.emoji === emoji && r.current_user_reacted
    );

    if (existingReaction) {
      // Remove reaction
      await supabase
        .from("message_reactions")
        .delete()
        .eq("message_id", messageId)
        .eq("user_id", currentUserId)
        .eq("emoji", emoji);
    } else {
      // Add reaction
      await supabase
        .from("message_reactions")
        .insert({
          message_id: messageId,
          user_id: currentUserId,
          emoji: emoji
        });
    }

    loadReactionsForMessages();
  };

  const handlePinMessage = async (messageId: string) => {
    const message = messages.find(m => m.id === messageId);
    if (!message) return;

    const { error } = await supabase
      .from("messages")
      .update({
        is_pinned: !message.is_pinned,
        pinned_at: !message.is_pinned ? new Date().toISOString() : null,
        pinned_by: !message.is_pinned ? currentUserId : null
      })
      .eq("id", messageId);

    if (error) {
      toast.error("Failed to pin message");
    } else {
      toast.success(message.is_pinned ? "Message unpinned" : "Message pinned");
      loadMessages();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setNewMessage(value);

    // Check for @ mentions
    const cursorPosition = e.target.selectionStart;
    const textBeforeCursor = value.slice(0, cursorPosition);
    const lastAtSymbol = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtSymbol !== -1 && lastAtSymbol === textBeforeCursor.length - 1) {
      setShowMentionAutocomplete(true);
      setMentionQuery("");
    } else if (lastAtSymbol !== -1) {
      const queryAfterAt = textBeforeCursor.slice(lastAtSymbol + 1);
      if (queryAfterAt && !queryAfterAt.includes(' ')) {
        setShowMentionAutocomplete(true);
        setMentionQuery(queryAfterAt);
      } else {
        setShowMentionAutocomplete(false);
      }
    } else {
      setShowMentionAutocomplete(false);
    }

    if (value) {
      startTyping();
    } else {
      stopTyping();
    }
  };

  const handleMentionSelect = (user: User) => {
    const cursorPosition = textareaRef.current?.selectionStart || 0;
    const textBeforeCursor = newMessage.slice(0, cursorPosition);
    const lastAtSymbol = textBeforeCursor.lastIndexOf('@');
    
    const textBefore = newMessage.slice(0, lastAtSymbol);
    const textAfter = newMessage.slice(cursorPosition);
    
    const mention = `@[${user.full_name}](${user.id}) `;
    setNewMessage(textBefore + mention + textAfter);
    setShowMentionAutocomplete(false);
    setMentionQuery("");
    
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);
  };

  const activeThreadMessage = messages.find(m => m.id === activeThreadId);

  if (!channel) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <div className="flex flex-col flex-1">
        <div className="border-b p-4 shadow-soft bg-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="bg-gradient-accent p-2 rounded-lg">
                <Hash className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <h2 className="text-xl font-bold">{channel.name}</h2>
                {channel.description && (
                  <p className="text-sm text-muted-foreground">{channel.description}</p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (activeCall) {
                    setShowCallInterface(true);
                  } else {
                    setShowPreflight(true);
                  }
                }}
                disabled={callLoading}
              >
                <Phone className="h-4 w-4 mr-2" />
                {activeCall ? 'Join Call' : 'Start Call'}
              </Button>
              <Button
                variant={showPinnedPanel ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setShowPinnedPanel(!showPinnedPanel)}
              >
                <Pin className="h-4 w-4 mr-2" />
                Pinned
              </Button>
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1" ref={scrollRef}>
          <div className="space-y-1">
            {[...messages, ...optimisticMessages].map((message) => (
              <MessageItem
                key={message.id}
                message={message}
                currentUserId={currentUserId || ""}
                isAdmin={isAdmin}
                threadReplyCount={threadReplyCounts[message.id] || 0}
                onReply={(messageId) => setActiveThreadId(messageId)}
                onPin={handlePinMessage}
                onEdit={(messageId) => {
                  setEditingMessageId(messageId);
                  const msg = messages.find(m => m.id === messageId);
                  setEditingContent(msg?.content || "");
                }}
                onDelete={(messageId) => setDeletingMessageId(messageId)}
                onReact={handleReaction}
                reactions={messageReactions[message.id] || []}
              />
            ))}
            {typingUsers.length > 0 && (
              <div className="px-4 py-2 text-sm text-muted-foreground italic">
                {typingUsers.map(u => u.full_name || u.email).join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="border-t p-4 bg-card shadow-soft relative">
          {!isOnline && (
            <Alert className="mb-3">
              <WifiOff className="h-4 w-4" />
              <AlertDescription>
                You're offline. Messages will be sent when connection is restored.
                {queuedCount > 0 && ` (${queuedCount} queued)`}
              </AlertDescription>
            </Alert>
          )}
          {showMentionAutocomplete && (
            <MentionAutocomplete
              users={channelMembers}
              onSelect={handleMentionSelect}
              searchQuery={mentionQuery}
            />
          )}
          <form onSubmit={handleSendMessage} className="space-y-2">
            <Textarea
              ref={textareaRef}
              value={newMessage}
              onChange={handleTextareaChange}
              placeholder={`Message #${channel.name} (@ to mention)`}
              disabled={loading}
              className="min-h-[80px] resize-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e);
                }
              }}
            />
            <div className="flex justify-between items-center mt-2">
              <FileUpload
                channelId={channelId || ""}
                onFileUploaded={handleFileUploaded}
                disabled={loading}
              />
              <Button
                type="submit"
                disabled={loading || !newMessage.trim()}
                className="bg-gradient-primary hover:opacity-90 transition-opacity"
              >
                Send
              </Button>
            </div>
          </form>
        </div>
      </div>
      
      {/* Call Components */}
      {showPreflight && (
        <CallPreflight
          open={showPreflight}
          onClose={() => setShowPreflight(false)}
          onJoin={async (devices) => {
            setCallDevices(devices);
            setShowPreflight(false);
            if (!activeCall) {
              const call = await startCall('video');
              if (call) {
                setShowCallInterface(true);
              }
            } else {
              setShowCallInterface(true);
            }
          }}
        />
      )}
      
      {showCallInterface && activeCall && (
        <CallInterface
          callId={activeCall.id}
          roomName={activeCall.room_name}
          onLeave={() => setShowCallInterface(false)}
          {...callDevices}
        />
      )}

      {activeThreadId && activeThreadMessage && (
        <div className="w-96 border-l">
          <ThreadPanel
            parentMessage={activeThreadMessage}
            currentUserId={currentUserId || ""}
            isAdmin={isAdmin}
            onClose={() => setActiveThreadId(null)}
          />
        </div>
      )}

      {showPinnedPanel && (
        <div className="w-96 border-l">
          <PinnedMessagesPanel
            channelId={channelId || ""}
            currentUserId={currentUserId || ""}
            isAdmin={isAdmin}
            onClose={() => setShowPinnedPanel(false)}
            onJumpToMessage={(messageId) => {
              // Scroll to message - simplified for now
              setShowPinnedPanel(false);
            }}
          />
        </div>
      )}

      {/* Edit Message Dialog */}
      <EditMessageDialog
        open={!!editingMessageId}
        onClose={() => setEditingMessageId(null)}
        onSave={handleEditMessage}
        initialContent={editingContent}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingMessageId} onOpenChange={() => setDeletingMessageId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Message</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this message? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteMessage}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* File Preview */}
      {previewFile && (
        <FilePreview
          open={!!previewFile}
          onClose={() => setPreviewFile(null)}
          fileUrl={previewFile.url}
          fileName={previewFile.name}
          fileType={previewFile.type}
        />
      )}
    </div>
  );
};

export default Channel;
