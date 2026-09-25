// Where a video's bytes live — client copy of api-server/src/content/mediaSource.js.
// Video IDs are YouTube IDs or "ia:<archive.org identifier>/<file path>".
const IA_PREFIX = 'ia:';

export const isArchiveId = (id) => typeof id === 'string' && id.startsWith(IA_PREFIX);

function parseArchiveId(id) {
  if (!isArchiveId(id)) return null;
  const rest = id.slice(IA_PREFIX.length);
  const slash = rest.indexOf('/');
  return slash < 1 ? null : { identifier: rest.slice(0, slash), file: rest.slice(slash + 1) };
}

export function archiveFileUrl(id) {
  const p = parseArchiveId(id);
  if (!p) return null;
  return `https://archive.org/download/${encodeURIComponent(p.identifier)}/${p.file.split('/').map(encodeURIComponent).join('/')}`;
}

export function archiveThumbUrl(id) {
  const p = parseArchiveId(id);
  return p ? `https://archive.org/services/img/${encodeURIComponent(p.identifier)}` : null;
}

export function youtubeEmbedUrl(id, seek = 0, controls = true) {
  return `https://www.youtube.com/embed/${id}?autoplay=1&start=${Math.floor(seek || 0)}&controls=${controls ? 1 : 0}&modestbranding=1&rel=0&iv_load_policy=3${controls ? '' : '&showinfo=0&disablekb=1'}`;
}
