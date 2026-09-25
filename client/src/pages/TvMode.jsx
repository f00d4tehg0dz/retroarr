import { useState, useMemo, useEffect, useRef } from 'react';
import { useNowPlaying } from '../hooks/useChannels';
import CrtTv from '../components/tv/CrtTv';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import Icon from '../components/shared/Icon';

const DECADES = ['60s', '70s', '80s', '90s', '00s', '10s', '20s'];

export default function TvMode() {
  const { data: nowPlayingList, isLoading } = useNowPlaying();
  const [selectedChannelId, setSelectedChannelId] = useState(null);
  const [selectedDecade, setSelectedDecade] = useState(null);
  const [typed, setTyped] = useState('');
  const typedTimer = useRef(null);
  const listRef = useRef(null);

  const channels = useMemo(
    () => (nowPlayingList || []).filter((ch) => ch.nowPlaying).sort((a, b) => a.channelNumber - b.channelNumber),
    [nowPlayingList]
  );
  const filtered = useMemo(() => {
    if (!selectedDecade) return channels;
    if (selectedDecade === 'Live') return channels.filter((ch) => ch.isLive);
    return channels.filter((ch) => ch.decade === selectedDecade);
  }, [channels, selectedDecade]);
  const hasLive = channels.some((ch) => ch.isLive);

  const current = useMemo(
    () => channels.find((ch) => ch.id === selectedChannelId) || filtered[0] || channels[0] || null,
    [channels, filtered, selectedChannelId]
  );

  // Remote control: ↑/↓ or PageUp/PageDown surf, digits jump to a channel number
  useEffect(() => {
    function onKey(e) {
      if (e.target.closest('input, textarea, select')) return;
      const list = filtered.length ? filtered : channels;
      const idx = list.findIndex((c) => c.id === current?.id);
      if (['ArrowUp', 'PageUp', 'ArrowDown', 'PageDown'].includes(e.key) && list.length) {
        e.preventDefault();
        const dir = e.key === 'ArrowUp' || e.key === 'PageUp' ? -1 : 1;
        setSelectedChannelId(list[(idx + dir + list.length) % list.length].id);
      } else if (/^\d$/.test(e.key)) {
        const next = (typed + e.key).slice(-3);
        setTyped(next);
        clearTimeout(typedTimer.current);
        typedTimer.current = setTimeout(() => {
          const hit = channels.find((c) => String(c.channelNumber) === next);
          if (hit) setSelectedChannelId(hit.id);
          setTyped('');
        }, 1100);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [filtered, channels, current, typed]);

  // keep the active row in view
  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [current?.id]);

  if (isLoading) return <div className="grid h-full place-items-center"><LoadingSpinner size="lg" text="Adjusting the rabbit ears…" /></div>;

  if (!channels.length) {
    return (
      <div className="grid h-full place-items-center p-6">
        <div className="panel max-w-md p-8 text-center">
          <div className="eyebrow">Stand by</div>
          <h2 className="mt-2 text-2xl font-extrabold">Nothing on yet</h2>
          <p className="mt-2 text-sm text-m3-muted">Turn on channels and run a sync from Settings.</p>
        </div>
      </div>
    );
  }

  const surf = (dir) => {
    const list = filtered.length ? filtered : channels;
    const idx = list.findIndex((c) => c.id === current?.id);
    setSelectedChannelId(list[(idx + dir + list.length) % list.length].id);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden lg:flex-row">
      {/* The set */}
      <div className="relative min-h-0 flex-1 bg-[radial-gradient(ellipse_at_50%_35%,#1d1a24_0%,#0b0a0e_70%)]">
        <CrtTv
          videoId={current?.nowPlaying?.videoId}
          seekSeconds={current?.nowPlaying?.seekSeconds}
          channelName={current?.name}
          channelNumber={current?.channelNumber}
        />
        {typed && (
          <div className="absolute left-6 top-6 rounded-lg bg-black/70 px-3 py-1 font-mono text-2xl font-bold text-[#7CFF8A] shadow-lg">{typed.padEnd(2, '-')}</div>
        )}
        <div className="pointer-events-none absolute bottom-3 left-1/2 hidden -translate-x-1/2 font-mono text-[10px] tracking-[0.2em] text-m3-muted lg:block">
          ↑ ↓ TO SURF · TYPE A NUMBER TO TUNE
        </div>
      </div>

      {/* Remote / lineup */}
      <aside className="flex max-h-[45vh] w-full shrink-0 flex-col border-t border-m3-border bg-m3-surface/70 backdrop-blur-xl lg:max-h-none lg:w-80 lg:border-l lg:border-t-0">
        <div className="flex items-center gap-2 border-b border-m3-border p-3">
          <button className="btn-secondary h-10 w-10 !px-0" onClick={() => surf(-1)} aria-label="Channel up"><Icon name="down" className="rotate-180" /></button>
          <div className="flex-1 rounded-xl border border-m3-border bg-black/50 px-3 py-1.5 text-center">
            <div className="font-mono text-2xl font-bold tabular-nums text-m3-primary" style={{ textShadow: '0 0 10px rgba(255,181,71,.6)' }}>
              {String(current?.channelNumber ?? '--').padStart(3, ' ')}
            </div>
            <div className="truncate text-[11px] text-m3-muted">{current?.name}</div>
          </div>
          <button className="btn-secondary h-10 w-10 !px-0" onClick={() => surf(1)} aria-label="Channel down"><Icon name="down" /></button>
        </div>

        <div className="flex gap-1.5 overflow-x-auto border-b border-m3-borderSubtle p-3 [scrollbar-width:none]">
          <button className={`chip shrink-0 ${!selectedDecade ? 'chip-active' : ''}`} onClick={() => setSelectedDecade(null)}>All</button>
          {[...DECADES.filter((d) => channels.some((c) => c.decade === d)), ...(hasLive ? ['Live'] : [])].map((d) => (
            <button key={d} className={`chip shrink-0 ${selectedDecade === d ? 'chip-active' : ''}`} onClick={() => setSelectedDecade(selectedDecade === d ? null : d)}>{d}</button>
          ))}
        </div>

        <div ref={listRef} className="flex-1 overflow-y-auto p-2">
          {filtered.map((ch) => {
            const isActive = current?.id === ch.id;
            return (
              <button
                key={ch.id}
                data-active={isActive}
                onClick={() => setSelectedChannelId(ch.id)}
                className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors ${isActive ? 'bg-m3-primary/15 ring-1 ring-m3-primary/40' : 'hover:bg-m3-surfaceContainer'}`}
              >
                <span className="ch-num">{ch.channelNumber}</span>
                <span className="min-w-0 flex-1">
                  <span className={`flex items-center gap-1.5 truncate text-sm font-semibold ${isActive ? 'text-m3-primary' : 'text-m3-text'}`}>
                    <span className="truncate">{ch.name}</span>
                    {ch.isLive && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-tv-onair animate-on-air" />}
                  </span>
                  <span className="block truncate text-xs text-m3-muted">{ch.nowPlaying?.title}</span>
                </span>
              </button>
            );
          })}
          {!filtered.length && <div className="p-6 text-center text-xs text-m3-muted">Nothing on in that decade.</div>}
        </div>
      </aside>
    </div>
  );
}
