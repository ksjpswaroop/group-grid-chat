import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Paperclip, X, File, Image as ImageIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface FileUploadProps {
  channelId: string;
  onFileUploaded: (fileUrl: string, fileName: string, fileType: string) => void;
  disabled?: boolean;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain'
];

export function FileUpload({ channelId, onFileUploaded, disabled }: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast.error('File size must be less than 10MB');
      return;
    }

    // Validate file type
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      toast.error('File type not supported. Allowed: images, PDF, Word documents, text files');
      return;
    }

    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Generate unique file name
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${user.id}/${channelId}/${Date.now()}.${fileExt}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('team-files')
        .upload(fileName, selectedFile, {
          cacheControl: '3600',
          upsert: false
        });
      
      setUploadProgress(100);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('team-files')
        .getPublicUrl(fileName);

      // Record in database
      await supabase.from('file_uploads').insert({
        file_name: selectedFile.name,
        file_url: publicUrl,
        file_type: selectedFile.type,
        file_size: selectedFile.size,
        channel_id: channelId,
        user_id: user.id
      });

      onFileUploaded(publicUrl, selectedFile.name, selectedFile.type);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      toast.success('File uploaded successfully');
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Failed to upload file');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleCancel = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getFileIcon = () => {
    if (!selectedFile) return <Paperclip className="h-4 w-4" />;
    if (selectedFile.type.startsWith('image/')) {
      return <ImageIcon className="h-4 w-4" />;
    }
    return <File className="h-4 w-4" />;
  };

  return (
    <div className="flex items-center gap-2">
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileSelect}
        className="hidden"
        accept={ALLOWED_FILE_TYPES.join(',')}
        disabled={disabled || uploading}
      />
      
      {!selectedFile ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || uploading}
        >
          <Paperclip className="h-4 w-4" />
        </Button>
      ) : (
        <div className="flex items-center gap-2 p-2 bg-muted rounded-lg flex-1">
          {getFileIcon()}
          <span className="text-sm truncate flex-1">{selectedFile.name}</span>
          {uploading ? (
            <div className="flex items-center gap-2 min-w-[100px]">
              <Progress value={uploadProgress} className="h-2" />
              <span className="text-xs">{Math.round(uploadProgress)}%</span>
            </div>
          ) : (
            <>
              <Button
                type="button"
                size="sm"
                onClick={handleUpload}
                disabled={uploading}
              >
                Upload
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCancel}
              >
                <X className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
