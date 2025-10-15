import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { logger } from '@/lib/logger';
import { Bug, AlertTriangle, Activity, Download, Trash2 } from 'lucide-react';

interface DebugPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DebugPanel = ({ isOpen, onClose }: DebugPanelProps) => {
  const [logs, setLogs] = useState<any[]>([]);
  const [callStats, setCallStats] = useState<any>({});
  const [infiniteLoops, setInfiniteLoops] = useState<any[]>([]);
  const [performanceIssues, setPerformanceIssues] = useState<any[]>([]);

  useEffect(() => {
    if (!isOpen) return;

    const updateData = () => {
      const allLogs = logger.getLogs();
      const stats = logger.getCallStats();
      
      setLogs(allLogs);
      setCallStats(stats);
      
      // Detect infinite loops
      const loops = Object.entries(stats)
        .filter(([key, stat]: [string, any]) => stat.callsPerSecond > 5)
        .map(([key, stat]) => ({ key, ...stat }));
      setInfiniteLoops(loops);
      
      // Detect performance issues
      const perfIssues = allLogs
        .filter(log => log.duration && log.duration > 1000)
        .map(log => ({
          component: log.component,
          function: log.function,
          duration: log.duration,
          timestamp: log.timestamp
        }));
      setPerformanceIssues(perfIssues);
    };

    updateData();
    const interval = setInterval(updateData, 1000);

    return () => clearInterval(interval);
  }, [isOpen]);

  const exportLogs = () => {
    const data = logger.exportLogs();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `debug-logs-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearLogs = () => {
    logger.clear();
    setLogs([]);
    setCallStats({});
    setInfiniteLoops([]);
    setPerformanceIssues([]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-6xl h-[80vh] flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bug className="h-5 w-5" />
            Debug Panel
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportLogs}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button variant="outline" size="sm" onClick={clearLogs}>
              <Trash2 className="h-4 w-4 mr-2" />
              Clear
            </Button>
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="flex-1 overflow-hidden">
          <Tabs defaultValue="logs" className="h-full flex flex-col">
            <TabsList>
              <TabsTrigger value="logs">Logs ({logs.length})</TabsTrigger>
              <TabsTrigger value="calls">
                Call Stats ({Object.keys(callStats).length})
              </TabsTrigger>
              <TabsTrigger value="loops">
                Infinite Loops ({infiniteLoops.length})
              </TabsTrigger>
              <TabsTrigger value="performance">
                Performance ({performanceIssues.length})
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="logs" className="flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="space-y-2 p-4">
                  {logs.slice(-100).map((log, index) => (
                    <div
                      key={index}
                      className={`p-2 rounded text-sm font-mono ${
                        log.level === 'error' ? 'bg-red-50 text-red-800' :
                        log.level === 'warn' ? 'bg-yellow-50 text-yellow-800' :
                        log.level === 'info' ? 'bg-blue-50 text-blue-800' :
                        'bg-gray-50 text-gray-800'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {log.level}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {log.category}
                        </Badge>
                        <span className="font-semibold">
                          {log.component}.{log.function}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                        {log.duration && (
                          <Badge variant="outline" className="text-xs">
                            {log.duration}ms
                          </Badge>
                        )}
                      </div>
                      <div className="mt-1">{log.message}</div>
                      {log.data && (
                        <pre className="mt-1 text-xs bg-white p-2 rounded overflow-x-auto">
                          {JSON.stringify(log.data, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
            
            <TabsContent value="calls" className="flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="space-y-2 p-4">
                  {Object.entries(callStats).map(([key, stat]: [string, any]) => (
                    <div key={key} className="p-3 border rounded">
                      <div className="font-semibold">{key}</div>
                      <div className="text-sm text-gray-600 mt-1">
                        <div>Total calls: {stat.count}</div>
                        <div>Calls per second: {stat.callsPerSecond}</div>
                        <div>Last call: {new Date(stat.lastCall).toLocaleTimeString()}</div>
                      </div>
                      {stat.callsPerSecond > 3 && (
                        <Alert className="mt-2">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription>
                            High call frequency detected! This might indicate an infinite loop.
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
            
            <TabsContent value="loops" className="flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="space-y-2 p-4">
                  {infiniteLoops.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">
                      No infinite loops detected
                    </div>
                  ) : (
                    infiniteLoops.map((loop, index) => (
                      <Alert key={index} variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          <div className="font-semibold">{loop.key}</div>
                          <div className="text-sm mt-1">
                            {loop.callsPerSecond} calls per second (threshold: 5)
                          </div>
                        </AlertDescription>
                      </Alert>
                    ))
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
            
            <TabsContent value="performance" className="flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="space-y-2 p-4">
                  {performanceIssues.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">
                      No performance issues detected
                    </div>
                  ) : (
                    performanceIssues.map((issue, index) => (
                      <div key={index} className="p-3 border rounded bg-yellow-50">
                        <div className="font-semibold">
                          {issue.component}.{issue.function}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          Duration: {issue.duration}ms (threshold: 1000ms)
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {new Date(issue.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};