import { useMemo, useRef, useState, useEffect } from 'react';
import ProgramBlock from './ProgramBlock';
import usePlayerStore from '../../store/usePlayerStore';

const HOURS_TO_SHOW = 3;
const CHANNEL_LABEL_WIDTH = 140;
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

export default function GuideGrid({ xmlData, channels }) {
  const openPlayer = usePlayerStore((s) => s.open);
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);

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

  const timeLabels = [];
  for (let i = 0; i <= HOURS_TO_SHOW; i++) {
    const t = windowStart + i * 60 * 60 * 1000;
    timeLabels.push(new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  }

  const enabledChannels = channels.filter((c) => c.enabled);

  return (
    <div ref={containerRef} className="border-t border-m3-border w-full">
      {/* Time header */}
      <div className="flex border-b border-m3-border bg-m3-surface sticky top-0 z-10">
        <div
          className="shrink-0 border-r border-m3-border"
          style={{ width: CHANNEL_LABEL_WIDTH }}
        />
        <div className="flex flex-1">
          {timeLabels.map((label, i) => (
            <div
              key={i}
              className="text-xs font-medium text-m3-primary px-2 py-2"
              style={{ width: `${(1 / HOURS_TO_SHOW) * 100}%` }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* Channel rows */}
      {enabledChannels.map((ch) => {
        const channelId = `ch${ch.channelNumber}`;
        const progs = programs[channelId] || [];
        const visible = progs.filter(
          (p) => p.end > windowStart && p.start < windowEnd
        );

        return (
          <div
            key={ch.id}
            className="flex items-stretch border-b border-m3-borderSubtle group"
            style={{ height: ROW_HEIGHT }}
          >
            {/* Channel label */}
            <button
              className="shrink-0 flex items-center px-3 border-r border-m3-borderSubtle bg-m3-surface
                hover:bg-m3-primaryContainer/15 transition-colors cursor-pointer text-left"
              style={{ width: CHANNEL_LABEL_WIDTH }}
              onClick={() => openPlayer(ch)}
              title={`Watch CH ${ch.channelNumber} live`}
            >
              <div className="flex-1 min-w-0">
                <div className="text-m3-primary text-xs font-bold flex items-center gap-1">
                  CH {ch.channelNumber}
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity text-m3-primary">▶</span>
                </div>
                <div className="text-m3-muted text-xs truncate font-medium">{ch.name}</div>
              </div>
            </button>

            {/* Program blocks */}
            <div className="relative flex-1 overflow-hidden">
              {containerWidth > 0 && visible.map((prog, idx) => {
                const startPx = Math.max(
                  0,
                  ((prog.start - windowStart) / 60000) * pxPerMinute
                );
                const endPx = Math.min(
                  programAreaWidth,
                  ((prog.end - windowStart) / 60000) * pxPerMinute
                );
                const widthPx = endPx - startPx;
                if (widthPx <= 0) return null;

                return (
                  <div key={idx} className="absolute h-full" style={{ left: startPx }}>
                    <ProgramBlock
                      program={prog}
                      widthPx={widthPx}
                      onPlay={() => openPlayer(ch)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
