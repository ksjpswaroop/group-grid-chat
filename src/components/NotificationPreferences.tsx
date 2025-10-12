import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Bell, BellOff } from 'lucide-react';

interface NotificationPreferencesProps {
  channelId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const NotificationPreferences = ({ 
  channelId, 
  open, 
  onOpenChange 
}: NotificationPreferencesProps) => {
  const [setting, setSetting] = useState<'all' | 'mentions' | 'none'>('all');
  const [desktopEnabled, setDesktopEnabled] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && channelId) {
      loadPreferences();
      checkDesktopPermission();
    }
  }, [open, channelId]);

  const checkDesktopPermission = () => {
    if ('Notification' in window) {
      setDesktopEnabled(Notification.permission === 'granted');
    }
  };

  const requestDesktopPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      setDesktopEnabled(permission === 'granted');
      if (permission === 'granted') {
        toast.success('Desktop notifications enabled');
      } else {
        toast.error('Desktop notifications denied');
      }
    }
  };

  const loadPreferences = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('notification_preferences')
      .select('setting')
      .eq('user_id', user.id)
      .eq('channel_id', channelId)
      .maybeSingle();

    if (data) {
      setSetting(data.setting as 'all' | 'mentions' | 'none');
    }
  };

  const updatePreference = async (newSetting: 'all' | 'mentions' | 'none') => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { error } = await supabase
      .from('notification_preferences')
      .upsert({
        user_id: user.id,
        channel_id: channelId,
        setting: newSetting,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,channel_id'
      });

    if (error) {
      toast.error('Failed to update preferences');
      console.error(error);
    } else {
      setSetting(newSetting);
      toast.success('Notification preferences updated');
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Notification Settings</DialogTitle>
          <DialogDescription>
            Choose when you want to be notified about messages in this channel
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-4">
            <Label className="text-base font-semibold">In-app Notifications</Label>
            <RadioGroup
              value={setting}
              onValueChange={(value) => updatePreference(value as 'all' | 'mentions' | 'none')}
              disabled={loading}
            >
              <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="all" id="all" />
                <div className="flex-1">
                  <Label htmlFor="all" className="cursor-pointer font-medium">
                    All messages
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Get notified for every message
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="mentions" id="mentions" />
                <div className="flex-1">
                  <Label htmlFor="mentions" className="cursor-pointer font-medium">
                    Mentions only
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Only when someone @mentions you
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="none" id="none" />
                <div className="flex-1">
                  <Label htmlFor="none" className="cursor-pointer font-medium">
                    Nothing
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Mute this channel completely
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-base font-semibold flex items-center gap-2">
                  {desktopEnabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
                  Desktop Notifications
                </Label>
                <p className="text-sm text-muted-foreground">
                  {desktopEnabled ? 'Enabled' : 'Enable browser notifications'}
                </p>
              </div>
              <Switch
                checked={desktopEnabled}
                onCheckedChange={(checked) => {
                  if (checked) {
                    requestDesktopPermission();
                  } else {
                    setDesktopEnabled(false);
                  }
                }}
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};