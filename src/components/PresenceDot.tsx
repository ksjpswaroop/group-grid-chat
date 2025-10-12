import { cn } from '@/lib/utils';

type PresenceStatus = 'online' | 'away' | 'dnd' | 'offline';

interface PresenceDotProps {
  status: PresenceStatus;
  className?: string;
  showLabel?: boolean;
}

export const PresenceDot = ({ status, className, showLabel = false }: PresenceDotProps) => {
  const statusConfig = {
    online: { color: 'bg-green-500', label: 'Online', ring: 'ring-green-500/20' },
    away: { color: 'bg-yellow-500', label: 'Away', ring: 'ring-yellow-500/20' },
    dnd: { color: 'bg-red-500', label: 'Do Not Disturb', ring: 'ring-red-500/20' },
    offline: { color: 'bg-gray-400', label: 'Offline', ring: 'ring-gray-400/20' }
  };

  const config = statusConfig[status];

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className={cn(
        'relative h-2.5 w-2.5 rounded-full ring-2',
        config.color,
        config.ring,
        status === 'online' && 'animate-pulse'
      )}>
        {status === 'dnd' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-0.5 w-1.5 bg-white rounded-full" />
          </div>
        )}
      </div>
      {showLabel && (
        <span className="text-xs text-muted-foreground">{config.label}</span>
      )}
    </div>
  );
};
