import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { PresenceDot } from '@/components/PresenceDot';
import { usePresence } from '@/hooks/usePresence';
import { MessageSquare, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface DMConversation {
  id: string;
  name: string | null;
  other_user: {
    id: string;
    full_name: string;
    email: string;
  } | null;
  last_message: {
    content: string;
    created_at: string;
  } | null;
}

interface DirectMessagesListProps {
  onNewDM?: () => void;
}

export const DirectMessagesList = ({ onNewDM }: DirectMessagesListProps) => {
  const [conversations, setConversations] = useState<DMConversation[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    loadConversations();
    
    const channel = supabase
      .channel('dm-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'direct_messages',
        },
        () => {
          loadConversations();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  const loadConversations = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    setCurrentUserId(user.id);

    // Get all DMs where user is sender or recipient
    const { data: messages } = await supabase
      .from('direct_messages')
      .select(`
        *,
        sender:profiles!direct_messages_sender_id_fkey(id, full_name, email),
        recipient:profiles!direct_messages_recipient_id_fkey(id, full_name, email)
      `)
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .order('created_at', { ascending: false });

    if (!messages) return;

    // Group by conversation (other user)
    const conversationsMap = new Map<string, DMConversation>();
    
    for (const msg of messages) {
      const otherUserId = msg.sender_id === user.id ? msg.recipient_id : msg.sender_id;
      const otherUser = msg.sender_id === user.id ? msg.recipient : msg.sender;
      
      if (!conversationsMap.has(otherUserId)) {
        conversationsMap.set(otherUserId, {
          id: otherUserId,
          name: null,
          other_user: otherUser as any,
          last_message: {
            content: msg.content,
            created_at: msg.created_at
          }
        });
      }
    }

    setConversations(Array.from(conversationsMap.values()));
  };

  const userIds = conversations.map(c => c.other_user?.id).filter(Boolean) as string[];
  const { getPresence } = usePresence(userIds);

  if (conversations.length === 0) {
    return (
      <div className="p-4 text-center">
        <MessageSquare className="w-8 h-8 mx-auto mb-2 text-foreground/60" />
        <p className="text-sm text-foreground/80 mb-3">No direct messages yet</p>
        <Button onClick={onNewDM} size="sm" variant="default">
          <Plus className="w-4 h-4 mr-2" />
          New Message
        </Button>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="space-y-1 p-2">
        {conversations.map((conv) => {
          const otherUser = conv.other_user;
          if (!otherUser) return null;
          
          const presence = getPresence(otherUser.id);
          const initials = otherUser.full_name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase();

          return (
            <NavLink
              key={conv.id}
              to={`/dm/${conv.id}`}
              className={({ isActive }) =>
                `flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors ${
                  isActive ? 'bg-accent' : ''
                }`
              }
            >
              <div className="relative">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-0.5 -right-0.5">
                  <PresenceDot status={presence} />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{otherUser.full_name}</p>
                {conv.last_message && (
                  <p className="text-xs text-muted-foreground truncate">
                    {conv.last_message.content}
                  </p>
                )}
              </div>
            </NavLink>
          );
        })}
      </div>
    </ScrollArea>
  );
};
