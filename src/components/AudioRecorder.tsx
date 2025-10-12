import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square, Pause, Play, Trash2, Send } from 'lucide-react';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { toast } from 'sonner';

interface AudioRecorderProps {
  onRecordingComplete: (audioBlob: Blob, duration: number) => void;
  onCancel: () => void;
}

export function AudioRecorder({ onRecordingComplete, onCancel }: AudioRecorderProps) {
  const {
    isRecording,
    isPaused,
    duration,
    audioBlob,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    clearRecording
  } = useAudioRecorder();

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStart = async () => {
    try {
      await startRecording();
    } catch (error) {
      console.error('Recording error:', error);
      toast.error('Could not access microphone. Please check permissions.');
    }
  };

  const handleSend = () => {
    if (audioBlob) {
      onRecordingComplete(audioBlob, duration);
      clearRecording();
    }
  };

  const handleCancel = () => {
    clearRecording();
    onCancel();
  };

  return (
    <div className="flex items-center gap-2 p-3 bg-muted rounded-lg animate-in fade-in slide-in-from-bottom-2">
      {/* Recording Indicator */}
      <div className="flex items-center gap-2 flex-1">
        {isRecording && !isPaused && (
          <div className="w-3 h-3 rounded-full bg-danger animate-pulse" />
        )}
        <span className="text-sm font-mono font-medium">
          {formatDuration(duration)}
        </span>
        {duration >= 300 && (
          <span className="text-xs text-warning">Max duration reached</span>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-1">
        {!isRecording && !audioBlob && (
          <Button
            size="sm"
            onClick={handleStart}
            className="gap-2"
          >
            <Mic className="h-4 w-4" />
            Start Recording
          </Button>
        )}

        {isRecording && (
          <>
            {isPaused ? (
              <Button
                size="sm"
                variant="outline"
                onClick={resumeRecording}
              >
                <Play className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={pauseRecording}
              >
                <Pause className="h-4 w-4" />
              </Button>
            )}
            <Button
              size="sm"
              variant="destructive"
              onClick={stopRecording}
            >
              <Square className="h-4 w-4" />
            </Button>
          </>
        )}

        {audioBlob && !isRecording && (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={clearRecording}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              onClick={handleSend}
              className="gap-2"
            >
              <Send className="h-4 w-4" />
              Send
            </Button>
          </>
        )}

        <Button
          size="sm"
          variant="ghost"
          onClick={handleCancel}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}