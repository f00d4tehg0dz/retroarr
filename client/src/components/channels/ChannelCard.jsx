import { Link } from 'react-router-dom';
import ChannelToggle from './ChannelToggle';
import usePlayerStore from '../../store/usePlayerStore';

export default function ChannelCard({ channel, nowPlaying }) {
  const openPlayer = usePlayerStore((s) => s.open);
  const isLive = !!channel.isLive;
  const isOffline = isLive && channel.liveOnline === false;
  const hasVideos = isLive ? !!channel.liveVideoId && !isOffline : channel.cachedVideos?.length > 0;

  function handlePlay(e) {
    e.preventDefault();
    e.stopPropagation();
    openPlayer(channel);
  }

  return (
    <div
      className={`relative group bg-m3-surface border border-m3-border rounded-m3-sm transition-all
        hover:border-m3-primary/50 hover:shadow-m3
        ${!channel.enabled ? 'opacity-30' : ''}`}
    >
      <Link to={`/channel/${channel.id}`} className="block p-3">
        {/* Channel number + toggle */}
        <div className="flex items-start justify-between mb-2">
          <span className="text-m3-primary text-xs font-bold">
            {channel.channelNumber}
          </span>
          <ChannelToggle channel={channel} />
        </div>

        {/* Channel name */}
        <div className="text-xs font-semibold text-m3-text leading-tight mb-2 flex items-center gap-1.5">
          <span className="truncate">{isLive || channel.isPlugin ? channel.name : channel.category}</span>
          {isLive && (
            <span
              className={`shrink-0 border text-[10px] px-1 py-px font-semibold rounded-full ${
                isOffline ? 'border-m3-muted/40 text-m3-muted' : 'border-m3-error/40 text-m3-error'
              }`}
            >
              {isOffline ? 'OFF AIR' : 'LIVE'}
            </span>
          )}
        </div>

        {/* Now playing */}
        <div className="text-xs truncate pb-5">
          {isLive ? (
            isOffline ? (
              <span className="text-m3-muted">Stream offline</span>
            ) : (
              <span className="text-m3-error">● {nowPlaying?.title || channel.uploader || 'Streaming now'}</span>
            )
          ) : nowPlaying?.title ? (
            <span className="text-m3-success">▶ {nowPlaying.title}</span>
          ) : hasVideos ? (
            <span className="text-m3-muted">{channel.cachedVideos.length} videos</span>
          ) : (
            <span className="text-m3-error">No content</span>
          )}
        </div>

        {/* Indicators */}
        <div className="absolute bottom-2 left-3 flex gap-2">
          {channel.settings?.shuffle && (
            <span className="text-m3-muted text-xs">⇄</span>
          )}
          {channel.settings?.includeCommercials && (
            <span className="text-m3-primary text-xs">AD</span>
          )}
        </div>
      </Link>

      {/* Play button */}
      {channel.enabled && hasVideos && (
        <button
          onClick={handlePlay}
          className="absolute bottom-2 right-2 w-7 h-7 bg-m3-primary text-m3-onPrimary font-semibold text-xs
            flex items-center justify-center rounded-full
            opacity-0 group-hover:opacity-100 transition-opacity
            hover:bg-m3-primary/80"
          title={`Watch CH ${channel.channelNumber} live`}
        >
          ▶
        </button>
      )}
    </div>
  );
}
