import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";

export const CreateUserDialog = () => {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"admin" | "user">("user");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const generatePassword = () => {
    // Ensure password has all required characters: uppercase, lowercase, number, special
    const lowercase = "abcdefghjkmnpqrstuvwxyz";
    const uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    const numbers = "23456789";
    const special = "!@#$%&*";
    
    // Start with one of each required type
    let password = 
      lowercase.charAt(Math.floor(Math.random() * lowercase.length)) +
      uppercase.charAt(Math.floor(Math.random() * uppercase.length)) +
      numbers.charAt(Math.floor(Math.random() * numbers.length)) +
      special.charAt(Math.floor(Math.random() * special.length));
    
    // Fill the rest randomly
    const allChars = lowercase + uppercase + numbers + special;
    for (let i = password.length; i < 12; i++) {
      password += allChars.charAt(Math.floor(Math.random() * allChars.length));
    }
    
    // Shuffle the password
    password = password.split('').sort(() => Math.random() - 0.5).join('');
    setTemporaryPassword(password);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('create-user-direct', {
        body: { email, fullName, role, temporaryPassword }
      });

      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || 'Failed to create user');
      }

      if (data?.error) {
        console.error('Edge function returned error:', data.error);
        throw new Error(data.error);
      }

      if (!data?.success) {
        console.error('Unexpected response:', data);
        throw new Error('Failed to create user - unexpected response');
      }

      toast.success(`User created! Temporary password: ${temporaryPassword}`, {
        duration: 10000,
      });
      
      setOpen(false);
      setEmail("");
      setFullName("");
      setRole("user");
      setTemporaryPassword("");
      
      // Reload the users list
      window.location.reload();
    } catch (error: any) {
      console.error('Create user error:', error);
      const errorMessage = error.message || 'Failed to create user';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <UserPlus className="h-4 w-4" />
          Create User
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New User</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleCreateUser} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              type="text"
              placeholder="John Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select value={role} onValueChange={(v: "admin" | "user") => setRole(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">Member</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tempPassword">Temporary Password</Label>
            <div className="flex gap-2">
              <Input
                id="tempPassword"
                type="text"
                placeholder="Auto-generated password"
                value={temporaryPassword}
                onChange={(e) => setTemporaryPassword(e.target.value)}
                required
              />
              <Button type="button" variant="outline" onClick={generatePassword}>
                Generate
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Must be 8+ characters with uppercase, lowercase, number, and special character (@$!%*?&). User will be required to change this password on first login.
            </p>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating..." : "Create User"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
