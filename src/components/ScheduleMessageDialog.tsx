import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ScheduleMessageDialogProps {
  open: boolean;
  onClose: () => void;
  channelId: string;
  content: string;
  onScheduled: () => void;
}

export function ScheduleMessageDialog({
  open,
  onClose,
  channelId,
  content,
  onScheduled,
}: ScheduleMessageDialogProps) {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [time, setTime] = useState('12:00');
  const [scheduling, setScheduling] = useState(false);

  const handleSchedule = async () => {
    if (!date) {
      toast.error('Please select a date');
      return;
    }

    const [hours, minutes] = time.split(':').map(Number);
    const scheduledDate = new Date(date);
    scheduledDate.setHours(hours, minutes, 0, 0);

    if (scheduledDate <= new Date()) {
      toast.error('Scheduled time must be in the future');
      return;
    }

    setScheduling(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const { error } = await supabase.from('scheduled_messages').insert({
        channel_id: channelId,
        user_id: userData.user.id,
        content,
        scheduled_for: scheduledDate.toISOString(),
      });

      if (error) throw error;

      toast.success('Message scheduled successfully');
      onScheduled();
      onClose();
    } catch (error) {
      console.error('Error scheduling message:', error);
      toast.error('Failed to schedule message');
    } finally {
      setScheduling(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule Message</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Select Date</Label>
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              disabled={(date) => date < new Date()}
              className="rounded-md border mt-2"
            />
          </div>
          <div>
            <Label htmlFor="time">Select Time</Label>
            <Input
              id="time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="mt-2"
            />
          </div>
          <div className="bg-muted p-3 rounded text-sm">
            <p className="font-medium mb-1">Message Preview:</p>
            <p className="text-muted-foreground">{content}</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={scheduling}>
            Cancel
          </Button>
          <Button onClick={handleSchedule} disabled={scheduling}>
            {scheduling ? 'Scheduling...' : 'Schedule'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
