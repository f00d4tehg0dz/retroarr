import { useEffect, useRef, useState, useCallback } from 'react';
import mpegts from 'mpegts.js';

export default function VideoPlayer({ channelId }) {
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const retryTimerRef = useRef(null);
  const retryCountRef = useRef(0);
  const activeRef = useRef(true);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState(null);

  const attachPlayer = useCallback(() => {
    if (!videoRef.current || !activeRef.current) return;

    // Tear down any existing player before creating a new one.
    if (playerRef.current) {
      playerRef.current.destroy();
      playerRef.current = null;
    }

    // Must use an absolute URL — mpegts.js fetches inside a Web Worker
    // (WorkerGlobalScope) where relative URLs are invalid.
    const streamUrl = `${window.location.origin}/stream/${channelId}`;

    const player = mpegts.createPlayer({
      type: 'mpegts',
      url: streamUrl,
      isLive: true,
      cors: true,
    }, {
      enableWorker: true,
      liveBufferLatencyChasing: false,
      autoCleanupSourceBuffer: true,
      autoCleanupMinBackwardDuration: 10,
      autoCleanupMaxBackwardDuration: 30,
    });

    playerRef.current = player;
    player.attachMediaElement(videoRef.current);
    player.load();

    player.on(mpegts.Events.MEDIA_INFO, () => {
      if (!activeRef.current) return;
      setLoading(false);
      setRetrying(false);
      setError(null);
      retryCountRef.current = 0;
    });

    player.on(mpegts.Events.ERROR, () => {
      if (!activeRef.current) return;

      const delay = Math.min(3000 * 2 ** retryCountRef.current, 30000);
      retryCountRef.current += 1;

      setLoading(false);
      setRetrying(true);

      retryTimerRef.current = setTimeout(() => {
        if (!activeRef.current) return;
        setLoading(true);
        setRetrying(false);
        attachPlayer();
      }, delay);
    });
  }, [channelId]);

  useEffect(() => {
    if (!videoRef.current) return;

    activeRef.current = true;
    retryCountRef.current = 0;
    setError(null);
    setLoading(true);
    setRetrying(false);

    if (!mpegts.isSupported()) {
      setError('Your browser does not support MSE/MPEG-TS playback.');
      setLoading(false);
      return;
    }

    attachPlayer();

    return () => {
      activeRef.current = false;
      clearTimeout(retryTimerRef.current);
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [channelId, attachPlayer]);

  return (
    <div className="relative w-full h-full bg-m3-black">
      {loading && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10">
          <div className="w-8 h-8 border-2 border-m3-border border-t-m3-primary rounded-full animate-spin" />
          <span className="text-m3-muted text-xs font-medium">
            {retrying ? 'Reconnecting...' : 'Tuning channel...'}
          </span>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-10 px-8 text-center">
          <div className="text-m3-error font-semibold text-sm">Stream Unavailable</div>
          <div className="text-m3-muted text-xs">{error}</div>
          <div className="text-m3-muted text-xs mt-2">
            Ensure the server is running and the channel has video content.
          </div>
        </div>
      )}
      <video
        ref={videoRef}
        className="w-full h-full"
        controls
        autoPlay
        playsInline
      />
    </div>
  );
}
