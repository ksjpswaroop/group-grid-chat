import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import MessageItem from "./MessageItem";
import { formatDistanceToNow } from "date-fns";

interface Message {
  id: string;
  content: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  channel_id: string;
  parent_message_id?: string | null;
  is_pinned: boolean;
  profiles?: {
    full_name: string;
    avatar_url?: string;
  };
}

interface ThreadPanelProps {
  parentMessage: Message;
  currentUserId: string;
  isAdmin: boolean;
  onClose: () => void;
}

export default function ThreadPanel({
  parentMessage,
  currentUserId,
  isAdmin,
  onClose,
}: ThreadPanelProps) {
  const [replies, setReplies] = useState<Message[]>([]);
  const [replyContent, setReplyContent] = useState("");
  const [isFollowing, setIsFollowing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [participants, setParticipants] = useState<string[]>([]);

  useEffect(() => {
    loadReplies();
    checkFollowStatus();
    loadParticipants();

    const channel = supabase
      .channel(`thread-${parentMessage.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `parent_message_id=eq.${parentMessage.id}`,
        },
        (payload) => {
          loadReplies();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [parentMessage.id]);

  const loadReplies = async () => {
    const { data, error } = await supabase
      .from("messages")
      .select("*, profiles!messages_user_id_fkey(full_name, avatar_url)")
      .eq("parent_message_id", parentMessage.id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error loading replies:", error);
    } else {
      setReplies(data as any || []);
    }
  };

  const checkFollowStatus = async () => {
    const { data } = await supabase
      .from("thread_followers")
      .select("id")
      .eq("thread_id", parentMessage.id)
      .eq("user_id", currentUserId)
      .maybeSingle();

    setIsFollowing(!!data);
  };

  const loadParticipants = async () => {
    const { data } = await supabase
      .from("messages")
      .select("user_id")
      .eq("parent_message_id", parentMessage.id);

    if (data) {
      const uniqueUserIds = Array.from(new Set([
        parentMessage.user_id,
        ...data.map((m) => m.user_id),
      ]));
      setParticipants(uniqueUserIds);
    }
  };

  const toggleFollow = async () => {
    if (isFollowing) {
      await supabase
        .from("thread_followers")
        .delete()
        .eq("thread_id", parentMessage.id)
        .eq("user_id", currentUserId);
    } else {
      await supabase
        .from("thread_followers")
        .insert({ thread_id: parentMessage.id, user_id: currentUserId });
    }
    setIsFollowing(!isFollowing);
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyContent.trim() || isSending) return;

    setIsSending(true);
    const { error } = await supabase.from("messages").insert({
      content: replyContent,
      channel_id: parentMessage.channel_id,
      parent_message_id: parentMessage.id,
      user_id: currentUserId,
    });

    if (error) {
      toast.error("Failed to send reply");
      console.error(error);
    } else {
      setReplyContent("");
      // Auto-follow thread on reply
      if (!isFollowing) {
        await supabase
          .from("thread_followers")
          .insert({ thread_id: parentMessage.id, user_id: currentUserId });
        setIsFollowing(true);
      }
    }
    setIsSending(false);
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
          <h3 className="font-semibold">Thread</h3>
          <Button
            variant={isFollowing ? "secondary" : "outline"}
            size="sm"
            onClick={toggleFollow}
          >
            {isFollowing ? "Following" : "Follow"}
          </Button>
        </div>
        <div className="flex items-center gap-2">
          {participants.length > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="h-3 w-3" />
              <span>{participants.length}</span>
            </div>
          )}
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="p-4 border-b bg-muted/30">
        <div className="flex gap-3">
          <Avatar className="h-8 w-8 flex-shrink-0">
            <AvatarImage src={parentMessage.profiles?.avatar_url} />
            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
              {getInitials(parentMessage.profiles?.full_name || "User")}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 mb-1">
              <span className="font-semibold text-sm">
                {parentMessage.profiles?.full_name || "Unknown User"}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(parentMessage.created_at), { addSuffix: true })}
              </span>
            </div>
            <p className="text-sm text-foreground whitespace-pre-wrap break-words">
              {parentMessage.content}
            </p>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 px-2">
        {replies.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <p className="text-muted-foreground text-sm mb-2">No replies yet</p>
            <p className="text-xs text-muted-foreground">
              Be the first to reply to this thread
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {replies.map((reply) => (
              <MessageItem
                key={reply.id}
                message={reply}
                currentUserId={currentUserId}
                isAdmin={isAdmin}
                onReply={() => {}}
                onPin={() => {}}
                onReact={() => {}}
                reactions={[]}
              />
            ))}
          </div>
        )}
      </ScrollArea>

      <form onSubmit={handleSendReply} className="p-4 border-t">
        <Textarea
          value={replyContent}
          onChange={(e) => setReplyContent(e.target.value)}
          placeholder="Reply to thread..."
          className="min-h-[80px] mb-2 resize-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSendReply(e);
            }
          }}
        />
        <div className="flex justify-end">
          <Button type="submit" disabled={!replyContent.trim() || isSending}>
            {isSending ? "Sending..." : "Send"}
          </Button>
        </div>
      </form>
    </div>
  );
}
