import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { KeyRound, Copy, Check } from "lucide-react";

interface User {
  id: string;
  email: string;
  full_name: string | null;
}

interface ResetUserPasswordDialogProps {
  users: User[];
  onPasswordReset: () => void;
}

export function ResetUserPasswordDialog({ users, onPasswordReset }: ResetUserPasswordDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [forceChange, setForceChange] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleReset = async () => {
    if (!selectedUserId) {
      toast.error("Please select a user");
      return;
    }

    setResetting(true);
    try {
      const { data, error } = await supabase.functions.invoke('reset-user-password', {
        body: {
          user_id: selectedUserId,
          force_change: forceChange
        }
      });

      if (error) throw error;

      setGeneratedPassword(data.password);
      toast.success("Password reset successfully");
      onPasswordReset();
    } catch (error: any) {
      console.error('Password reset error:', error);
      toast.error(error.message || 'Failed to reset password');
    } finally {
      setResetting(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(generatedPassword);
    setCopied(true);
    toast.success("Password copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setOpen(false);
    setSelectedUserId("");
    setGeneratedPassword("");
    setForceChange(true);
    setCopied(false);
  };

  const selectedUser = users.find(u => u.id === selectedUserId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <KeyRound className="h-4 w-4 mr-2" />
          Reset Password
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Reset User Password</DialogTitle>
          <DialogDescription>
            Generate a new secure password for a user. They will be notified to change it on next login if required.
          </DialogDescription>
        </DialogHeader>
        
        {!generatedPassword ? (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="user">Select User</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a user" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.full_name || user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="force-change">Force password change on next login</Label>
                <p className="text-sm text-muted-foreground">
                  User must change password after signing in
                </p>
              </div>
              <Switch
                id="force-change"
                checked={forceChange}
                onCheckedChange={setForceChange}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="rounded-lg bg-muted p-4 space-y-3">
              <div className="space-y-1">
                <Label className="text-sm font-medium">User</Label>
                <p className="text-sm text-foreground">{selectedUser?.full_name || selectedUser?.email}</p>
              </div>
              
              <div className="space-y-1">
                <Label className="text-sm font-medium">New Password</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={generatedPassword}
                    readOnly
                    className="font-mono"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopy}
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-success" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {forceChange && (
                <p className="text-sm text-warning">
                  ⚠️ User will be required to change this password on next login
                </p>
              )}
            </div>

            <div className="rounded-lg border border-warning/50 bg-warning/10 p-3">
              <p className="text-sm text-warning-foreground">
                <strong>Important:</strong> Save this password securely and send it to the user through a secure channel. This password will not be shown again.
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          {!generatedPassword ? (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleReset} disabled={resetting || !selectedUserId}>
                {resetting ? "Generating..." : "Generate New Password"}
              </Button>
            </>
          ) : (
            <Button onClick={handleClose} className="w-full">
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}