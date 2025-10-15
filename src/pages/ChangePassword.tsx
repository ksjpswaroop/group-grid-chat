import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { PasswordInput } from "@/components/PasswordInput";
import { PasswordStrengthIndicator } from "@/components/PasswordStrengthIndicator";
import { PasswordRequirements } from "@/components/PasswordRequirements";

const ChangePassword = () => {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    checkPasswordChangeRequired();
  }, []);

  const checkPasswordChangeRequired = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("password_change_required")
      .eq("id", user.id)
      .single();

    if (!profile?.password_change_required) {
      navigate("/");
    }
  };

  const validatePassword = (password: string): boolean => {
    if (password.length < 12) {
      toast.error("Password must be at least 12 characters");
      return false;
    }
    if (!/[a-z]/.test(password)) {
      toast.error("Password must contain lowercase letters");
      return false;
    }
    if (!/[A-Z]/.test(password)) {
      toast.error("Password must contain uppercase letters");
      return false;
    }
    if (!/[0-9]/.test(password)) {
      toast.error("Password must contain numbers");
      return false;
    }
    if (!/[@$!%*?&]/.test(password)) {
      toast.error("Password must contain special characters (@$!%*?&)");
      return false;
    }
    return true;
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (!validatePassword(newPassword)) {
      return;
    }

    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No active session");

      const { error, data } = await supabase.functions.invoke('update-user-password', {
        body: { newPassword }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Password changed successfully!");
      navigate("/");
    } catch (error: any) {
      toast.error(error.message || "Failed to change password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="bg-gradient-accent p-2 rounded-lg">
              <Lock className="h-5 w-5 text-accent-foreground" />
            </div>
            <CardTitle className="text-2xl">Change Password</CardTitle>
          </div>
          <CardDescription>
            Your account requires a password change. Please set a new secure password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <PasswordInput
                id="newPassword"
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={12}
                aria-describedby="password-requirements"
              />
              <PasswordStrengthIndicator password={newPassword} className="mt-2" />
            </div>

            <PasswordRequirements password={newPassword} />

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <PasswordInput
                id="confirmPassword"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={12}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Changing..." : "Change Password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ChangePassword;
