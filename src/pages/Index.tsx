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
import { log } from "@/lib/logger";

const Index = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  
  log.info('Index', 'Index', 'Component rendering');
  
  // Auto-update presence
  usePresenceUpdater();
  
  // Enable desktop notifications
  useDesktopNotifications();
  
  // Enable keyboard shortcuts
  useKeyboardShortcuts();

  useEffect(() => {
    const startTime = log.timeStart('Index', 'useEffect');
    log.info('Index', 'useEffect', 'Setting up auth listener and checking auth');
    
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        log.info('Index', 'onAuthStateChange', `Auth state changed: ${event}`, { 
          hasSession: !!session,
          userId: session?.user?.id 
        });
        
        if (event === "SIGNED_OUT") {
          log.info('Index', 'onAuthStateChange', 'User signed out, navigating to auth');
          navigate("/auth");
        }
        // Don't navigate on SIGNED_IN - user is already on a page
      }
    );

    log.timeEnd('Index', 'useEffect', startTime, 'Auth listener setup complete');

    return () => {
      log.info('Index', 'useEffect', 'Cleaning up auth subscription');
      subscription.unsubscribe();
    };
  }, [navigate]);

  const checkAuth = async () => {
    const startTime = log.timeStart('Index', 'checkAuth');
    log.info('Index', 'checkAuth', 'Checking authentication status');
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      log.info('Index', 'checkAuth', 'Session retrieved', { 
        hasSession: !!session,
        userId: session?.user?.id 
      });
      
      if (!session) {
        log.info('Index', 'checkAuth', 'No session found, navigating to auth');
        navigate("/auth");
      } else if (window.location.pathname === "/") {
        log.info('Index', 'checkAuth', 'User authenticated on root path, loading first channel');
        // Only load first channel if user is on root path
        loadFirstChannel();
      }
    } catch (error) {
      log.error('Index', 'checkAuth', 'Error checking auth', { error });
    } finally {
      setLoading(false);
      log.timeEnd('Index', 'checkAuth', startTime, 'Auth check complete');
    }
  };

  const loadFirstChannel = async () => {
    const startTime = log.timeStart('Index', 'loadFirstChannel');
    log.info('Index', 'loadFirstChannel', 'Loading first available channel');
    
    try {
      const { data, error } = await supabase
        .from("channels")
        .select("id")
        .order("name")
        .limit(1)
        .single();

      if (error) {
        log.error('Index', 'loadFirstChannel', 'Error loading first channel', { error });
        return;
      }

      if (data) {
        log.info('Index', 'loadFirstChannel', 'First channel found, navigating', { channelId: data.id });
        navigate(`/channel/${data.id}`);
      } else {
        log.warn('Index', 'loadFirstChannel', 'No channels found');
      }
    } catch (error) {
      log.error('Index', 'loadFirstChannel', 'Unexpected error loading first channel', { error });
    } finally {
      log.timeEnd('Index', 'loadFirstChannel', startTime, 'First channel load complete');
    }
  };

  if (loading) {
    log.debug('Index', 'render', 'Rendering loading state');
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-subtle">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  log.debug('Index', 'render', 'Rendering main layout');
  
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
