import { useEffect, useState } from "react";
import { useNavigate, Outlet } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { SearchBar } from "@/components/SearchBar";
import { NotificationBell } from "@/components/NotificationBell";
import { usePresenceUpdater } from "@/hooks/usePresenceUpdater";
import { useDesktopNotifications } from "@/hooks/useDesktopNotifications";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";

const Index = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  
  // Auto-update presence
  usePresenceUpdater();
  
  // Enable desktop notifications
  useDesktopNotifications();
  
  // Enable keyboard shortcuts
  useKeyboardShortcuts();

  useEffect(() => {
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_OUT") {
          navigate("/auth");
        }
        // Don't navigate on SIGNED_IN - user is already on a page
      }
    );

    return () => subscription.unsubscribe();
  }, [navigate]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    } else if (window.location.pathname === "/") {
      // Only load first channel if user is on root path
      loadFirstChannel();
    }
    setLoading(false);
  };

  const loadFirstChannel = async () => {
    const { data } = await supabase
      .from("channels")
      .select("id")
      .order("name")
      .limit(1)
      .single();

    if (data) {
      navigate(`/channel/${data.id}`);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-subtle">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <main className="flex-1 flex flex-col" role="main" aria-label="Main content">
          <header 
            className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10"
            role="banner"
          >
            <div className="flex items-center gap-4 px-6 py-3">
              <SidebarTrigger className="lg:hidden" aria-label="Toggle sidebar" />
              <SearchBar />
              <NotificationBell />
            </div>
          </header>
          <div className="flex-1 overflow-hidden">
            <Outlet />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default Index;
