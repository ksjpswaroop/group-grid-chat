import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Hash, Plus, Settings, LogOut, MessageSquare, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { DirectMessagesList } from "./DirectMessagesList";
import { NewDMDialog } from "./NewDMDialog";

interface Channel {
  id: string;
  name: string;
  is_private: boolean;
}

interface Profile {
  full_name: string | null;
  email: string;
}

export function AppSidebar() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [newDMOpen, setNewDMOpen] = useState(false);

  useEffect(() => {
    loadChannels();
    loadProfile();
    checkAdminStatus();

    const channelSubscription = supabase
      .channel("channels-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "channels" },
        () => {
          loadChannels();
        }
      )
      .subscribe();

    return () => {
      channelSubscription.unsubscribe();
    };
  }, []);

  const loadChannels = async () => {
    const { data } = await supabase
      .from("channels")
      .select("*")
      .order("name");
    if (data) setChannels(data);
  };

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", user.id)
        .single();
      if (data) setProfile(data);
    }
  };

  const checkAdminStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      setIsAdmin(!!data);
    }
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Error signing out");
    } else {
      toast.success("Signed out successfully");
    }
  };

  return (
    <Sidebar className="w-64">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-accent p-2 rounded-lg">
            <MessageSquare className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          <span className="font-bold text-lg text-sidebar-foreground">TeamSync</span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/70">
            Channels
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {channels.map((channel) => (
                <SidebarMenuItem key={channel.id}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={`/channel/${channel.id}`}
                      className={({ isActive }) =>
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "hover:bg-sidebar-accent/50"
                      }
                    >
                      <Hash className="h-4 w-4" />
                      <span>{channel.name}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <SidebarGroup>
        <div className="flex items-center justify-between px-2">
          <SidebarGroupLabel>Direct Messages</SidebarGroupLabel>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setNewDMOpen(true)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <SidebarGroupContent>
          <DirectMessagesList onNewDM={() => setNewDMOpen(true)} />
        </SidebarGroupContent>
      </SidebarGroup>

      {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-foreground/70">
              Admin
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="/admin"
                      className={({ isActive }) =>
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "hover:bg-sidebar-accent/50"
                      }
                    >
                      <Users className="h-4 w-4" />
                      <span>Manage Users</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="/admin/channels"
                      className={({ isActive }) =>
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "hover:bg-sidebar-accent/50"
                      }
                    >
                      <Plus className="h-4 w-4" />
                      <span>Manage Channels</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        {profile && (
          <div className="flex items-center gap-3 mb-3">
            <Avatar className="h-8 w-8 border-2 border-sidebar-primary">
              <AvatarFallback className="bg-gradient-accent text-xs text-sidebar-primary-foreground">
                {profile.full_name?.[0]?.toUpperCase() || profile.email[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {profile.full_name || "User"}
              </p>
              <p className="text-xs text-sidebar-foreground/60 truncate">
                {profile.email}
              </p>
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSignOut}
          className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent"
        >
          <LogOut className="h-4 w-4" />
          <span className="ml-2">Sign Out</span>
        </Button>
      </SidebarFooter>

      <NewDMDialog open={newDMOpen} onOpenChange={setNewDMOpen} />
    </Sidebar>
  );
}
