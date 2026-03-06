import StatusBadge from '../shared/StatusBadge';
import { useStatus, useSettings } from '../../hooks/useSettings';

export default function TopBar() {
  const { data: status } = useStatus();
  const { data: settings } = useSettings();

  const isConnected = !!status;
  const lastSync = settings?.lastSync
    ? new Date(settings.lastSync).toLocaleString()
    : 'Never';

  return (
    <header className="h-12 bg-m3-surface border-b border-m3-border flex items-center px-5 gap-4 shrink-0">
      <div className="flex-1" />

      <div className="flex items-center gap-4 text-xs text-m3-muted">
        <span>
          Sync: <span className="text-m3-text font-medium">{lastSync}</span>
        </span>

        <StatusBadge
          status={isConnected ? 'online' : 'offline'}
          label={isConnected ? `${status.activeStreams ?? 0} Streams` : 'Offline'}
        />

        <StatusBadge
          status={isConnected ? 'online' : 'offline'}
          label={isConnected ? 'API OK' : 'API Down'}
        />
      </div>
    </header>
  );
}
