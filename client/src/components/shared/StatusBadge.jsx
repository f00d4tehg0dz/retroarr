export default function StatusBadge({ status, label }) {
  const cls =
    status === 'online'  ? 'badge-online'  :
    status === 'error'   ? 'badge-error'   :
                           'badge-offline';
  const dot =
    status === 'online' ? '●' :
    status === 'error'  ? '✕' : '○';

  return (
    <span className={cls}>
      <span>{dot}</span>
      {label}
    </span>
  );
}
