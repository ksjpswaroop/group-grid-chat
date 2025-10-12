import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { MessageSquare } from "lucide-react";

const Auth = () => {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [isInvite, setIsInvite] = useState(false);
  const [inviteToken, setInviteToken] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      validateInvite(token);
    }
    
    // One-time setup for admin user
    const setupAdmin = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('setup-admin');
        if (error) {
          console.error('Setup error:', error);
        } else {
          console.log('Admin setup complete:', data);
        }
      } catch (err) {
        console.error('Setup failed:', err);
      }
    };
    
    setupAdmin();
  }, [searchParams]);

  const validateInvite = async (token: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('validate-invitation', {
        body: { token }
      });

      if (error || !data.valid) {
        toast.error(data?.message || 'Invalid invitation');
        return;
      }

      setIsInvite(true);
      setInviteToken(token);
      setEmail(data.email);
      toast.success('Valid invitation! Please set your password.');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isInvite) {
        const { data, error } = await supabase.functions.invoke('accept-invitation', {
          body: { 
            token: inviteToken, 
            email, 
            password, 
            fullName 
          }
        });

        if (error) throw error;
        if (!data.success) throw new Error('Failed to accept invitation');

        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) throw signInError;

        toast.success("Account created! Welcome to TeamSync!");
        navigate("/");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        toast.success("Welcome back!");
        navigate("/");
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-subtle p-4">
      <Card className="w-full max-w-md p-8 shadow-large animate-fade-in">
        <div className="flex items-center justify-center mb-8">
          <div className="bg-gradient-primary p-3 rounded-xl">
            <MessageSquare className="h-8 w-8 text-primary-foreground" />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-center mb-2 bg-gradient-primary bg-clip-text text-transparent">
          TeamSync
        </h1>
        <p className="text-center text-muted-foreground mb-6">
          {isInvite ? "Complete your account setup" : "Welcome back! Sign in to continue."}
        </p>

        <form onSubmit={handleAuth} className="space-y-4">
          {isInvite && (
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
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isInvite}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          <Button
            type="submit"
            className="w-full bg-gradient-primary hover:opacity-90 transition-opacity"
            disabled={loading}
          >
            {loading ? "Loading..." : (isInvite ? "Create Account" : "Sign In")}
          </Button>
        </form>

        {!isInvite && (
          <div className="mt-6 text-center p-4 bg-muted/50 rounded-lg border border-border">
            <p className="text-sm text-muted-foreground">
              Don't have an account?
            </p>
            <p className="text-sm text-foreground mt-1">
              Contact your administrator for access.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
};

export default Auth;
