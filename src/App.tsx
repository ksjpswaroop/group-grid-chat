import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { SearchBar } from "@/components/SearchBar";
import { NotificationBell } from "@/components/NotificationBell";
import Auth from "./pages/Auth";
import Index from "./pages/Index";
import Channel from "./pages/Channel";
import DirectMessage from "./pages/DirectMessage";
import Admin from "./pages/Admin";
import AdminChannels from "./pages/AdminChannels";
import NotFound from "./pages/NotFound";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ErrorBoundary } from "./components/ErrorBoundary";

const queryClient = new QueryClient();

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (isAuthenticated === null) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <SidebarProvider>
              {isAuthenticated ? (
                <div className="flex min-h-screen w-full">
                  <AppSidebar />
                  <main className="flex-1 flex flex-col">
                    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
                      <div className="flex items-center gap-4 px-6 py-3">
                        <SearchBar />
                        <NotificationBell />
                      </div>
                    </header>
                    <div className="flex-1">
                      <Routes>
                        <Route path="/" element={<Index />} />
                        <Route path="/channel/:id" element={<Channel />} />
                        <Route path="/dm/:userId" element={<DirectMessage />} />
                        <Route path="/admin" element={<Admin />} />
                        <Route path="/admin/channels" element={<AdminChannels />} />
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </div>
                  </main>
                </div>
              ) : (
                <Routes>
                  <Route path="/auth" element={<Auth />} />
                  <Route path="*" element={<Navigate to="/auth" replace />} />
                </Routes>
              )}
            </SidebarProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
