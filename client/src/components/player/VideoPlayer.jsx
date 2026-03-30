import { useState, useEffect, useRef } from 'react';
import { useNowPlaying } from '../../hooks/useChannels';

export default function VideoPlayer({ channelId }) {
  const { data: nowPlayingList } = useNowPlaying();
  const [iframeSrc, setIframeSrc] = useState(null);
  const prevVideoRef = useRef(null);

  // Find the now-playing entry for this channel
  const nowPlaying = nowPlayingList?.find((ch) => ch.id === channelId)?.nowPlaying;

  useEffect(() => {
    if (!nowPlaying?.videoId) {
      setIframeSrc(null);
      return;
    }

    // Only rebuild the iframe when the video ID changes (not on seek updates)
    if (prevVideoRef.current === nowPlaying.videoId) return;
    prevVideoRef.current = nowPlaying.videoId;

    setIframeSrc(
      `https://www.youtube.com/embed/${nowPlaying.videoId}?autoplay=1&start=${nowPlaying.seekSeconds || 0}&controls=1&modestbranding=1&rel=0&iv_load_policy=3`
    );
  }, [nowPlaying?.videoId]);

  return (
    <div className="relative w-full h-full bg-m3-black">
      {iframeSrc ? (
        <iframe
          className="absolute inset-0 w-full h-full"
          src={iframeSrc}
          title="RetroArr Live"
          allow="autoplay; encrypted-media"
          allowFullScreen
          style={{ border: 'none' }}
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <div className="text-m3-primary font-bold text-lg animate-pulse">NO SIGNAL</div>
          <div className="text-m3-muted text-xs">
            {nowPlayingList ? 'No video data for this channel' : 'Loading...'}
          </div>
        </div>
      )}
    </div>
  );
}
