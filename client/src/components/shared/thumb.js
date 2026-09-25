import { isArchiveId, archiveThumbUrl } from './media';

// Thumbnail for a video id: YouTube (hqdefault always exists; maxres often
// not) or the Internet Archive item image
export const thumb = (videoId, q = 'hqdefault') => {
  if (!videoId) return null;
  if (isArchiveId(videoId)) return archiveThumbUrl(videoId);
  return `https://i.ytimg.com/vi/${videoId}/${q}.jpg`;
};

export function fmtMins(sec) {
  if (!sec || sec < 0) return '';
  const m = Math.round(sec / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
}

export function progress(np) {
  if (!np || !np.duration) return 0;
  return Math.max(0, Math.min(100, (np.seekSeconds / np.duration) * 100));
}
