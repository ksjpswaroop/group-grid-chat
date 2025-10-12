import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ArchiveChannelDialogProps {
  open: boolean;
  onClose: () => void;
  channelId: string;
  channelName: string;
  isArchived: boolean;
  onSuccess: () => void;
}

export function ArchiveChannelDialog({
  open,
  onClose,
  channelId,
  channelName,
  isArchived,
  onSuccess,
}: ArchiveChannelDialogProps) {
  const [loading, setLoading] = useState(false);

  const handleToggleArchive = async () => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const updateData = isArchived
        ? { archived_at: null, archived_by: null }
        : { archived_at: new Date().toISOString(), archived_by: userData.user.id };

      const { error } = await supabase
        .from('channels')
        .update(updateData)
        .eq('id', channelId);

      if (error) throw error;

      toast.success(
        isArchived ? 'Channel restored successfully' : 'Channel archived successfully'
      );
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error toggling archive:', error);
      toast.error(`Failed to ${isArchived ? 'restore' : 'archive'} channel`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isArchived ? 'Restore' : 'Archive'} Channel
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isArchived ? (
              <>
                Are you sure you want to restore <strong>#{channelName}</strong>?
                This will make it visible and active again.
              </>
            ) : (
              <>
                Are you sure you want to archive <strong>#{channelName}</strong>?
                Archived channels are hidden from the main list but can be restored later.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleToggleArchive} disabled={loading}>
            {loading ? 'Processing...' : isArchived ? 'Restore' : 'Archive'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
