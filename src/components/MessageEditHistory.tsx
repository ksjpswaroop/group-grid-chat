import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format } from 'date-fns';

interface EditHistoryEntry {
  id: string;
  content: string;
  edited_by: string;
  editor_name: string;
  edited_at: string;
}

interface MessageEditHistoryProps {
  messageId: string | null;
  open: boolean;
  onClose: () => void;
}

export function MessageEditHistory({ messageId, open, onClose }: MessageEditHistoryProps) {
  const [history, setHistory] = useState<EditHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!messageId || !open) return;

    const loadHistory = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.rpc('get_message_edit_history', {
          msg_id: messageId,
        });

        if (error) throw error;
        setHistory(data || []);
      } catch (error) {
        console.error('Error loading edit history:', error);
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, [messageId, open]);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit History</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[500px]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-muted-foreground">Loading history...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-muted-foreground">No edit history available</p>
            </div>
          ) : (
            <div className="space-y-4 pr-4">
              {history.map((entry) => (
                <div key={entry.id} className="border rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={undefined} />
                      <AvatarFallback className="text-xs">
                        {getInitials(entry.editor_name || 'User')}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{entry.editor_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(entry.edited_at), 'PPp')}
                      </p>
                    </div>
                  </div>
                  <div className="bg-muted rounded p-3 text-sm">
                    {entry.content}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
