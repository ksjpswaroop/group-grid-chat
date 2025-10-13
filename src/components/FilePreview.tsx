import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface FilePreviewProps {
  fileUrl: string;
  fileName: string;
  fileType: string;
  open: boolean;
  onClose: () => void;
}

export function FilePreview({ fileUrl, fileName, fileType, open, onClose }: FilePreviewProps) {
  const handleDownload = async () => {
    // Extract file ID from URL if it's from our storage
    const match = fileUrl.match(/\/team-files\/(.+)/);
    if (match) {
      try {
        // Get file record to increment download count
        const { data: fileRecord } = await supabase
          .from('file_uploads')
          .select('id')
          .eq('file_url', fileUrl)
          .maybeSingle();

        if (fileRecord) {
          await supabase.rpc('increment_download_count', { file_id: fileRecord.id });
        }
      } catch (error) {
        console.error('Error tracking download:', error);
      }
    }
    
    window.open(fileUrl, '_blank');
  };

  const renderPreview = () => {
    if (fileType.startsWith('image/')) {
      return (
        <img
          src={fileUrl}
          alt={fileName}
          className="max-w-full max-h-[70vh] object-contain mx-auto"
        />
      );
    }

    if (fileType === 'application/pdf') {
      return (
        <iframe
          src={fileUrl}
          title={fileName}
          className="w-full h-[70vh]"
        />
      );
    }

    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground mb-4">
          Preview not available for this file type
        </p>
        <Button onClick={handleDownload}>
          <Download className="h-4 w-4 mr-2" />
          Download File
        </Button>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold truncate">{fileName}</h3>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="overflow-auto">
          {renderPreview()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
