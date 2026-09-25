import { useLocation } from 'react-router-dom';
import { useStatus, useSettings } from '../../hooks/useSettings';
import { useNowPlaying } from '../../hooks/useChannels';
import { NAV } from './Sidebar';
import Clock from '../shared/Clock';
import logo from '../../logo.png';

function timeAgo(iso) {
  if (!iso) return 'never';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const h = Math.round(mins / 60);
  return h < 48 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

export default function TopBar() {
  const { pathname } = useLocation();
  const { data: status } = useStatus();
  const { data: settings } = useSettings();
  const { data: nowPlaying } = useNowPlaying();

  const isConnected = !!status;
  const title = NAV.find((n) => (n.exact ? pathname === n.to : pathname.startsWith(n.to)))?.label || 'Channel';
  const ticker = (nowPlaying || []).filter((c) => c.nowPlaying?.title).slice(0, 24);

  return (
    <header className="h-14 shrink-0 flex items-center gap-4 px-4 sm:px-6 border-b border-m3-border bg-m3-surface/40 backdrop-blur-xl">
      {/* mobile brand */}
      <img src={logo} alt="" className="md:hidden w-7 h-7 rounded-lg" />
      <div className="font-display font-bold text-base sm:text-lg tracking-tight">{title}</div>

      {/* now-on ticker */}
      <div className="hidden lg:block flex-1 min-w-0 overflow-hidden mask-fade-r">
        {ticker.length > 0 && (
          <div className="flex w-max animate-marquee hover:[animation-play-state:paused] gap-8 text-xs text-m3-textSecondary whitespace-nowrap">
            {[...ticker, ...ticker].map((c, i) => (
              <span key={i} className="inline-flex items-center gap-2">
                <span className="font-mono font-bold text-m3-primary">{c.channelNumber}</span>
                <span className="text-m3-muted">{c.name}</span>
                <span className="text-m3-text">{c.nowPlaying.title}</span>
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="flex-1 lg:hidden" />

      <div className="flex items-center gap-2 text-xs">
        <span className="hidden sm:inline text-m3-muted">
          Synced <span className="text-m3-textSecondary font-medium">{timeAgo(settings?.lastSync)}</span>
        </span>
        <span className={isConnected ? 'badge-online' : 'badge-error'}>
          <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-m3-success' : 'bg-m3-error'}`} />
          {isConnected ? `${status.activeStreams ?? 0} streaming` : 'Server offline'}
        </span>
        <Clock className="md:hidden text-sm" />
      </div>
    </header>
  );
}
