import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Mail, Trash2, RefreshCw } from "lucide-react";
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
import { formatDistanceToNow } from "date-fns";

interface Invitation {
  id: string;
  email: string;
  role: string;
  token: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

const AdminInvitations = () => {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadInvitations();
  }, []);

  const loadInvitations = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("invitations")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load invitations");
      console.error(error);
    } else {
      setInvitations(data || []);
    }
    setLoading(false);
  };

  const handleRevoke = async (id: string) => {
    if (!confirm("Are you sure you want to revoke this invitation?")) return;

    const { error } = await supabase
      .from("invitations")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Failed to revoke invitation");
    } else {
      toast.success("Invitation revoked");
      loadInvitations();
    }
  };

  const handleResend = async (invitation: Invitation) => {
    const inviteLink = `${window.location.origin}/auth?invite=${invitation.token}`;
    await navigator.clipboard.writeText(inviteLink);
    toast.success("Invitation link copied to clipboard");
  };

  const isExpired = (expiresAt: string) => new Date(expiresAt) < new Date();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-accent p-3 rounded-xl">
            <Mail className="h-6 w-6 text-accent-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Invitations</h1>
            <p className="text-muted-foreground">Manage pending user invitations</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={loadInvitations}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <InviteUserDialog />
        </div>
      </div>

      <Card className="p-6 shadow-medium">
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <p className="text-muted-foreground">Loading invitations...</p>
          </div>
        ) : invitations.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <Mail className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No invitations yet</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invitations.map((invite) => (
                <TableRow key={invite.id}>
                  <TableCell className="font-medium">{invite.email}</TableCell>
                  <TableCell>
                    <Badge variant={invite.role === "admin" ? "default" : "secondary"}>
                      {invite.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {invite.accepted_at ? (
                      <Badge variant="outline" className="bg-green-500/10 text-green-500">
                        Accepted
                      </Badge>
                    ) : isExpired(invite.expires_at) ? (
                      <Badge variant="outline" className="bg-red-500/10 text-red-500">
                        Expired
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500">
                        Pending
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {isExpired(invite.expires_at)
                      ? "Expired"
                      : formatDistanceToNow(new Date(invite.expires_at), { addSuffix: true })}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(invite.created_at), { addSuffix: true })}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {!invite.accepted_at && !isExpired(invite.expires_at) && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleResend(invite)}
                          >
                            Copy Link
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRevoke(invite.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
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

export default AdminInvitations;
