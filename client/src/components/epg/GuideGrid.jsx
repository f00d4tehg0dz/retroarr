import { useMemo, useRef, useState, useEffect } from 'react';
import ProgramBlock from './ProgramBlock';

const HOURS_TO_SHOW = 3;
const CHANNEL_LABEL_WIDTH = 140;
const ROW_HEIGHT = 56;

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

export default function GuideGrid({ xmlData, channels, onChannelSelect, activeChannelId }) {
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [expandedChannelId, setExpandedChannelId] = useState(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const programAreaWidth = Math.max(containerWidth - CHANNEL_LABEL_WIDTH, 400);
  const pxPerMinute = programAreaWidth / (HOURS_TO_SHOW * 60);

  const now = Date.now();
  const windowStart = now - (now % (60 * 60 * 1000));
  const windowEnd = windowStart + HOURS_TO_SHOW * 60 * 60 * 1000;

  const programs = useMemo(() => {
    if (!xmlData) return {};
    return parseXMLTV(xmlData);
  }, [xmlData]);

  const nowPx = ((now - windowStart) / 60000) * pxPerMinute;

  const timeLabels = [];
  for (let i = 0; i <= HOURS_TO_SHOW; i++) {
    const t = windowStart + i * 60 * 60 * 1000;
    timeLabels.push(new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  }

  const halfHourPxs = [];
  for (let i = 0; i < HOURS_TO_SHOW; i++) {
    const t = windowStart + i * 60 * 60 * 1000 + 30 * 60 * 1000;
    halfHourPxs.push(((t - windowStart) / 60000) * pxPerMinute);
  }

  const enabledChannels = channels.filter((c) => c.enabled);

  function handleRowClick(ch, currentProg) {
    setExpandedChannelId(expandedChannelId === ch.id ? null : ch.id);
    if (onChannelSelect) onChannelSelect(ch, currentProg);
  }

  function handleProgramClick(ch, prog) {
    if (onChannelSelect) onChannelSelect(ch, prog);
  }

  function getCurrentProgram(channelId) {
    const progs = programs[channelId] || [];
    return progs.find((p) => p.start <= now && p.end > now);
  }

  return (
    <div ref={containerRef} className="border-t border-m3-border w-full select-none">
      {/* ── Time header ──────────────────────────────────────────── */}
      <div className="flex border-b border-m3-border bg-m3-surface sticky top-0 z-10">
        <div
          className="shrink-0 border-r border-m3-border flex items-center justify-center"
          style={{ width: CHANNEL_LABEL_WIDTH }}
        >
          <span className="text-xs font-bold text-m3-primary">
            {new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <div className="relative flex-1">
          <div className="flex">
            {timeLabels.map((label, i) => (
              <div
                key={i}
                className="text-xs font-medium text-m3-textSecondary px-2 py-2.5 border-r border-m3-borderSubtle"
                style={{ width: `${(1 / HOURS_TO_SHOW) * 100}%` }}
              >
                {label}
              </div>
            ))}
          </div>
          {halfHourPxs.map((px, i) => (
            <div
              key={i}
              className="absolute top-0 bottom-0 border-l border-m3-borderSubtle/40"
              style={{ left: px }}
            />
          ))}
        </div>
      </div>

      {/* ── Channel rows ─────────────────────────────────────────── */}
      {enabledChannels.map((ch) => {
        const channelId = `ch${ch.channelNumber}`;
        const progs = programs[channelId] || [];
        const visible = progs.filter((p) => p.end > windowStart && p.start < windowEnd);
        const isExpanded = expandedChannelId === ch.id;
        const isActive = activeChannelId === ch.id;
        const currentProg = getCurrentProgram(channelId);

        return (
          <div key={ch.id}>
            {/* Main row */}
            <div
              className={`flex items-stretch border-b transition-colors ${
                isActive
                  ? 'border-m3-primary/30 bg-m3-primaryContainer/8'
                  : 'border-m3-borderSubtle'
              }`}
              style={{ height: ROW_HEIGHT }}
            >
              {/* Channel label */}
              <button
                className={`shrink-0 flex items-center px-3 border-r transition-colors cursor-pointer text-left ${
                  isActive
                    ? 'border-m3-primary/30 bg-m3-primaryContainer/15'
                    : 'border-m3-borderSubtle bg-m3-surface hover:bg-m3-primaryContainer/10'
                }`}
                style={{ width: CHANNEL_LABEL_WIDTH }}
                onClick={() => handleRowClick(ch, currentProg)}
                title={`CH ${ch.channelNumber} — ${ch.name}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-bold ${isActive ? 'text-m3-primary' : 'text-m3-primary/70'}`}>
                      {ch.channelNumber}
                    </span>
                    {isActive && (
                      <span className="text-m3-primary text-xs">▶</span>
                    )}
                  </div>
                  <div className={`text-xs truncate font-medium ${isActive ? 'text-m3-text' : 'text-m3-muted'}`}>
                    {ch.name}
                  </div>
                </div>
                <span
                  className="text-m3-muted text-xs ml-1 transition-transform"
                  style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                >
                  ▼
                </span>
              </button>

              {/* Program blocks */}
              <div className="relative flex-1 overflow-hidden">
                {/* Now line */}
                {nowPx > 0 && nowPx < programAreaWidth && (
                  <div
                    className="absolute top-0 bottom-0 z-20 pointer-events-none"
                    style={{ left: nowPx }}
                  >
                    <div className="w-0.5 h-full bg-m3-error/60" />
                  </div>
                )}

                {containerWidth > 0 && visible.map((prog, idx) => {
                  const startPx = Math.max(0, ((prog.start - windowStart) / 60000) * pxPerMinute);
                  const endPx = Math.min(programAreaWidth, ((prog.end - windowStart) / 60000) * pxPerMinute);
                  const widthPx = endPx - startPx;
                  if (widthPx <= 0) return null;

                  const isCurrentProg = prog.start <= now && prog.end > now;

                  return (
                    <div key={idx} className="absolute h-full" style={{ left: startPx }}>
                      <ProgramBlock
                        program={prog}
                        widthPx={widthPx}
                        isActive={isActive && isCurrentProg}
                        onPlay={() => handleProgramClick(ch, prog)}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Expanded details row */}
            {isExpanded && (
              <div
                className={`border-b flex overflow-hidden transition-all ${
                  isActive ? 'border-m3-primary/30' : 'border-m3-borderSubtle'
                }`}
              >
                {/* Watch button area */}
                <div
                  className="shrink-0 border-r border-m3-borderSubtle bg-m3-surfaceContainer/30 px-3 py-3 flex flex-col justify-center gap-2"
                  style={{ width: CHANNEL_LABEL_WIDTH }}
                >
                  <button
                    className="btn-primary text-xs py-1.5 px-3 w-full"
                    onClick={() => handleProgramClick(ch, currentProg)}
                  >
                    Watch Live
                  </button>
                  <div className="text-m3-muted text-xs text-center">
                    {ch.decade} · {ch.category}
                  </div>
                </div>

                {/* Program details */}
                <div className="flex-1 bg-m3-surfaceContainer/20 px-4 py-3 overflow-hidden">
                  {currentProg ? (
                    <div className="flex gap-6">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-m3-muted tracking-wide mb-0.5">NOW PLAYING</div>
                        <div className="text-sm font-semibold text-m3-primary truncate">{currentProg.title}</div>
                        <div className="text-xs text-m3-muted mt-0.5">
                          {new Date(currentProg.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {' – '}
                          {new Date(currentProg.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {' · '}
                          {Math.round((currentProg.end - currentProg.start) / 60000)}m
                        </div>
                        {currentProg.description && (
                          <div className="text-xs text-m3-textSecondary mt-1.5 line-clamp-2 leading-relaxed">
                            {currentProg.description}
                          </div>
                        )}
                      </div>

                      {/* Up next */}
                      {(() => {
                        const nextProg = visible.find((p) => p.start >= currentProg.end);
                        if (!nextProg) return null;
                        return (
                          <div className="w-48 shrink-0 border-l border-m3-borderSubtle pl-4">
                            <div className="text-xs font-medium text-m3-muted tracking-wide mb-0.5">UP NEXT</div>
                            <div className="text-xs font-semibold text-m3-text truncate">{nextProg.title}</div>
                            <div className="text-xs text-m3-muted mt-0.5">
                              {new Date(nextProg.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              {' · '}
                              {Math.round((nextProg.end - nextProg.start) / 60000)}m
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <div className="text-m3-muted text-xs">No program data available for this channel.</div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
