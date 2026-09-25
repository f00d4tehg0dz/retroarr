import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import usePlayerStore from '../../store/usePlayerStore';
import { useNowPlaying } from '../../hooks/useChannels';
import VideoPlayer from './VideoPlayer';
import Icon from '../shared/Icon';
import { fmtMins, progress } from '../shared/thumb';

export default function PlayerModal() {
  const { channel, isOpen, close } = usePlayerStore();
  const { data: nowPlayingList } = useNowPlaying();

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, close]);

  if (!isOpen || !channel) return null;
  const np = nowPlayingList?.find((c) => c.id === channel.id)?.nowPlaying;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={`Watching ${channel.name}`}>
      <div className="absolute inset-0 bg-m3-black/85 backdrop-blur-md" onClick={close} />

      <div className="relative z-10 flex w-full max-w-5xl flex-col overflow-hidden rounded-m3-xl border border-m3-border bg-m3-surface shadow-m3-lg screen-glow animate-fade-up">
        <div className="relative aspect-video bg-m3-black">
          <div className="absolute inset-0 animate-tune-in">
            <VideoPlayer key={channel.id} channelId={channel.id} />
          </div>
        </div>

        <div className="flex items-center gap-4 border-t border-m3-border px-4 py-3 sm:px-5">
          <span className="ch-num h-8 text-sm">{channel.channelNumber}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate font-display text-base font-bold">{np?.title || channel.name}</span>
              {channel.isLive ? <span className="on-air">Live</span> : null}
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-m3-muted">
              <span className="truncate">{channel.name}{channel.isLive ? ` · 24/7 stream${channel.uploader ? ` · ${channel.uploader}` : ''}` : channel.decade ? ` · ${channel.decade} ${channel.category}` : ''}</span>
              {!channel.isLive && np?.duration > 0 && (
                <>
                  <span className="hidden h-1 w-24 overflow-hidden rounded-full bg-m3-surfaceHigh sm:block">
                    <span className="block h-full rounded-full bg-m3-primary" style={{ width: `${progress(np)}%` }} />
                  </span>
                  <span className="hidden font-mono tabular-nums sm:inline">{fmtMins(np.duration - np.seekSeconds)} left</span>
                </>
              )}
            </div>
          </div>
          <Link to={`/channel/${channel.id}`} onClick={close} className="btn-ghost hidden text-xs sm:inline-flex">Channel info</Link>
          <button onClick={close} className="grid h-9 w-9 place-items-center rounded-full border border-m3-border text-m3-muted transition-colors hover:border-m3-error hover:text-m3-error" title="Close (Esc)">
            <Icon name="x" size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
