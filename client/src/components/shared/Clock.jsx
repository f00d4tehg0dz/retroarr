import { useEffect, useState } from 'react';

// Cable-box style clock: amber mono digits with a blinking colon.
export default function Clock({ className = '' }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const parts = new Intl.DateTimeFormat([], { hour: 'numeric', minute: '2-digit' }).formatToParts(now);
  const hour = parts.find((p) => p.type === 'hour')?.value;
  const minute = parts.find((p) => p.type === 'minute')?.value;
  const period = parts.find((p) => p.type === 'dayPeriod')?.value;
  return (
    <span className={`font-mono font-bold tabular-nums text-m3-primary ${className}`} style={{ textShadow: '0 0 10px rgba(255,181,71,.55)' }}>
      {hour}
      <span className={now.getSeconds() % 2 ? 'opacity-30' : ''}>:</span>
      {minute}
      {period && <span className="ml-1 text-[0.6em] align-top opacity-80">{period}</span>}
    </span>
  );
}
