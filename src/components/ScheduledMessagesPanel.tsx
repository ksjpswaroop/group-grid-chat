import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { X, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface ScheduledMessage {
  id: string;
  content: string;
  scheduled_for: string;
  channel_id: string;
  status: string;
}

interface ScheduledMessagesPanelProps {
  onClose: () => void;
}

export function ScheduledMessagesPanel({ onClose }: ScheduledMessagesPanelProps) {
  const [messages, setMessages] = useState<ScheduledMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadScheduledMessages();
  }, []);

  const loadScheduledMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('scheduled_messages')
        .select('*')
        .eq('status', 'pending')
        .is('cancelled_at', null)
        .order('scheduled_for', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error loading scheduled messages:', error);
      toast.error('Failed to load scheduled messages');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (id: string) => {
    try {
      const { error } = await supabase
        .from('scheduled_messages')
        .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      setMessages(messages.filter((m) => m.id !== id));
      toast.success('Scheduled message cancelled');
    } catch (error) {
      console.error('Error cancelling message:', error);
      toast.error('Failed to cancel message');
    }
  };

  return (
    <div className="flex flex-col h-full border-l">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          <h3 className="font-semibold">Scheduled Messages</h3>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <Clock className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No scheduled messages</p>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {messages.map((message) => (
              <div key={message.id} className="border rounded-lg p-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="text-sm font-medium">
                    {format(new Date(message.scheduled_for), 'PPp')}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCancel(message.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {message.content}
                </p>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
