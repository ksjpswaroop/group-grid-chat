import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Hash } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { getRealtimeManager } from "@/lib/realtime";
import { useTypingIndicator } from "@/hooks/useTypingIndicator";

interface Message {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profiles: {
    full_name: string | null;
    email: string;
  };
}

interface Channel {
  id: string;
  name: string;
  description: string | null;
}

const Channel = () => {
  const { channelId } = useParams();
  const [channel, setChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const { typingUsers, startTyping, stopTyping } = useTypingIndicator(channelId || "");
  const realtimeManager = getRealtimeManager();

  useEffect(() => {
    if (channelId) {
      loadChannel();
      loadMessages();
      joinChannel();
      getCurrentUser();

      realtimeManager.subscribeToChannel(`messages-${channelId}`, {
        filter: {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${channelId}`
        },
        onMessage: () => {
          loadMessages();
        }
      });

      return () => {
        realtimeManager.unsubscribeFromChannel(`messages-${channelId}`);
      };
    }
  }, [channelId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);
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
      .select(`
        id,
        content,
        created_at,
        updated_at,
        user_id,
        channel_id,
        profiles!messages_user_id_fkey (
          full_name,
          email
        )
      `)
      .eq("channel_id", channelId)
      .order("created_at", { ascending: true });

    if (data) {
      const messagesWithProfiles = data.map((msg) => ({
        ...msg,
        profiles: Array.isArray(msg.profiles) ? msg.profiles[0] : msg.profiles,
      }));
      setMessages(messagesWithProfiles as Message[]);
    }
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

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("messages").insert({
        channel_id: channelId,
        user_id: user.id,
        content: newMessage.trim(),
      });

      if (error) throw error;

      setNewMessage("");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!channel) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b p-4 shadow-soft bg-card">
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
      </div>

      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 animate-slide-in ${
                message.user_id === currentUserId ? "flex-row-reverse" : ""
              }`}
            >
              <Avatar className="h-10 w-10 border-2 border-accent">
                <AvatarFallback className="bg-gradient-primary text-primary-foreground">
                  {message.profiles.full_name?.[0]?.toUpperCase() ||
                    message.profiles.email[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className={`flex-1 ${message.user_id === currentUserId ? "text-right" : ""}`}>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className={`font-semibold ${message.user_id === currentUserId ? "order-2" : ""}`}>
                    {message.profiles.full_name || message.profiles.email}
                  </span>
                  <span className={`text-xs text-muted-foreground ${message.user_id === currentUserId ? "order-1" : ""}`}>
                    {formatDistanceToNow(new Date(message.created_at), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
                <div
                  className={`inline-block p-3 rounded-lg shadow-soft max-w-2xl ${
                    message.user_id === currentUserId
                      ? "bg-gradient-accent text-accent-foreground"
                      : "bg-card"
                  }`}
                >
                  <p className="text-sm break-words">{message.content}</p>
                </div>
              </div>
            </div>
          ))}
          {typingUsers.length > 0 && (
            <div className="text-sm text-muted-foreground italic">
              {typingUsers.map(u => u.full_name || u.email).join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="border-t p-4 bg-card shadow-soft">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => {
              setNewMessage(e.target.value);
              if (e.target.value) {
                startTyping();
              } else {
                stopTyping();
              }
            }}
            placeholder={`Message #${channel.name}`}
            disabled={loading}
            className="flex-1"
          />
          <Button
            type="submit"
            disabled={loading || !newMessage.trim()}
            className="bg-gradient-primary hover:opacity-90 transition-opacity"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
};

export default Channel;
