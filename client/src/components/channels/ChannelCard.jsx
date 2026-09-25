import { Link } from 'react-router-dom';
import ChannelToggle from './ChannelToggle';
import usePlayerStore from '../../store/usePlayerStore';
import Icon from '../shared/Icon';
import { thumb, fmtMins, progress } from '../shared/thumb';

export default function ChannelCard({ channel, nowPlaying }) {
  const openPlayer = usePlayerStore((s) => s.open);
  const isLive = !!channel.isLive;
  const isOffline = isLive && channel.liveOnline === false;
  const hasVideos = isLive ? !!channel.liveVideoId && !isOffline : channel.cachedVideos?.length > 0;
  const canPlay = channel.enabled && hasVideos;
  const videoId = nowPlaying?.videoId || (isLive ? channel.liveVideoId : null);
  const img = thumb(videoId) || channel.thumbnailUrl || null;
  const subtitle = isLive ? 'Live 24/7' : channel.isStandalone || channel.isPlugin ? `${channel.decade || ''} ${channel.category || ''}`.trim() : channel.decade;
  const name = isLive || channel.isPlugin || channel.isStandalone ? channel.name : `${channel.decade} ${channel.category}`;
  const remaining = nowPlaying?.duration ? nowPlaying.duration - nowPlaying.seekSeconds : 0;

  return (
    <article
      className={`group relative flex flex-col overflow-hidden rounded-m3 border border-m3-border bg-m3-surface/80 shadow-m3
        transition-all duration-200 hover:-translate-y-0.5 hover:border-m3-primary/40 hover:shadow-m3-md
        ${!channel.enabled ? 'opacity-45 saturate-0' : ''}`}
    >
      {/* Screen */}
      <button
        type="button"
        onClick={() => canPlay && openPlayer(channel)}
        disabled={!canPlay}
        className="relative aspect-video w-full overflow-hidden bg-m3-black text-left scanlines"
        aria-label={canPlay ? `Watch channel ${channel.channelNumber}` : `Channel ${channel.channelNumber} has no signal`}
      >
        {img ? (
          <img src={img} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
        ) : (
          <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_50%_40%,#2a2433,#0b0a0e)]">
            <span className="font-mono text-[11px] font-bold tracking-[0.3em] text-m3-muted">NO SIGNAL</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/30" />

        {/* bug + status */}
        <div className="absolute left-2.5 top-2.5 flex items-center gap-1.5">
          <span className="ch-num">{channel.channelNumber}</span>
        </div>
        <div className="absolute right-2.5 top-2.5">
          {isLive ? (isOffline ? <span className="off-air">Off air</span> : <span className="on-air">Live</span>) : null}
        </div>

        {/* play affordance */}
        {canPlay && (
          <span className="absolute inset-0 grid place-items-center opacity-0 transition-opacity group-hover:opacity-100">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-m3-primary text-m3-onPrimary shadow-glow">
              <Icon name="play" fill size={20} />
            </span>
          </span>
        )}

        {/* now playing overlay */}
        <div className="absolute inset-x-0 bottom-0 p-3">
          <div className="text-[13px] font-semibold leading-snug text-white line-clamp-2 drop-shadow">
            {isLive
              ? isOffline ? 'Stream offline' : nowPlaying?.title || channel.description || 'Streaming now'
              : nowPlaying?.title || (hasVideos ? `${channel.cachedVideos.length} episodes` : 'No content yet')}
          </div>
          {!isLive && nowPlaying?.duration > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/20">
                <div className="h-full rounded-full bg-m3-primary" style={{ width: `${progress(nowPlaying)}%` }} />
              </div>
              <span className="font-mono text-[10px] text-white/70 tabular-nums">{fmtMins(remaining)} left</span>
            </div>
          )}
        </div>
      </button>

      {/* Footer */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <Link to={`/channel/${channel.id}`} className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-m3-text hover:text-m3-primary transition-colors">{name}</div>
          <div className="truncate text-[11px] text-m3-muted">{subtitle}</div>
        </Link>
        <ChannelToggle channel={channel} />
      </div>
    </article>
  );
}
