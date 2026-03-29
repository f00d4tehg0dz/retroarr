import { useQuery } from '@tanstack/react-query';
import { useState, useCallback } from 'react';
import { useChannels, useNowPlaying } from '../hooks/useChannels';
import GuideGrid from '../components/epg/GuideGrid';
import LoadingSpinner from '../components/shared/LoadingSpinner';

function useEpgXml() {
  return useQuery({
    queryKey: ['epg'],
    queryFn: () => fetch('/epg.xml').then((r) => r.text()),
    staleTime: 30 * 60 * 1000,
    refetchInterval: 60 * 60 * 1000,
  });
}

export default function EpgPage() {
  const { data: channels, isLoading: channelsLoading } = useChannels();
  const { data: xmlData, isLoading: epgLoading } = useEpgXml();
  const { data: nowPlayingList } = useNowPlaying();
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [showGuide, setShowGuide] = useState(true);

  const isLoading = channelsLoading || epgLoading;

  // Build now-playing map
  const nowPlayingMap = {};
  if (nowPlayingList) {
    for (const entry of nowPlayingList) {
      nowPlayingMap[entry.id] = entry;
    }
  }

  // Select a channel to watch
  const handleChannelSelect = useCallback((channel, program) => {
    setSelectedChannel({ ...channel, currentProgram: program });
  }, []);

  // Auto-select first channel if none selected
  const enabledChannels = channels?.filter((c) => c.enabled) || [];
  const activeChannel = selectedChannel || (enabledChannels.length > 0 ? enabledChannels[0] : null);
  const activeNowPlaying = activeChannel ? nowPlayingMap[activeChannel.id] : null;

  if (isLoading) {
    return (
      <div className="-m-5 flex items-center justify-center h-[calc(100vh-3rem)]">
        <LoadingSpinner size="lg" text="Loading guide..." />
      </div>
    );
  }

  if (!enabledChannels.length) {
    return (
      <div className="-m-5 flex items-center justify-center h-[calc(100vh-3rem)]">
        <div className="border border-m3-border p-8 rounded-m3 text-center max-w-md">
          <div className="text-m3-primary font-bold text-xl">No Channels Available</div>
          <div className="text-m3-muted text-sm mt-2">
            Enable channels from the Channel Grid first.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="-m-5 flex flex-col h-[calc(100vh-3rem)] overflow-hidden">
      {/* ── Hero: Video Player + Now Playing Info ──────────────────────── */}
      <div className="shrink-0 flex border-b border-m3-border bg-m3-bg" style={{ height: showGuide ? '45%' : '85%' }}>
        {/* Video player */}
        <div className="flex-1 bg-m3-black relative min-w-0">
          {activeChannel && activeNowPlaying?.nowPlaying ? (
            <iframe
              key={`${activeChannel.id}-${activeNowPlaying.nowPlaying.videoId}`}
              className="absolute inset-0 w-full h-full"
              src={`https://www.youtube.com/embed/${activeNowPlaying.nowPlaying.videoId}?autoplay=1&start=${activeNowPlaying.nowPlaying.seekSeconds || 0}&controls=1&modestbranding=1&rel=0&iv_load_policy=3`}
              title={activeNowPlaying.nowPlaying.title}
              allow="autoplay; encrypted-media"
              allowFullScreen
              style={{ border: 'none' }}
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-m3-primary font-bold text-xl animate-pulse">NO SIGNAL</div>
              <div className="text-m3-muted text-sm mt-2">Select a channel from the guide</div>
            </div>
          )}
        </div>

        {/* Now Playing info panel */}
        <div className="w-80 shrink-0 bg-m3-surface border-l border-m3-border flex flex-col overflow-hidden">
          {activeChannel && (
            <>
              {/* Channel header */}
              <div className="px-4 py-3 border-b border-m3-border">
                <div className="flex items-center gap-2">
                  <span className="text-m3-primary font-bold text-sm">
                    CH {activeChannel.channelNumber}
                  </span>
                  <span className="text-m3-border">—</span>
                  <span className="text-m3-text font-medium text-sm truncate">
                    {activeChannel.name}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className="border border-m3-error/40 text-m3-error text-xs px-1.5 py-0.5 font-medium rounded-full"
                    style={{ animation: 'pulse 2s infinite' }}
                  >
                    LIVE
                  </span>
                  <span className="text-m3-muted text-xs">
                    {activeChannel.decade} · {activeChannel.category}
                  </span>
                </div>
              </div>

              {/* Now playing details */}
              {activeNowPlaying?.nowPlaying && (
                <div className="px-4 py-3 border-b border-m3-borderSubtle flex-1 overflow-y-auto">
                  <div className="text-xs font-medium text-m3-muted mb-1.5 tracking-wide">
                    NOW PLAYING
                  </div>
                  <div className="text-m3-primary font-semibold text-sm leading-snug">
                    {activeNowPlaying.nowPlaying.title}
                  </div>
                  <div className="text-m3-muted text-xs mt-2 flex items-center gap-2">
                    <span>
                      {Math.floor(activeNowPlaying.nowPlaying.seekSeconds / 60)}m in
                    </span>
                    <span className="text-m3-border">·</span>
                    <span>
                      {Math.floor(activeNowPlaying.nowPlaying.duration / 60)}m total
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-3 h-1 bg-m3-surfaceContainer rounded-full overflow-hidden">
                    <div
                      className="h-full bg-m3-primary rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, (activeNowPlaying.nowPlaying.seekSeconds / activeNowPlaying.nowPlaying.duration) * 100)}%`,
                      }}
                    />
                  </div>

                  {/* Current program info from EPG selection */}
                  {selectedChannel?.currentProgram && (
                    <div className="mt-4 pt-3 border-t border-m3-borderSubtle">
                      <div className="text-xs font-medium text-m3-muted mb-1 tracking-wide">
                        PROGRAM INFO
                      </div>
                      <div className="text-m3-text text-xs font-medium">
                        {selectedChannel.currentProgram.title}
                      </div>
                      {selectedChannel.currentProgram.description && (
                        <div className="text-m3-muted text-xs mt-1.5 leading-relaxed">
                          {selectedChannel.currentProgram.description}
                        </div>
                      )}
                      <div className="text-m3-primary text-xs mt-2 font-medium">
                        {new Date(selectedChannel.currentProgram.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {' – '}
                        {new Date(selectedChannel.currentProgram.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Up next (from nowPlaying list for this channel) */}
              <div className="px-4 py-3 border-t border-m3-borderSubtle bg-m3-surfaceContainer/30">
                <div className="text-xs font-medium text-m3-muted tracking-wide">
                  STREAM INFO
                </div>
                <div className="text-m3-text text-xs font-mono mt-1 select-all truncate">
                  /stream/{activeChannel.id}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Guide Toggle ──────────────────────────────────────────────── */}
      <button
        onClick={() => setShowGuide(!showGuide)}
        className="shrink-0 flex items-center justify-center gap-1.5 py-1.5 bg-m3-surface border-b border-m3-border
          text-m3-muted text-xs font-medium hover:text-m3-primary hover:bg-m3-surfaceContainer transition-colors"
      >
        <span style={{ transform: showGuide ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
          ▼
        </span>
        {showGuide ? 'HIDE GUIDE' : 'SHOW GUIDE'}
      </button>

      {/* ── Channel Guide Grid ────────────────────────────────────────── */}
      {showGuide && (
        <div className="flex-1 overflow-auto min-h-0">
          {xmlData ? (
            <GuideGrid
              xmlData={xmlData}
              channels={enabledChannels}
              onChannelSelect={handleChannelSelect}
              activeChannelId={activeChannel?.id}
            />
          ) : (
            <div className="p-5">
              <div className="border border-m3-error/30 bg-m3-errorContainer/10 p-4 rounded-m3-sm">
                <span className="font-medium text-m3-error text-sm">EPG Unavailable — </span>
                <span className="text-m3-text text-sm">Run a sync from Settings to populate channel data.</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
