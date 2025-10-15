import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PresenceDot } from '@/components/PresenceDot';
import { usePresence } from '@/hooks/usePresence';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { Phone, Video, ArrowLeft, Smile } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { useCall } from '@/hooks/useCall';
import CallPreflight from '@/components/calls/CallPreflight';
import CallInterface from '@/components/calls/CallInterface';
import MessageItem from '@/components/MessageItem';
import ReactionsBar from '@/components/ReactionsBar';
import { FileUpload } from '@/components/FileUpload';
import { AudioRecorder } from '@/components/AudioRecorder';

interface DirectMessage {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  updated_at: string;
  user_id?: string;
  is_pinned?: boolean;
  audio_url?: string | null;
  audio_duration?: number | null;
  sender: {
    full_name: string;
    email: string;
  };
}

interface Reaction {
  emoji: string;
  count: number;
  user_ids: string[];
  current_user_reacted: boolean;
}

interface OtherUser {
  id: string;
  full_name: string;
  email: string;
}

export default function DirectMessage() {
  console.log('[DirectMessage] Component rendering, userId:', useParams<{ userId: string }>().userId);
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [dmConversationId, setDmConversationId] = useState<string | null>(null);
  const [messageReactions, setMessageReactions] = useState<Record<string, Reaction[]>>({});
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Track function calls to detect loops
  const callCountRef = useRef({ loadMessages: 0, loadReactions: 0, loadOrCreateDm: 0 });

  const { getPresence } = usePresence(userId ? [userId] : []);
  const { typingUsers, startTyping, stopTyping } = useTypingIndicator(`dm-${userId}`);
  const { activeCall, startCall, loading: callLoading } = useCall(undefined, dmConversationId || undefined);
  const [showPreflight, setShowPreflight] = useState(false);
  const [showCallInterface, setShowCallInterface] = useState(false);
  const [callDevices, setCallDevices] = useState<any>(null);
  const [showAudioRecorder, setShowAudioRecorder] = useState(false);

  useEffect(() => {
    console.log('[DirectMessage] Main useEffect triggered, userId:', userId);
    if (!userId) return;
    
    console.log('[DirectMessage] Loading messages, user, and DM conversation');
    loadMessages();
    loadOtherUser();
    loadOrCreateDmConversation();

    console.log('[DirectMessage] Setting up realtime subscription for dm-' + userId);
    const channel = supabase
      .channel(`dm-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
        },
        (payload) => {
          console.log('[DirectMessage] Realtime INSERT received:', payload);
          const newMsg = payload.new as any;
          if (
            (newMsg.sender_id === userId && newMsg.recipient_id === currentUserId) ||
            (newMsg.sender_id === currentUserId && newMsg.recipient_id === userId)
          ) {
            console.log('[DirectMessage] Message is for this conversation, reloading messages');
            loadMessages();
          }
        }
      )
      .subscribe();
    
    // Subscribe to reactions
    const reactionsChannel = supabase
      .channel(`dm-reactions-${userId}`)
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

    return () => {
      console.log('[DirectMessage] Cleanup: Unsubscribing from channels for userId:', userId);
      channel.unsubscribe();
      supabase.removeChannel(reactionsChannel);
    };
  }, [userId]);
  
  useEffect(() => {
    console.log('[DirectMessage] Messages array changed, length:', messages.length);
    if (messages.length > 0) {
      console.log('[DirectMessage] Loading reactions for', messages.length, 'messages');
      loadReactionsForMessages();
    }
  }, [messages]);
  
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  const scrollToBottom = () => {
    if (scrollRef.current) {
      const scrollElement = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  };
  
  const loadReactionsForMessages = async () => {
    callCountRef.current.loadReactions++;
    console.log('[DirectMessage] loadReactionsForMessages called, count:', callCountRef.current.loadReactions, 'messageCount:', messages.length);
    
    if (callCountRef.current.loadReactions > 10) {
      console.error('[DirectMessage] ⚠️ INFINITE LOOP DETECTED: loadReactionsForMessages called more than 10 times!');
      console.trace('[DirectMessage] Stack trace:');
    }
    
    const messageIds = messages.map(m => m.id);
    if (messageIds.length === 0) return;

    const reactions: Record<string, Reaction[]> = {};
    
    for (const messageId of messageIds) {
      const { data } = await supabase.rpc('get_message_reactions_summary', { msg_id: messageId });
      if (data && data.length > 0) {
        reactions[messageId] = data as Reaction[];
      }
    }
    
    console.log('[DirectMessage] loadReactionsForMessages: loaded reactions for', Object.keys(reactions).length, 'messages');
    setMessageReactions(reactions);
  };

  const loadOrCreateDmConversation = async () => {
    callCountRef.current.loadOrCreateDm++;
    console.log('[DirectMessage] loadOrCreateDmConversation called, count:', callCountRef.current.loadOrCreateDm, 'userId:', userId);
    
    if (callCountRef.current.loadOrCreateDm > 5) {
      console.error('[DirectMessage] ⚠️ INFINITE LOOP DETECTED: loadOrCreateDmConversation called more than 5 times!');
      console.trace('[DirectMessage] Stack trace:');
    }
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !userId) return;

    // Try to find existing DM conversation
    const { data: existing } = await supabase
      .from('dm_participants')
      .select('dm_id')
      .eq('user_id', user.id);

    if (existing && existing.length > 0) {
      // Check if any of these conversations include the other user
      for (const conv of existing) {
        const { data: otherParticipant } = await supabase
          .from('dm_participants')
          .select('user_id')
          .eq('dm_id', conv.dm_id)
          .eq('user_id', userId)
          .maybeSingle();

        if (otherParticipant) {
          setDmConversationId(conv.dm_id);
          return;
        }
      }
    }

    // Create new DM conversation
    const { data: newConv, error } = await supabase
      .from('dm_conversations')
      .insert({})
      .select()
      .single();

    if (newConv && !error) {
      await supabase.from('dm_participants').insert([
        { dm_id: newConv.id, user_id: user.id },
        { dm_id: newConv.id, user_id: userId }
      ]);
      setDmConversationId(newConv.id);
    }
  };

  const loadOtherUser = async () => {
    if (!userId) return;

    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('id', userId)
      .single();

    if (data) {
      setOtherUser(data);
    }
  };

  const loadMessages = async () => {
    callCountRef.current.loadMessages++;
    console.log('[DirectMessage] loadMessages called, count:', callCountRef.current.loadMessages, 'userId:', userId);
    
    if (callCountRef.current.loadMessages > 10) {
      console.error('[DirectMessage] ⚠️ INFINITE LOOP DETECTED: loadMessages called more than 10 times!');
      console.trace('[DirectMessage] Stack trace:');
    }
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !userId) return;
    
    setCurrentUserId(user.id);

    const { data, error } = await supabase
      .from('direct_messages')
      .select('*')
      .or(`and(sender_id.eq.${user.id},recipient_id.eq.${userId}),and(sender_id.eq.${userId},recipient_id.eq.${user.id})`)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading messages:', error);
      return;
    }

    // Fetch sender profiles separately
    const senderIds = [...new Set(data.map(m => m.sender_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', senderIds);

    const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);

    const enrichedMessages = data.map(msg => ({
      ...msg,
      updated_at: msg.created_at, // DMs don't have separate updated_at
      sender: profilesMap.get(msg.sender_id) || { full_name: 'Unknown', email: '' }
    }));

    console.log('[DirectMessage] loadMessages: fetched', enrichedMessages.length, 'messages');
    setMessages(enrichedMessages as DirectMessage[]);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !userId || !currentUserId || sending) return;

    setSending(true);
    stopTyping();

    try {
      const { error } = await supabase
        .from('direct_messages')
        .insert({
          content: newMessage,
          sender_id: currentUserId,
          recipient_id: userId
        });

      if (error) throw error;

      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleTyping = () => {
    startTyping();
  };
  
  const handleReaction = async (messageId: string, emoji: string) => {
    if (!currentUserId) return;

    const currentReactions = messageReactions[messageId] || [];
    const existingReaction = currentReactions.find(
      r => r.emoji === emoji && r.current_user_reacted
    );

    if (existingReaction) {
      await supabase
        .from("message_reactions")
        .delete()
        .eq("message_id", messageId)
        .eq("user_id", currentUserId)
        .eq("emoji", emoji);
    } else {
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
  
  const handleFileUploaded = (fileUrl: string, fileName: string, fileType: string) => {
    const fileMessage = `📎 [${fileName}](${fileUrl})`;
    setNewMessage(fileMessage);
  };

  if (!otherUser) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const presence = getPresence(userId!);
  const initials = otherUser.full_name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase();

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-4 px-6 py-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
            className="lg:hidden"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          
          <div className="flex items-center gap-3 flex-1">
            <div className="relative">
              <Avatar className="h-10 w-10">
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-0.5 -right-0.5">
                <PresenceDot status={presence} />
              </div>
            </div>
            <div>
              <h2 className="font-semibold">{otherUser.full_name}</h2>
              <p className="text-xs text-muted-foreground capitalize">{presence}</p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => {
                if (activeCall) {
                  setShowCallInterface(true);
                } else {
                  setShowPreflight(true);
                }
              }}
              disabled={callLoading || !dmConversationId}
            >
              <Phone className="h-5 w-5" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => {
                if (activeCall) {
                  setShowCallInterface(true);
                } else {
                  setShowPreflight(true);
                }
              }}
              disabled={callLoading || !dmConversationId}
            >
              <Video className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Messages */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="space-y-1 p-4">
          {messages.map((message) => (
            <MessageItem
              key={message.id}
              message={{
                ...message,
                channel_id: dmConversationId || '',
                user_id: message.sender_id,
                updated_at: message.updated_at || message.created_at,
                is_pinned: message.is_pinned || false,
                profiles: {
                  full_name: message.sender.full_name,
                  avatar_url: undefined
                }
              }}
              currentUserId={currentUserId || ""}
              isAdmin={false}
              onReply={() => {}}
              onPin={() => {}}
              onReact={handleReaction}
              reactions={messageReactions[message.id] || []}
            />
          ))}
          
          {typingUsers.length > 0 && (
            <div className="px-4 py-2 text-sm text-muted-foreground italic">
              {otherUser.full_name} is typing...
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <form onSubmit={handleSendMessage} className="border-t p-4 bg-card">
        <div className="space-y-2">
          <Textarea
            ref={textareaRef}
            value={newMessage}
            onChange={(e) => {
              setNewMessage(e.target.value);
              handleTyping();
            }}
            placeholder={`Message ${otherUser.full_name}`}
            className="min-h-[80px] resize-none"
            disabled={sending}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage(e);
              }
            }}
          />
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-1">
              <FileUpload
                channelId=""
                onFileUploaded={handleFileUploaded}
                disabled={sending}
              />
              {!showAudioRecorder && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  title="Record audio"
                  onClick={() => setShowAudioRecorder(true)}
                  disabled={sending}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </Button>
              )}
            </div>
            {!showAudioRecorder && (
              <Button 
                type="submit" 
                disabled={!newMessage.trim() || sending}
                className="bg-gradient-primary hover:opacity-90"
              >
                {sending ? 'Sending...' : 'Send'}
              </Button>
            )}
          </div>
          {showAudioRecorder && (
            <div className="mt-2">
              <AudioRecorder
                onRecordingComplete={async (audioBlob, duration) => {
                  if (!currentUserId || !userId) return;

                  const fileName = `audio/${currentUserId}/dm/${Date.now()}.webm`;
                  const { error: uploadError } = await supabase.storage
                    .from('team-files')
                    .upload(fileName, audioBlob);

                  if (uploadError) {
                    toast.error('Failed to upload audio');
                    return;
                  }

                  const { data: { publicUrl } } = supabase.storage
                    .from('team-files')
                    .getPublicUrl(fileName);
                  
                  await supabase.from('direct_messages').insert({
                    sender_id: currentUserId,
                    recipient_id: userId,
                    dm_id: dmConversationId,
                    content: '🎤 Voice message',
                    audio_url: publicUrl,
                    audio_duration: duration
                  });

                  setShowAudioRecorder(false);
                  toast.success('Voice message sent');
                }}
                onCancel={() => setShowAudioRecorder(false)}
              />
            </div>
          )}
        </div>
      </form>
      
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
    </div>
  );
}
