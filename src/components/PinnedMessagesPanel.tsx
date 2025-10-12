import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X, Pin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

interface Message {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  is_pinned: boolean;
  pinned_at?: string | null;
  profiles?: {
    full_name: string;
    avatar_url?: string;
  };
}

interface PinnedMessagesPanelProps {
  channelId: string;
  currentUserId: string;
  isAdmin: boolean;
  onClose: () => void;
  onJumpToMessage: (messageId: string) => void;
}

export default function PinnedMessagesPanel({
  channelId,
  currentUserId,
  isAdmin,
  onClose,
  onJumpToMessage,
}: PinnedMessagesPanelProps) {
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPinnedMessages();

    const channel = supabase
      .channel(`pinned-${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `channel_id=eq.${channelId}`,
        },
        () => {
          loadPinnedMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelId]);

  const loadPinnedMessages = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("messages")
      .select("*, profiles!messages_user_id_fkey(full_name, avatar_url)")
      .eq("channel_id", channelId)
      .eq("is_pinned", true)
      .order("pinned_at", { ascending: false });

    if (error) {
      console.error("Error loading pinned messages:", error);
      toast.error("Failed to load pinned messages");
    } else {
      setPinnedMessages(data as any || []);
    }
    setLoading(false);
  };

  const handleUnpin = async (messageId: string) => {
    const { error } = await supabase
      .from("messages")
      .update({ is_pinned: false, pinned_at: null, pinned_by: null })
      .eq("id", messageId);

    if (error) {
      toast.error("Failed to unpin message");
      console.error(error);
    } else {
      toast.success("Message unpinned");
      loadPinnedMessages();
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="flex flex-col h-full border-l bg-background">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Pin className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold">Pinned Messages</h3>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground text-sm">Loading...</p>
          </div>
        ) : pinnedMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <Pin className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground text-sm mb-2">
              No pinned messages yet
            </p>
            <p className="text-xs text-muted-foreground">
              Pin important messages to keep them easily accessible
            </p>
          </div>
        ) : (
          <div className="p-2 space-y-3">
            {pinnedMessages.map((message) => (
              <div
                key={message.id}
                className="p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group"
                onClick={() => onJumpToMessage(message.id)}
              >
                <div className="flex gap-3">
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarImage src={message.profiles?.avatar_url} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      {getInitials(message.profiles?.full_name || "User")}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="font-semibold text-sm">
                        {message.profiles?.full_name || "Unknown User"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(message.created_at), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                    <p className="text-sm text-foreground whitespace-pre-wrap break-words line-clamp-3">
                      {message.content}
                    </p>
                  </div>

                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUnpin(message.id);
                      }}
                    >
                      <Pin className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
