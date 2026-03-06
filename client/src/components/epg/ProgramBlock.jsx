import { useState } from 'react';

export default function ProgramBlock({ program, widthPx, onPlay }) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div
      className="relative h-full border-r border-m3-borderSubtle bg-m3-surfaceContainer
        hover:bg-m3-primaryContainer/20 hover:border-m3-primary/40 cursor-pointer overflow-hidden transition-colors group rounded-sm"
      style={{ width: widthPx, minWidth: 30 }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onClick={onPlay}
      title="Click to watch live"
    >
      <div className="px-1.5 py-1 h-full flex items-center gap-1">
        <span className="text-xs truncate font-medium text-m3-text flex-1">
          {program.title}
        </span>
        <span className="text-m3-primary text-xs opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          ▶
        </span>
      </div>

      {showTooltip && (
        <div className="absolute left-0 top-full z-50 bg-m3-surfaceHigh border border-m3-border shadow-m3-md p-3 text-xs w-52 mt-0.5 pointer-events-none rounded-m3-sm">
          <div className="font-semibold text-m3-text mb-1">{program.title}</div>
          {program.description && (
            <div className="text-m3-muted line-clamp-3">{program.description}</div>
          )}
          <div className="text-m3-primary font-medium mt-2 text-xs">
            {new Date(program.start).toLocaleTimeString()} – {new Date(program.end).toLocaleTimeString()}
          </div>
          <div className="text-m3-muted mt-1 text-xs">Click to watch live</div>
        </div>
      )}
    </div>
  );
}
