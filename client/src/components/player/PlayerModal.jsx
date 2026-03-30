import { useEffect } from 'react';
import usePlayerStore from '../../store/usePlayerStore';
import VideoPlayer from './VideoPlayer';

export default function PlayerModal() {
  const { channel, isOpen, close } = usePlayerStore();

  // ESC to close
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, close]);

  if (!isOpen || !channel) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-m3-black/80 backdrop-blur-sm"
        onClick={close}
      />

      {/* Player panel */}
      <div className="relative z-10 w-full max-w-4xl border border-m3-border rounded-m3-lg shadow-m3-lg flex flex-col overflow-hidden">

        {/* Header bar */}
        <div className="bg-m3-surface border-b border-m3-border px-4 py-2.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-m3-primary font-bold text-xs">
              CH {channel.channelNumber}
            </span>
            <span className="text-m3-border text-xs">—</span>
            <span className="text-m3-text font-medium text-sm">{channel.name}</span>
            <span
              className="border border-m3-error/40 text-m3-error text-xs px-1.5 py-0.5 font-medium rounded-full"
              style={{ animation: 'pulse 2s infinite' }}
            >
              LIVE
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-m3-muted text-xs hidden sm:block">
              {channel.decade} · {channel.category}
            </span>
            <button
              onClick={close}
              className="w-8 h-8 border border-m3-border rounded-full text-m3-muted hover:border-m3-error hover:text-m3-error text-sm flex items-center justify-center transition-colors"
              title="Close (ESC)"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Video (16:9) */}
        <div className="aspect-video bg-m3-black">
          <VideoPlayer key={channel.id} channelId={channel.id} />
        </div>

        {/* Footer */}
        <div className="bg-m3-surface border-t border-m3-borderSubtle px-4 py-2 flex items-center justify-between shrink-0">
          <span className="text-m3-muted text-xs">
            Native YouTube Preview
          </span>
          <span className="text-m3-muted text-xs">ESC to close</span>
        </div>
      </div>
    </div>
  );
}
