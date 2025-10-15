import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { DebugPanel } from "@/components/DebugPanel";
import { log } from "@/lib/logger";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import Channel from "./pages/Channel";
import DirectMessage from "./pages/DirectMessage";
import Admin from "./pages/Admin";
import AdminChannels from "./pages/AdminChannels";
import AdminInvitations from "./pages/AdminInvitations";
import AdminStorage from "./pages/AdminStorage";
import ChangePassword from "./pages/ChangePassword";
import { useEffect, useState } from "react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        log.warn('App', 'QueryClient', `Query retry attempt ${failureCount}`, { error });
        return failureCount < 3;
      },
      onError: (error) => {
        log.error('App', 'QueryClient', 'Query error', { error });
      }
    },
    mutations: {
      onError: (error) => {
        log.error('App', 'QueryClient', 'Mutation error', { error });
      }
    }
  }
});

const App = () => {
  const [showDebugPanel, setShowDebugPanel] = useState(false);

  useEffect(() => {
    const startTime = log.timeStart('App', 'App');
    log.info('App', 'App', 'Application initializing');
    
    // Log performance metrics
    const logPerformance = () => {
      if (performance.memory) {
        log.info('App', 'App', 'Memory usage', {
          used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) + 'MB',
          total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024) + 'MB',
          limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024) + 'MB'
        });
      }
    };

    // Log performance every 30 seconds
    const performanceInterval = setInterval(logPerformance, 30000);
    
    // Add keyboard shortcut for debug panel
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setShowDebugPanel(true);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    log.timeEnd('App', 'App', startTime, 'Application initialized');
    
    return () => {
      clearInterval(performanceInterval);
      window.removeEventListener('keydown', handleKeyDown);
      log.info('App', 'App', 'Application cleanup');
    };
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />}>
                <Route path="channel/:id" element={<Channel />} />
                <Route path="dm/:userId" element={<DirectMessage />} />
                <Route path="admin" element={<Admin />} />
                <Route path="admin/channels" element={<AdminChannels />} />
                <Route path="admin/invitations" element={<AdminInvitations />} />
                <Route path="admin/storage" element={<AdminStorage />} />
              </Route>
              <Route path="/auth" element={<Auth />} />
              <Route path="/change-password" element={<ChangePassword />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
          <DebugPanel 
            isOpen={showDebugPanel} 
            onClose={() => setShowDebugPanel(false)} 
          />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
