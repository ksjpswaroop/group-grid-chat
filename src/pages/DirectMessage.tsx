import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PresenceDot } from '@/components/PresenceDot';
import { usePresence } from '@/hooks/usePresence';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { Phone, Video, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useCall } from '@/hooks/useCall';
import CallPreflight from '@/components/calls/CallPreflight';
import CallInterface from '@/components/calls/CallInterface';

interface DirectMessage {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  sender: {
    full_name: string;
    email: string;
  };
}

interface OtherUser {
  id: string;
  full_name: string;
  email: string;
}

export default function DirectMessage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [dmConversationId, setDmConversationId] = useState<string | null>(null);

  const { getPresence } = usePresence(userId ? [userId] : []);
  const { typingUsers, startTyping, stopTyping } = useTypingIndicator(`dm-${userId}`);
  const { activeCall, startCall, loading: callLoading } = useCall(undefined, dmConversationId || undefined);
  const [showPreflight, setShowPreflight] = useState(false);
  const [showCallInterface, setShowCallInterface] = useState(false);
  const [callDevices, setCallDevices] = useState<any>(null);

  useEffect(() => {
    if (!userId) return;
    
    loadMessages();
    loadOtherUser();
    loadOrCreateDmConversation();

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
          const newMsg = payload.new as any;
          if (
            (newMsg.sender_id === userId && newMsg.recipient_id === currentUserId) ||
            (newMsg.sender_id === currentUserId && newMsg.recipient_id === userId)
          ) {
            loadMessages();
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [userId]);

  const loadOrCreateDmConversation = async () => {
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
      sender: profilesMap.get(msg.sender_id) || { full_name: 'Unknown', email: '' }
    }));

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
      <ScrollArea className="flex-1 p-6">
        <div className="space-y-4 max-w-4xl mx-auto">
          {messages.map((message) => {
            const isOwnMessage = message.sender_id === currentUserId;
            
            return (
              <div
                key={message.id}
                className={`flex gap-3 ${isOwnMessage ? 'flex-row-reverse' : ''}`}
              >
                {!isOwnMessage && (
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                )}
                <div className={`flex flex-col ${isOwnMessage ? 'items-end' : ''}`}>
                  <div
                    className={`rounded-lg px-4 py-2 max-w-[70%] ${
                      isOwnMessage
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {message.content}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground mt-1">
                    {format(new Date(message.created_at), 'h:mm a')}
                  </span>
                </div>
              </div>
            );
          })}
          
          {typingUsers.length > 0 && (
            <div className="flex gap-3 items-center text-sm text-muted-foreground">
              <Avatar className="h-8 w-8">
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <span>{otherUser.full_name} is typing...</span>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <form onSubmit={handleSendMessage} className="border-t p-4">
        <div className="max-w-4xl mx-auto flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => {
              setNewMessage(e.target.value);
              handleTyping();
            }}
            placeholder={`Message ${otherUser.full_name}`}
            className="flex-1"
            disabled={sending}
          />
          <Button type="submit" disabled={!newMessage.trim() || sending}>
            Send
          </Button>
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
