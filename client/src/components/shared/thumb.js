// YouTube thumbnail for a video id (hqdefault always exists; maxres often not)
export const thumb = (videoId, q = 'hqdefault') => (videoId ? `https://i.ytimg.com/vi/${videoId}/${q}.jpg` : null);

export function fmtMins(sec) {
  if (!sec || sec < 0) return '';
  const m = Math.round(sec / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
}

export function progress(np) {
  if (!np || !np.duration) return 0;
  return Math.max(0, Math.min(100, (np.seekSeconds / np.duration) * 100));
}
