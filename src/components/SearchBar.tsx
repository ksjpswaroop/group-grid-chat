import { useState, useCallback, useEffect } from 'react';
import { Search, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface SearchResult {
  id: string;
  content: string;
  user_id: string;
  channel_id: string;
  created_at: string;
  rank: number;
  channel_name?: string;
  user_name?: string;
}

export const SearchBar = () => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [hasAttachments, setHasAttachments] = useState<boolean | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('advanced_search_messages', {
        search_query: searchQuery,
        channel_filter: selectedChannel || null,
        user_filter: selectedUser || null,
        has_attachments: hasAttachments,
        date_from: dateFrom ? new Date(dateFrom).toISOString() : null,
        date_to: dateTo ? new Date(dateTo).toISOString() : null,
        limit_count: 50
      });

      if (error) throw error;

      // Enrich results with channel and user info
      if (data && data.length > 0) {
        const channelIds = [...new Set(data.map((r: any) => r.channel_id))];
        const userIds = [...new Set(data.map((r: any) => r.user_id))];

        const [channelsRes, usersRes] = await Promise.all([
          supabase.from('channels').select('id, name').in('id', channelIds),
          supabase.from('profiles').select('id, full_name').in('id', userIds)
        ]);

        const channelsMap = new Map(channelsRes.data?.map(c => [c.id, c.name]) || []);
        const usersMap = new Map(usersRes.data?.map(u => [u.id, u.full_name]) || []);

        const enrichedResults = data.map((r: any) => ({
          ...r,
          channel_name: channelsMap.get(r.channel_id),
          user_name: usersMap.get(r.user_id)
        }));

        setResults(enrichedResults);
      } else {
        setResults([]);
      }
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const debounce = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => clearTimeout(debounce);
  }, [query, performSearch, selectedChannel, selectedUser, hasAttachments, dateFrom, dateTo]);

  const handleResultClick = (result: SearchResult) => {
    navigate(`/channel/${result.channel_id}`);
    setOpen(false);
    setQuery('');
  };

  return (
    <>
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search messages (⌘K)"
          className="pl-9 bg-secondary/50"
          onClick={() => setOpen(true)}
          readOnly
        />
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Search Messages</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search messages..."
                  className="pl-9"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  autoFocus
                />
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="icon">
                    <Filter className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80" align="end">
                  <div className="space-y-4">
                    <h4 className="font-medium">Advanced Filters</h4>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="attachments">Has attachments</Label>
                      <Switch
                        id="attachments"
                        checked={hasAttachments === true}
                        onCheckedChange={(checked) => setHasAttachments(checked ? true : null)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="date-from">Date from</Label>
                      <Input
                        id="date-from"
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="date-to">Date to</Label>
                      <Input
                        id="date-to"
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        setHasAttachments(null);
                        setSelectedChannel(null);
                        setSelectedUser(null);
                        setDateFrom('');
                        setDateTo('');
                      }}
                    >
                      Clear Filters
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <Tabs defaultValue="messages" className="w-full">
              <TabsList className="w-full">
                <TabsTrigger value="messages" className="flex-1">Messages</TabsTrigger>
                <TabsTrigger value="files" className="flex-1" disabled>Files</TabsTrigger>
                <TabsTrigger value="people" className="flex-1" disabled>People</TabsTrigger>
              </TabsList>

              <TabsContent value="messages" className="mt-4">
                <ScrollArea className="h-[400px]">
                  {loading ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Searching...
                    </div>
                  ) : results.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      {query ? 'No results found' : 'Start typing to search'}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {results.map((result) => (
                        <button
                          key={result.id}
                          onClick={() => handleResultClick(result)}
                          className="w-full text-left p-3 rounded-lg hover:bg-accent transition-colors"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium">
                              #{result.channel_name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(result.created_at), 'MMM d, h:mm a')}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground mb-1">
                            {result.user_name}
                          </p>
                          <p className="text-sm line-clamp-2">{result.content}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
