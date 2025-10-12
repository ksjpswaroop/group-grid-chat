import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';

interface UnreadCount {
  channel_id: string;
  unread_count: number;
  channel_name?: string;
}

export const NotificationBell = () => {
  const [unreadCounts, setUnreadCounts] = useState<UnreadCount[]>([]);
  const [totalUnread, setTotalUnread] = useState(0);

  useEffect(() => {
    loadUnreadCounts();

    const channel = supabase
      .channel('message-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        () => {
          loadUnreadCounts();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  const loadUnreadCounts = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase.rpc('get_unread_count', {
      _user_id: user.id
    });

    if (error) {
      console.error('Error loading unread counts:', error);
      return;
    }

    if (data && data.length > 0) {
      // Enrich with channel names
      const channelIds = data.map((c: any) => c.channel_id);
      const { data: channels } = await supabase
        .from('channels')
        .select('id, name')
        .in('id', channelIds);

      const channelsMap = new Map(channels?.map(c => [c.id, c.name]) || []);
      
      const enriched = data.map((c: any) => ({
        ...c,
        channel_name: channelsMap.get(c.channel_id)
      }));

      setUnreadCounts(enriched);
      setTotalUnread(enriched.reduce((sum: number, c: any) => sum + Number(c.unread_count), 0));
    } else {
      setUnreadCounts([]);
      setTotalUnread(0);
    }
  };

  const markChannelAsRead = async (channelId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('channel_read_status')
      .upsert({
        user_id: user.id,
        channel_id: channelId,
        last_read: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    loadUnreadCounts();
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {totalUnread > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {totalUnread > 99 ? '99+' : totalUnread}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-2">
          <h4 className="font-medium text-sm">Notifications</h4>
          {unreadCounts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No unread messages
            </p>
          ) : (
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {unreadCounts.map((count) => (
                  <div
                    key={count.channel_id}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-accent cursor-pointer"
                    onClick={() => markChannelAsRead(count.channel_id)}
                  >
                    <div>
                      <p className="text-sm font-medium">#{count.channel_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {count.unread_count} unread message{count.unread_count !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={(e) => {
                      e.stopPropagation();
                      markChannelAsRead(count.channel_id);
                    }}>
                      Mark read
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
