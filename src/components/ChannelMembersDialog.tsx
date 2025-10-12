import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Users, UserPlus, UserMinus, Search } from "lucide-react";
import { PresenceDot } from "@/components/PresenceDot";

interface Member {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
}

interface ChannelMembersDialogProps {
  channelId: string;
  channelName: string;
  isAdmin: boolean;
}

export function ChannelMembersDialog({ channelId, channelName, isAdmin }: ChannelMembersDialogProps) {
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [nonMembers, setNonMembers] = useState<Member[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      loadMembers();
      if (isAdmin) {
        loadNonMembers();
      }
    }
  }, [open, channelId, isAdmin]);

  const loadMembers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('channel_members')
        .select('user_id, profiles(id, full_name, email, avatar_url)')
        .eq('channel_id', channelId);

      if (error) throw error;

      const membersList = data
        .map(item => item.profiles as unknown as Member)
        .filter(Boolean);
      
      setMembers(membersList);
    } catch (error: any) {
      console.error('Error loading members:', error);
      toast.error('Failed to load channel members');
    } finally {
      setLoading(false);
    }
  };

  const loadNonMembers = async () => {
    try {
      const { data, error } = await supabase
        .rpc('get_non_channel_members', { p_channel_id: channelId });

      if (error) throw error;
      setNonMembers(data || []);
    } catch (error: any) {
      console.error('Error loading non-members:', error);
    }
  };

  const addMember = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('channel_members')
        .insert({
          channel_id: channelId,
          user_id: userId
        });

      if (error) throw error;

      toast.success('Member added successfully');
      loadMembers();
      loadNonMembers();
    } catch (error: any) {
      console.error('Error adding member:', error);
      toast.error(error.message || 'Failed to add member');
    }
  };

  const removeMember = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('channel_members')
        .delete()
        .eq('channel_id', channelId)
        .eq('user_id', userId);

      if (error) throw error;

      toast.success('Member removed successfully');
      loadMembers();
      loadNonMembers();
    } catch (error: any) {
      console.error('Error removing member:', error);
      toast.error(error.message || 'Failed to remove member');
    }
  };

  const filteredNonMembers = nonMembers.filter(user =>
    user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Users className="h-4 w-4 mr-2" />
          Members ({members.length})
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Channel Members</DialogTitle>
          <DialogDescription>
            Manage members for #{channelName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current Members */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Current Members</h3>
            <ScrollArea className="h-[200px] rounded-md border p-2">
              {loading ? (
                <p className="text-sm text-muted-foreground text-center py-4">Loading...</p>
              ) : members.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No members yet</p>
              ) : (
                <div className="space-y-2">
                  {members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-muted"
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={member.avatar_url} />
                            <AvatarFallback className="text-xs">
                              {getInitials(member.full_name || member.email)}
                            </AvatarFallback>
                          </Avatar>
                          <PresenceDot userIds={[member.id]} className="absolute -bottom-0.5 -right-0.5" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{member.full_name}</p>
                          <p className="text-xs text-muted-foreground">{member.email}</p>
                        </div>
                      </div>
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeMember(member.id)}
                        >
                          <UserMinus className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Add Members (Admin Only) */}
          {isAdmin && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Add Members</h3>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
              <ScrollArea className="h-[200px] rounded-md border p-2">
                {filteredNonMembers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {searchQuery ? 'No users found' : 'All users are already members'}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {filteredNonMembers.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-muted"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={user.avatar_url} />
                            <AvatarFallback className="text-xs">
                              {getInitials(user.full_name || user.email)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium">{user.full_name}</p>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => addMember(user.id)}
                        >
                          <UserPlus className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}