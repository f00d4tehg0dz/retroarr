// "Please stand by" — a tiny set of colour bars that sweep while loading.
export default function LoadingSpinner({ size = 'md', text }) {
  const h = { sm: 'h-3', md: 'h-5', lg: 'h-8' }[size] || 'h-5';
  const colors = ['#c0c0c0', '#c0c000', '#00c0c0', '#00c000', '#c000c0', '#c00000', '#0000c0'];
  return (
    <div className="flex flex-col items-center gap-3 text-m3-muted" role="status" aria-live="polite">
      <div className={`flex ${h} gap-[2px] overflow-hidden rounded-sm`}>
        {colors.map((c, i) => (
          <span key={c} className="w-2.5 animate-on-air" style={{ background: c, animationDelay: `${i * 0.12}s`, opacity: 0.85 }} />
        ))}
      </div>
      {text && <span className="text-sm font-medium text-m3-textSecondary">{text}</span>}
    </div>
  );
}
