export default function StatusBadge({ status, label }) {
  const cls = status === 'online' ? 'badge-online' : status === 'error' ? 'badge-error' : 'badge-offline';
  const dot = status === 'online' ? 'bg-m3-success' : status === 'error' ? 'bg-m3-error' : 'bg-m3-muted';
  return (
    <span className={cls}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}
