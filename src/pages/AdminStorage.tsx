import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { HardDrive, FileText } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";

interface FileUpload {
  id: string;
  file_name: string;
  file_size: number;
  file_type: string;
  created_at: string;
  user_id: string;
  profiles: {
    full_name: string;
    email: string;
  };
}

const AdminStorage = () => {
  const [files, setFiles] = useState<FileUpload[]>([]);
  const [loading, setLoading] = useState(false);
  const [maxFileSize, setMaxFileSize] = useState("10");
  const [retentionDays, setRetentionDays] = useState("90");
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState({
    totalFiles: 0,
    totalSize: 0,
  });

  useEffect(() => {
    loadFiles();
    loadStorageStats();
  }, []);

  const loadFiles = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("file_uploads")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      toast.error("Failed to load files");
      console.error(error);
    } else if (data) {
      // Fetch profiles separately
      const userIds = [...new Set(data.map(f => f.user_id))];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);

      const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);
      
      const filesWithProfiles = data.map(file => ({
        ...file,
        profiles: profilesMap.get(file.user_id) || { full_name: "", email: "" },
      }));
      
      setFiles(filesWithProfiles);
    }
    setLoading(false);
  };

  const loadStorageStats = async () => {
    const { count } = await supabase
      .from("file_uploads")
      .select("*", { count: "exact", head: true });

    const { data } = await supabase
      .from("file_uploads")
      .select("file_size");

    const totalSize = data?.reduce((sum, file) => sum + (file.file_size || 0), 0) || 0;

    setStats({
      totalFiles: count || 0,
      totalSize,
    });
  };

  const saveStorageSettings = async () => {
    setSaving(true);
    try {
      // Store settings in a configuration table or localStorage
      localStorage.setItem("storage_max_file_size", maxFileSize);
      localStorage.setItem("storage_retention_days", retentionDays);
      
      toast.success("Storage settings saved successfully");
    } catch (error) {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!confirm("Are you sure you want to delete this file?")) return;

    const { error } = await supabase
      .from("file_uploads")
      .delete()
      .eq("id", fileId);

    if (error) {
      toast.error("Failed to delete file");
    } else {
      toast.success("File deleted");
      loadFiles();
      loadStorageStats();
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="bg-gradient-accent p-3 rounded-xl">
          <HardDrive className="h-6 w-6 text-accent-foreground" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Storage Management</h1>
          <p className="text-muted-foreground">Configure file storage and manage uploads</p>
        </div>
      </div>

      {/* Storage Stats */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Total Files</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalFiles}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Total Storage Used</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatBytes(stats.totalSize)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Storage Settings */}
      <Card className="shadow-medium">
        <CardHeader>
          <CardTitle>Storage Settings</CardTitle>
          <CardDescription>
            Configure file upload limits and retention policies
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="maxFileSize">Max File Size (MB)</Label>
              <Input
                id="maxFileSize"
                type="number"
                value={maxFileSize}
                onChange={(e) => setMaxFileSize(e.target.value)}
                placeholder="10"
              />
              <p className="text-xs text-muted-foreground">
                Maximum file size allowed for uploads
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="retentionDays">Retention Period (days)</Label>
              <Input
                id="retentionDays"
                type="number"
                value={retentionDays}
                onChange={(e) => setRetentionDays(e.target.value)}
                placeholder="90"
              />
              <p className="text-xs text-muted-foreground">
                How long to keep files before auto-deletion (0 = forever)
              </p>
            </div>
          </div>
          <Button onClick={saveStorageSettings} disabled={saving}>
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </CardContent>
      </Card>

      {/* Recent Files */}
      <Card className="p-6 shadow-medium">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Recent Uploads</h3>
        </div>
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <p className="text-muted-foreground">Loading files...</p>
          </div>
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No files uploaded yet</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Uploaded By</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {files.map((file) => (
                <TableRow key={file.id}>
                  <TableCell className="font-medium max-w-xs truncate">
                    {file.file_name}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{file.file_type || "unknown"}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatBytes(file.file_size || 0)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {file.profiles?.full_name || file.profiles?.email || "Unknown"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(file.created_at), { addSuffix: true })}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteFile(file.id)}
                      className="text-destructive"
                    >
                      Delete
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

export default AdminStorage;
