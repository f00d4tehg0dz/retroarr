import { useState } from 'react';

export default function ProgramBlock({ program, widthPx, isActive, onPlay }) {
  const [showTooltip, setShowTooltip] = useState(false);

  const durationMin = Math.round((program.end - program.start) / 60000);
  const startTime = new Date(program.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const endTime = new Date(program.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div
      className={`relative h-full border-r cursor-pointer overflow-hidden transition-colors group rounded-sm ${
        isActive
          ? 'border-m3-primary/40 bg-m3-primaryContainer/25'
          : 'border-m3-borderSubtle bg-m3-surfaceContainer hover:bg-m3-primaryContainer/15'
      }`}
      style={{ width: widthPx, minWidth: 30 }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onClick={onPlay}
    >
      <div className="px-2 py-1 h-full flex flex-col justify-center gap-0.5 min-w-0">
        <div className="flex items-center gap-1">
          {isActive && (
            <span className="text-m3-primary text-xs shrink-0">▶</span>
          )}
          <span className={`text-xs truncate font-medium ${isActive ? 'text-m3-primary' : 'text-m3-text'}`}>
            {program.title}
          </span>
        </div>
        {widthPx > 100 && (
          <span className="text-m3-muted text-xs truncate">
            {startTime} · {durationMin}m
          </span>
        )}
      </div>

      {showTooltip && (
        <div className="absolute left-0 top-full z-50 bg-m3-surfaceHigh border border-m3-border shadow-m3-md p-3 text-xs w-56 mt-0.5 pointer-events-none rounded-m3-sm">
          <div className="font-semibold text-m3-text mb-1">{program.title}</div>
          {program.description && (
            <div className="text-m3-muted line-clamp-3 mb-2">{program.description}</div>
          )}
          <div className="text-m3-primary font-medium text-xs">
            {startTime} – {endTime} · {durationMin}m
          </div>
        </div>
      )}
    </div>
  );
}
