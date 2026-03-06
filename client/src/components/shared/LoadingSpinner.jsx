export default function LoadingSpinner({ size = 'md', text }) {
  const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-10 h-10' };
  return (
    <div className="flex items-center gap-3 text-m3-muted">
      <div
        className={`${sizes[size]} border-2 border-m3-border border-t-m3-primary rounded-full animate-spin`}
      />
      {text && <span className="text-sm font-medium text-m3-textSecondary">{text}</span>}
    </div>
  );
}
