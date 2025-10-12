import React, { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Reply, Pin, Edit, Trash2, MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import ReactionsBar from "./ReactionsBar";

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

interface MessageItemProps {
  message: Message;
  currentUserId: string;
  isAdmin: boolean;
  threadReplyCount?: number;
  onReply: (messageId: string) => void;
  onPin: (messageId: string) => void;
  onEdit?: (messageId: string) => void;
  onDelete?: (messageId: string) => void;
  onReact: (messageId: string, emoji: string) => void;
  reactions?: Array<{
    emoji: string;
    count: number;
    user_ids: string[];
    current_user_reacted: boolean;
  }>;
}

// Performance: Memoize component to prevent unnecessary re-renders
const MessageItem = ({
  message,
  currentUserId,
  isAdmin,
  threadReplyCount = 0,
  onReply,
  onPin,
  onEdit,
  onDelete,
  onReact,
  reactions = [],
}: MessageItemProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const isOwnMessage = message.user_id === currentUserId;
  const canPin = isAdmin || isOwnMessage;
  const isEdited = message.updated_at !== message.created_at;

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Parse mentions in content
  const renderContent = (content: string) => {
    const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = mentionRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push(content.slice(lastIndex, match.index));
      }
      const [, name, userId] = match;
      const isMentioned = userId === currentUserId;
      parts.push(
        <span
          key={match.index}
          className={isMentioned ? "bg-accent/20 text-accent-foreground px-1 rounded font-medium" : "text-primary font-medium"}
        >
          @{name}
        </span>
      );
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < content.length) {
      parts.push(content.slice(lastIndex));
    }

    return parts.length > 0 ? parts : content;
  };

  return (
    <article
      id={`message-${message.id}`}
      role="article"
      aria-label={`Message from ${message.profiles?.full_name || 'Unknown user'}`}
      className="group py-2 px-4 hover:bg-muted/50 transition-colors"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex gap-3">
        <Avatar className="h-10 w-10 flex-shrink-0">
          <AvatarImage src={message.profiles?.avatar_url} alt={`${message.profiles?.full_name}'s avatar`} />
          <AvatarFallback className="bg-primary text-primary-foreground">
            {getInitials(message.profiles?.full_name || "User")}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-1">
            <span className="font-semibold text-foreground">
              {message.profiles?.full_name || "Unknown User"}
            </span>
            <time className="text-xs text-muted-foreground" dateTime={message.created_at}>
              {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
            </time>
            {isEdited && (
              <span className="text-xs text-muted-foreground italic">(edited)</span>
            )}
            {message.is_pinned && (
              <Pin className="h-3 w-3 text-muted-foreground" aria-label="Pinned message" />
            )}
          </div>

          <div className="text-sm text-foreground whitespace-pre-wrap break-words">
            {renderContent(message.content)}
          </div>

          {reactions.length > 0 && (
            <div role="group" aria-label="Message reactions">
              <ReactionsBar
                reactions={reactions}
                onReact={(emoji) => onReact(message.id, emoji)}
              />
            </div>
          )}

          {threadReplyCount > 0 && !message.parent_message_id && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 text-primary hover:text-primary hover:bg-primary/10 gap-1"
              onClick={() => onReply(message.id)}
              aria-label={`View ${threadReplyCount} ${threadReplyCount === 1 ? "reply" : "replies"}`}
            >
              <MessageSquare className="h-4 w-4" aria-hidden="true" />
              <span className="font-medium">{threadReplyCount}</span>
              <span className="text-muted-foreground">{threadReplyCount === 1 ? "reply" : "replies"}</span>
            </Button>
          )}
        </div>

        {isHovered && (
          <div className="flex items-start gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => onReply(message.id)}
              aria-label="Reply to message"
            >
              <Reply className="h-4 w-4" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label="More options">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canPin && (
                  <DropdownMenuItem onClick={() => onPin(message.id)}>
                    <Pin className="h-4 w-4 mr-2" />
                    {message.is_pinned ? "Unpin" : "Pin"} message
                  </DropdownMenuItem>
                )}
                {isOwnMessage && onEdit && (
                  <DropdownMenuItem onClick={() => onEdit(message.id)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit message
                  </DropdownMenuItem>
                )}
                {(isOwnMessage || isAdmin) && onDelete && (
                  <DropdownMenuItem
                    onClick={() => onDelete(message.id)}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete message
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    </article>
  );
};

// Performance: Export memoized version with custom comparison
export default React.memo(MessageItem, (prevProps, nextProps) => {
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.content === nextProps.message.content &&
    prevProps.message.updated_at === nextProps.message.updated_at &&
    prevProps.message.is_pinned === nextProps.message.is_pinned &&
    prevProps.threadReplyCount === nextProps.threadReplyCount &&
    JSON.stringify(prevProps.reactions) === JSON.stringify(nextProps.reactions) &&
    prevProps.currentUserId === nextProps.currentUserId &&
    prevProps.isAdmin === nextProps.isAdmin
  );
});
