import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Users, Shield, Video } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { InviteUserDialog } from "@/components/InviteUserDialog";
import { CreateUserDialog } from "@/components/CreateUserDialog";

interface User {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  roles: string[];
}

const Admin = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [livekitConfig, setLivekitConfig] = useState({
    api_url: '',
    api_key: '',
    api_secret: '',
  });
  const [savingConfig, setSavingConfig] = useState(false);

  useEffect(() => {
    checkAdminAccess();
    loadUsers();
    loadLivekitConfig();
  }, []);

  const checkAdminAccess = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      
      if (!data) {
        toast.error("Access denied. Admin only.");
      }
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    const { data: profiles } = await supabase.from("profiles").select("*");
    
    if (profiles) {
      const usersWithRoles = await Promise.all(
        profiles.map(async (profile) => {
          const { data: roles } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", profile.id);
          
          return {
            ...profile,
            roles: roles?.map((r) => r.role) || [],
          };
        })
      );
      
      setUsers(usersWithRoles);
    }
    setLoading(false);
  };

  const loadLivekitConfig = async () => {
    const { data, error } = await supabase
      .from('livekit_config')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (data) {
      setLivekitConfig({
        api_url: data.api_url,
        api_key: data.api_key,
        api_secret: data.api_secret,
      });
    }
  };

  const saveLivekitConfig = async () => {
    if (!livekitConfig.api_url || !livekitConfig.api_key || !livekitConfig.api_secret) {
      toast.error('Please fill in all LiveKit configuration fields');
      return;
    }

    setSavingConfig(true);
    try {
      const { data: existing } = await supabase
        .from('livekit_config')
        .select('id')
        .limit(1)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('livekit_config')
          .update(livekitConfig)
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('livekit_config')
          .insert(livekitConfig);

        if (error) throw error;
      }

      toast.success('LiveKit configuration saved successfully');
    } catch (error: any) {
      console.error('Error saving LiveKit config:', error);
      toast.error(error.message || 'Failed to save LiveKit configuration');
    } finally {
      setSavingConfig(false);
    }
  };

  const toggleAdminRole = async (userId: string, currentlyAdmin: boolean) => {
    try {
      if (currentlyAdmin) {
        await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("role", "admin");
        toast.success("Admin role removed");
      } else {
        await supabase.from("user_roles").insert({
          user_id: userId,
          role: "admin",
        });
        toast.success("Admin role granted");
      }
      loadUsers();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-accent p-3 rounded-xl">
            <Users className="h-6 w-6 text-accent-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">User Management</h1>
            <p className="text-muted-foreground">Invite and manage team members</p>
          </div>
        </div>

        <div className="flex gap-2">
          <CreateUserDialog />
          <InviteUserDialog />
        </div>
      </div>

      <Card className="shadow-medium">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            <CardTitle>LiveKit Configuration</CardTitle>
          </div>
          <CardDescription>
            Configure your self-hosted LiveKit server for audio/video calls
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="api_url">LiveKit Server URL</Label>
            <Input
              id="api_url"
              value={livekitConfig.api_url}
              onChange={(e) => setLivekitConfig({ ...livekitConfig, api_url: e.target.value })}
              placeholder="wss://livekit.yourdomain.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="api_key">API Key</Label>
            <Input
              id="api_key"
              value={livekitConfig.api_key}
              onChange={(e) => setLivekitConfig({ ...livekitConfig, api_key: e.target.value })}
              placeholder="API key from LiveKit"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="api_secret">API Secret</Label>
            <Input
              id="api_secret"
              type="password"
              value={livekitConfig.api_secret}
              onChange={(e) => setLivekitConfig({ ...livekitConfig, api_secret: e.target.value })}
              placeholder="API secret from LiveKit"
            />
          </div>
          <Button onClick={saveLivekitConfig} disabled={savingConfig}>
            {savingConfig ? 'Saving...' : 'Save Configuration'}
          </Button>
        </CardContent>
      </Card>

      <Card className="p-6 shadow-medium">
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <p className="text-muted-foreground">Loading users...</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    {user.full_name || "—"}
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    {user.roles.includes("admin") && (
                      <Badge className="bg-gradient-accent">
                        <Shield className="h-3 w-3 mr-1" />
                        Admin
                      </Badge>
                    )}
                    {user.roles.length === 0 && (
                      <Badge variant="secondary">User</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(user.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        toggleAdminRole(user.id, user.roles.includes("admin"))
                      }
                    >
                      {user.roles.includes("admin")
                        ? "Remove Admin"
                        : "Make Admin"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
};

export default Admin;
