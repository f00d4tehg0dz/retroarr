import { useState, useMemo } from 'react';
import { useNowPlaying } from '../hooks/useChannels';
import CrtTv from '../components/tv/CrtTv';
import LoadingSpinner from '../components/shared/LoadingSpinner';

const DECADES = ['60s', '70s', '80s', '90s', '00s', '10s', '20s'];

export default function TvMode() {
  const { data: nowPlayingList, isLoading } = useNowPlaying();
  const [selectedChannelId, setSelectedChannelId] = useState(null);
  const [selectedDecade, setSelectedDecade] = useState(null);

  const channels = useMemo(() => {
    if (!nowPlayingList) return [];
    return nowPlayingList.filter((ch) => ch.nowPlaying);
  }, [nowPlayingList]);

  const filteredChannels = useMemo(() => {
    if (!selectedDecade) return channels;
    return channels.filter((ch) => ch.decade === selectedDecade);
  }, [channels, selectedDecade]);

  const currentChannel = useMemo(() => {
    if (!channels.length) return null;
    const found = channels.find((ch) => ch.id === selectedChannelId);
    if (found) return found;
    return filteredChannels[0] || channels[0];
  }, [channels, filteredChannels, selectedChannelId]);

  function handleChannelClick(ch) {
    setSelectedChannelId(ch.id);
  }

  if (isLoading) {
    return (
      <div className="-m-5 flex items-center justify-center h-[calc(100vh-3rem)]">
        <LoadingSpinner size="lg" text="Loading channels..." />
      </div>
    );
  }

  if (!channels.length) {
    return (
      <div className="-m-5 flex items-center justify-center h-[calc(100vh-3rem)]">
        <div className="border border-m3-border p-8 rounded-m3 text-center max-w-md">
          <div className="text-m3-primary font-bold text-xl">No Channels Available</div>
          <div className="text-m3-muted text-sm mt-2">
            Enable channels and run a sync from Settings to populate video data.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="-m-5 flex h-[calc(100vh-3rem)] overflow-hidden">
      {/* Left: TV Player */}
      <div className="flex-1 bg-m3-black overflow-hidden">
        <CrtTv
          videoId={currentChannel?.nowPlaying?.videoId}
          seekSeconds={currentChannel?.nowPlaying?.seekSeconds}
          channelName={currentChannel?.name}
          channelNumber={currentChannel?.channelNumber}
        />
      </div>

      {/* Right: Channel Selector */}
      <div className="w-72 shrink-0 bg-m3-surface border-l border-m3-border flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-m3-border">
          <div className="text-sm font-semibold text-m3-primary">
            Channel Selector
          </div>
        </div>

        {/* Decade filter */}
        <div className="px-3 py-3 border-b border-m3-borderSubtle">
          <div className="text-xs font-medium text-m3-muted mb-2">Decade</div>
          <div className="flex gap-1 flex-wrap">
            <button
              onClick={() => setSelectedDecade(null)}
              className={`px-2.5 py-1 text-xs font-medium border rounded-full transition-all ${
                !selectedDecade
                  ? 'bg-m3-primary text-m3-onPrimary border-m3-primary'
                  : 'bg-transparent text-m3-muted border-m3-border hover:border-m3-primary/50 hover:text-m3-primary'
              }`}
            >
              All
            </button>
            {DECADES.map((d) => (
              <button
                key={d}
                onClick={() => setSelectedDecade(selectedDecade === d ? null : d)}
                className={`px-2.5 py-1 text-xs font-medium border rounded-full transition-all ${
                  selectedDecade === d
                    ? 'bg-m3-primary text-m3-onPrimary border-m3-primary'
                    : 'bg-transparent text-m3-muted border-m3-border hover:border-m3-primary/50 hover:text-m3-primary'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* Now Playing info */}
        {currentChannel && (
          <div className="px-3 py-3 border-b border-m3-borderSubtle bg-m3-primaryContainer/10">
            <div className="text-xs font-medium text-m3-muted mb-1">Now Playing</div>
            <div className="text-m3-primary font-bold text-sm truncate">
              CH {currentChannel.channelNumber}
            </div>
            <div className="text-m3-text text-xs font-medium truncate mt-0.5">
              {currentChannel.nowPlaying?.title || 'Unknown'}
            </div>
          </div>
        )}

        {/* Channel list */}
        <div className="flex-1 overflow-y-auto">
          {filteredChannels.map((ch) => {
            const isActive = currentChannel?.id === ch.id;
            return (
              <button
                key={ch.id}
                onClick={() => handleChannelClick(ch)}
                className={`w-full text-left px-3 py-2.5 border-b border-m3-borderSubtle transition-all ${
                  isActive
                    ? 'bg-m3-primaryContainer/20 border-l-2 border-l-m3-primary'
                    : 'border-l-2 border-l-transparent hover:bg-m3-surfaceContainer hover:border-l-m3-muted'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold ${isActive ? 'text-m3-primary' : 'text-m3-muted'}`}>
                    {ch.channelNumber}
                  </span>
                  <span className={`text-xs font-medium truncate ${isActive ? 'text-m3-text' : 'text-m3-textSecondary'}`}>
                    {ch.name}
                  </span>
                </div>
                {ch.nowPlaying && (
                  <div className="text-xs text-m3-muted truncate mt-0.5 pl-8">
                    {ch.nowPlaying.title}
                  </div>
                )}
              </button>
            );
          })}

          {filteredChannels.length === 0 && (
            <div className="px-3 py-6 text-center">
              <div className="text-m3-muted text-xs font-medium">
                No channels for this decade
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
