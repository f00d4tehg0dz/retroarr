import { useQuery } from '@tanstack/react-query';
import { useState, useCallback, useMemo } from 'react';
import { useChannels, useNowPlaying } from '../hooks/useChannels';
import GuideGrid from '../components/epg/GuideGrid';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import Icon from '../components/shared/Icon';
import Clock from '../components/shared/Clock';
import { fmtMins, progress } from '../components/shared/thumb';

function useEpgXml() {
  return useQuery({
    queryKey: ['epg'],
    queryFn: () => fetch('/epg.xml').then((r) => r.text()),
    staleTime: 30 * 60 * 1000,
    refetchInterval: 60 * 60 * 1000,
  });
}

const fmt = (t) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export default function EpgPage() {
  const { data: channels, isLoading: channelsLoading } = useChannels();
  const { data: xmlData, isLoading: epgLoading } = useEpgXml();
  const { data: nowPlayingList } = useNowPlaying();
  const [selected, setSelected] = useState(null);
  const [showPreview, setShowPreview] = useState(true);

  const nowPlayingMap = useMemo(() => Object.fromEntries((nowPlayingList || []).map((e) => [e.id, e])), [nowPlayingList]);
  const handleSelect = useCallback((channel, program) => { setSelected({ ...channel, currentProgram: program }); setShowPreview(true); }, []);

  const enabled = (channels || []).filter((c) => c.enabled);
  const active = selected || enabled.slice().sort((a, b) => a.channelNumber - b.channelNumber)[0] || null;
  const np = active ? nowPlayingMap[active.id]?.nowPlaying : null;

  if (channelsLoading || epgLoading) {
    return <div className="grid h-full place-items-center"><LoadingSpinner size="lg" text="Printing this week's listings…" /></div>;
  }

  if (!enabled.length) {
    return (
      <div className="grid h-full place-items-center p-6">
        <div className="panel max-w-md p-8 text-center">
          <div className="eyebrow">Off the air</div>
          <h2 className="mt-2 text-2xl font-extrabold">No channels to list</h2>
          <p className="mt-2 text-sm text-m3-muted">Turn on some channels from On Now, then come back for the listings.</p>
        </div>
      </div>
    );
  }

  const prog = selected?.currentProgram;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Preview */}
      {showPreview && active && (
        <div className="shrink-0 border-b border-m3-border bg-m3-surface/40">
          <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_380px]" style={{ maxHeight: '46vh' }}>
            <div className="relative aspect-video max-h-[46vh] bg-m3-black scanlines">
              {np?.videoId ? (
                <iframe
                  key={`${active.id}-${np.videoId}`}
                  className="absolute inset-0 h-full w-full animate-tune-in"
                  src={`https://www.youtube.com/embed/${np.videoId}?autoplay=1&start=${np.seekSeconds || 0}&controls=1&modestbranding=1&rel=0&iv_load_policy=3`}
                  title={np.title}
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                  style={{ border: 'none' }}
                />
              ) : (
                <div className="absolute inset-0 grid place-items-center">
                  <div className="text-center">
                    <div className="font-mono text-sm font-bold tracking-[0.3em] text-m3-primary animate-on-air">NO SIGNAL</div>
                    <div className="mt-2 text-xs text-m3-muted">Pick a channel from the guide</div>
                  </div>
                </div>
              )}
            </div>

            <div className="hidden flex-col gap-4 overflow-y-auto p-5 lg:flex">
              <div className="flex items-center gap-2">
                <span className="ch-num h-7 text-sm">{active.channelNumber}</span>
                <span className="on-air">{active.isLive ? 'Live' : 'On now'}</span>
              </div>
              <div>
                <div className="text-xs font-medium text-m3-muted">{active.name}{!active.isLive && active.decade ? ` · ${active.decade} ${active.category}` : ''}</div>
                <h2 className="mt-1 font-display text-2xl font-extrabold leading-tight text-balance">{np?.title || prog?.title || active.name}</h2>
              </div>
              {!active.isLive && np?.duration > 0 && (
                <div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-m3-surfaceHigh">
                    <div className="h-full rounded-full bg-m3-primary" style={{ width: `${progress(np)}%` }} />
                  </div>
                  <div className="mt-1.5 flex justify-between font-mono text-[11px] tabular-nums text-m3-muted">
                    <span>{fmtMins(np.seekSeconds)} in</span><span>{fmtMins(np.duration - np.seekSeconds)} left</span>
                  </div>
                </div>
              )}
              {prog && prog.title !== np?.title && (
                <div className="rounded-xl border border-m3-border bg-black/30 p-3">
                  <div className="label mb-1">Selected listing</div>
                  <div className="text-sm font-semibold">{prog.title}</div>
                  <div className="mt-1 font-mono text-[11px] text-m3-primary">{fmt(prog.start)} – {fmt(prog.end)}</div>
                  {prog.description && <p className="mt-2 text-xs leading-relaxed text-m3-textSecondary line-clamp-4">{prog.description}</p>}
                </div>
              )}
              <div className="mt-auto rounded-xl border border-m3-border bg-black/30 px-3 py-2">
                <div className="label mb-0.5">Stream URL</div>
                <div className="truncate font-mono text-xs text-m3-accent select-all">{window.location.origin}/stream/{active.id}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Guide header strip */}
      <div className="flex shrink-0 items-center gap-3 border-b border-m3-border bg-m3-bg/90 px-4 py-2.5 backdrop-blur-xl">
        <div className="font-display text-lg font-extrabold tracking-tight">
          TV <span className="text-m3-primary">Guide</span>
        </div>
        <span className="hidden text-xs text-m3-muted sm:inline">{new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</span>
        <Clock className="ml-2 hidden text-sm sm:inline" />
        <span className="flex-1" />
        <span className="hidden font-mono text-[11px] text-m3-muted md:inline">{enabled.length} channels</span>
        <button className="btn-ghost text-xs" onClick={() => setShowPreview((v) => !v)}>
          <Icon name="down" size={14} className={`transition-transform ${showPreview ? 'rotate-180' : ''}`} />
          {showPreview ? 'Hide preview' : 'Show preview'}
        </button>
      </div>

      {/* Grid */}
      <div className="min-h-0 flex-1 overflow-auto">
        {xmlData ? (
          <GuideGrid xmlData={xmlData} channels={enabled} onChannelSelect={handleSelect} activeChannelId={active?.id} />
        ) : (
          <div className="p-6">
            <div className="panel border-m3-error/40 p-4 text-sm">
              <span className="font-semibold text-m3-error">Guide data unavailable. </span>
              <span className="text-m3-textSecondary">Run a sync from Settings to build the listings.</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
