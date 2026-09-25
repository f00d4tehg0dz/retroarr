const fmt = (t) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

// One listing in the guide. "Now" listings get the marigold treatment, like the
// highlighted box in a printed TV Guide.
export default function ProgramBlock({ program, widthPx, isNow, isActive, isLive, startsBeforeWindow, onPlay }) {
  const durationMin = Math.round((program.end - program.start) / 60000);
  const tip = `${program.title}\n${isLive ? 'Live 24/7' : `${fmt(program.start)} – ${fmt(program.end)} · ${durationMin} min`}${program.description ? `\n\n${program.description}` : ''}`;

  return (
    <button
      type="button"
      onClick={onPlay}
      title={tip}
      className={`group flex h-full w-full min-w-0 flex-col justify-center overflow-hidden rounded-lg border px-2.5 text-left transition-colors ${
        isActive
          ? 'border-m3-primary bg-m3-primary text-m3-onPrimary'
          : isNow
            ? 'border-m3-primary/50 bg-m3-primary/15 hover:bg-m3-primary/25'
            : 'border-m3-border bg-m3-surfaceContainer/80 hover:border-m3-muted/60 hover:bg-m3-surfaceHigh'
      }`}
    >
      <span className={`flex items-center gap-1.5 truncate text-[13px] font-semibold ${isActive ? '' : 'text-m3-text'}`}>
        {startsBeforeWindow && <span className="opacity-60">‹</span>}
        {isLive && <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${isActive ? 'bg-m3-onPrimary' : 'bg-tv-onair animate-on-air'}`} />}
        <span className="truncate">{program.title}</span>
      </span>
      {widthPx > 110 && (
        <span className={`truncate font-mono text-[10px] tabular-nums ${isActive ? 'opacity-70' : 'text-m3-muted'}`}>
          {isLive ? 'LIVE · 24/7' : `${fmt(program.start)} · ${durationMin}m`}
        </span>
      )}
    </button>
  );
}
