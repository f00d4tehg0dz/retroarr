import { useMemo, useRef, useState, useEffect } from 'react';
import ProgramBlock from './ProgramBlock';

const HOURS_TO_SHOW = 3;
const ROW_HEIGHT = 64;

function parseXMLTV(xmlString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'application/xml');

  const programs = {};
  const programEls = doc.querySelectorAll('programme');

  programEls.forEach((el) => {
    const channelId = el.getAttribute('channel');
    const startStr = el.getAttribute('start');
    const stopStr = el.getAttribute('stop');

    const parseXMLTVDate = (s) => {
      const d = s.replace(/\s.*$/, '');
      return new Date(
        `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}T${d.slice(8,10)}:${d.slice(10,12)}:${d.slice(12,14)}Z`
      ).getTime();
    };

    const prog = {
      title: el.querySelector('title')?.textContent || 'Unknown',
      description: el.querySelector('desc')?.textContent || '',
      start: parseXMLTVDate(startStr),
      end: parseXMLTVDate(stopStr),
    };

    if (!programs[channelId]) programs[channelId] = [];
    programs[channelId].push(prog);
  });

  return programs;
}

const fmt = (t) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export default function GuideGrid({ xmlData, channels, onChannelSelect, activeChannelId }) {
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) setContainerWidth(entry.contentRect.width);
    });
    observer.observe(containerRef.current);
    const t = setInterval(() => setTick((x) => x + 1), 30000); // move the NOW line
    return () => { observer.disconnect(); clearInterval(t); };
  }, []);

  const labelWidth = containerWidth < 640 ? 96 : 200;
  const programAreaWidth = Math.max(containerWidth - labelWidth, 480);
  const pxPerMinute = programAreaWidth / (HOURS_TO_SHOW * 60);

  const now = Date.now() + tick * 0;
  const HALF = 30 * 60 * 1000;
  const windowStart = now - (now % HALF);
  const windowEnd = windowStart + HOURS_TO_SHOW * 60 * 60 * 1000;

  const programs = useMemo(() => (xmlData ? parseXMLTV(xmlData) : {}), [xmlData]);
  const nowPx = ((now - windowStart) / 60000) * pxPerMinute;

  const slots = [];
  for (let t = windowStart; t < windowEnd; t += HALF) slots.push(t);

  const rows = channels.filter((c) => c.enabled).slice().sort((a, b) => a.channelNumber - b.channelNumber);

  return (
    <div ref={containerRef} className="w-full select-none">
      {/* Time header */}
      <div className="sticky top-0 z-30 flex border-b border-m3-border bg-m3-surface/95 backdrop-blur-xl">
        <div className="shrink-0 flex items-center gap-2 border-r border-m3-border px-4" style={{ width: labelWidth }}>
          <span className="eyebrow hidden sm:inline">Tonight</span>
        </div>
        <div className="relative flex-1 h-10">
          {slots.map((t, i) => (
            <div key={t} className="absolute top-0 bottom-0 flex items-center border-l border-m3-border/70 pl-2" style={{ left: i * 30 * pxPerMinute }}>
              <span className={`font-mono text-xs font-bold tabular-nums ${i === 0 ? 'text-m3-primary' : 'text-m3-textSecondary'}`}>{fmt(t)}</span>
            </div>
          ))}
          {nowPx > 0 && nowPx < programAreaWidth && (
            <div className="absolute bottom-0 z-10 -translate-x-1/2 rounded-t-md bg-tv-onair px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-widest text-white" style={{ left: nowPx }}>NOW</div>
          )}
        </div>
      </div>

      {/* Rows */}
      {rows.map((ch, rowIdx) => {
        const progs = programs[`ch${ch.channelNumber}`] || [];
        const visible = progs.filter((p) => p.end > windowStart && p.start < windowEnd);
        const isActive = activeChannelId === ch.id;
        const currentProg = progs.find((p) => p.start <= now && p.end > now);

        return (
          <div key={ch.id} className={`flex border-b border-m3-borderSubtle ${rowIdx % 2 ? 'bg-white/[0.012]' : ''}`} style={{ height: ROW_HEIGHT }}>
            <button
              className={`shrink-0 flex items-center gap-3 border-r px-3 text-left transition-colors ${
                isActive ? 'border-m3-primary/40 bg-m3-primary/10' : 'border-m3-border bg-m3-surface/70 hover:bg-m3-surfaceContainer'
              }`}
              style={{ width: labelWidth }}
              onClick={() => onChannelSelect?.(ch, currentProg)}
              title={`Watch ${ch.name}`}
            >
              <span className="ch-num">{ch.channelNumber}</span>
              <span className="hidden min-w-0 sm:block">
                <span className={`block truncate text-sm font-semibold ${isActive ? 'text-m3-primary' : 'text-m3-text'}`}>{ch.name}</span>
                <span className="block truncate text-[11px] text-m3-muted">{ch.isLive ? 'Live 24/7' : [ch.decade, ch.category].filter(Boolean).join(' · ')}</span>
              </span>
            </button>

            <div className="relative flex-1 overflow-hidden">
              {nowPx > 0 && nowPx < programAreaWidth && (
                <div className="pointer-events-none absolute top-0 bottom-0 z-20 w-px bg-tv-onair shadow-onair" style={{ left: nowPx }} />
              )}
              {ch.isLive ? (
                <div className="absolute inset-y-1.5 left-1 right-1">
                  <ProgramBlock
                    program={{ title: currentProg?.title || ch.description || ch.name, description: 'Live 24/7 stream', start: windowStart, end: windowEnd }}
                    widthPx={programAreaWidth - 8} isNow isActive={isActive} isLive
                    onPlay={() => onChannelSelect?.(ch, currentProg)}
                  />
                </div>
              ) : containerWidth > 0 && visible.map((prog, idx) => {
                const startPx = Math.max(0, ((prog.start - windowStart) / 60000) * pxPerMinute);
                const endPx = Math.min(programAreaWidth, ((prog.end - windowStart) / 60000) * pxPerMinute);
                const widthPx = endPx - startPx;
                if (widthPx <= 2) return null;
                const isNow = prog.start <= now && prog.end > now;
                return (
                  <div key={idx} className="absolute inset-y-1.5" style={{ left: startPx + 2, width: widthPx - 4 }}>
                    <ProgramBlock
                      program={prog} widthPx={widthPx - 4} isNow={isNow} isActive={isActive && isNow}
                      startsBeforeWindow={prog.start < windowStart}
                      onPlay={() => onChannelSelect?.(ch, prog)}
                    />
                  </div>
                );
              })}
              {!ch.isLive && visible.length === 0 && (
                <div className="absolute inset-y-1.5 left-1 right-1 flex items-center rounded-lg border border-dashed border-m3-border px-3 text-xs text-m3-muted">No listings</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
