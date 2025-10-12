import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface EditMessageDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (content: string) => Promise<void>;
  initialContent: string;
}

export function EditMessageDialog({
  open,
  onClose,
  onSave,
  initialContent,
}: EditMessageDialogProps) {
  const [content, setContent] = useState(initialContent);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setContent(initialContent);
  }, [initialContent, open]);

  const handleSave = async () => {
    if (!content.trim()) return;
    
    setSaving(true);
    try {
      await onSave(content);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Message</DialogTitle>
        </DialogHeader>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Edit your message..."
          className="min-h-[100px]"
          disabled={saving}
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !content.trim()}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
