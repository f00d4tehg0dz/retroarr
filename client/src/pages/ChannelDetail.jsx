import { useParams, Link } from 'react-router-dom';
import { useChannel, useUpdateChannel, useNowPlaying } from '../hooks/useChannels';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import usePlayerStore from '../store/usePlayerStore';
import Icon from '../components/shared/Icon';
import { thumb, fmtMins, progress } from '../components/shared/thumb';

function Switch({ on, onClick, title, desc }) {
  return (
    <button type="button" role="switch" aria-checked={!!on} onClick={onClick}
      className="flex w-full items-center justify-between gap-4 rounded-xl px-1 py-3 text-left transition-colors hover:bg-m3-surfaceContainer/50">
      <span>
        <span className="block text-sm font-semibold text-m3-text">{title}</span>
        <span className="block text-xs text-m3-muted">{desc}</span>
      </span>
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? 'bg-m3-primary' : 'bg-m3-border'}`}>
        <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all ${on ? 'left-6' : 'left-1'}`} />
      </span>
    </button>
  );
}

export default function ChannelDetail() {
  const { id } = useParams();
  const { data: channel, isLoading, error } = useChannel(id);
  const { data: nowPlayingList } = useNowPlaying();
  const { mutate: update, isPending } = useUpdateChannel();
  const openPlayer = usePlayerStore((s) => s.open);

  if (isLoading) return <div className="grid h-64 place-items-center"><LoadingSpinner text="Tuning…" /></div>;
  if (error || !channel) return <div className="panel border-m3-error/40 p-5 font-medium text-m3-error">Channel not found.</div>;

  const np = nowPlayingList?.find((c) => c.id === channel.id)?.nowPlaying;
  const toggle = (field) => update({ id: channel.id, patch: { settings: { [field]: !channel.settings?.[field] } } });
  const videos = channel.cachedVideos || [];
  const dead = videos.filter((v) => v.isDead).length;
  const hours = Math.round(videos.reduce((a, v) => a + (v.duration || 0), 0) / 3600);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <nav className="flex items-center gap-2 text-sm text-m3-muted">
        <Link to="/" className="hover:text-m3-primary">On Now</Link>
        <Icon name="chevron" size={14} />
        <span className="text-m3-textSecondary">{channel.name}</span>
      </nav>

      {/* Header */}
      <section className="panel overflow-hidden">
        <div className="grid md:grid-cols-[minmax(0,1fr)_320px]">
          <div className="p-6 sm:p-8">
            <div className="flex items-center gap-2">
              <span className="ch-num h-8 text-sm">{channel.channelNumber}</span>
              {channel.isLive
                ? (channel.liveOnline === false ? <span className="off-air">Off air</span> : <span className="on-air">Live</span>)
                : <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-m3-muted">{[channel.decade, channel.category].filter(Boolean).join(' · ')}</span>}
            </div>
            <h1 className="page-title mt-3">{channel.name}</h1>
            {channel.description && <p className="mt-2 max-w-prose text-sm text-m3-textSecondary">{channel.description}</p>}

            <dl className="mt-6 grid grid-cols-3 gap-3 max-w-md">
              {(channel.isLive
                ? [['Source', 'YouTube'], ['Channel', channel.uploader || '—'], ['Schedule', '24/7']]
                : [['Episodes', videos.length], ['Hours', hours], ['Dead', dead]]
              ).map(([k, v]) => (
                <div key={k} className="rounded-xl border border-m3-border bg-black/30 px-3 py-2.5">
                  <dt className="text-[11px] font-medium text-m3-muted">{k}</dt>
                  <dd className="truncate font-display text-lg font-bold tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-6 flex flex-wrap gap-3">
              <button className="btn-primary" disabled={!channel.enabled} onClick={() => openPlayer(channel)}><Icon name="play" fill size={16} /> Watch now</button>
              <button className="btn-secondary" disabled={isPending} onClick={() => update({ id: channel.id, patch: { enabled: !channel.enabled } })}>
                {channel.enabled ? 'Turn channel off' : 'Turn channel on'}
              </button>
              {channel.liveUrl && <a className="btn-ghost" href={channel.liveUrl} target="_blank" rel="noreferrer">Open on YouTube</a>}
            </div>
          </div>

          <button type="button" onClick={() => channel.enabled && openPlayer(channel)}
            className="relative hidden min-h-[220px] overflow-hidden bg-m3-black md:block scanlines" aria-label="Watch">
            {np?.videoId && <img src={thumb(np.videoId)} alt="" className="absolute inset-0 h-full w-full object-cover opacity-80" />}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-4 text-left">
              <div className="eyebrow !text-[10px]">On now</div>
              <div className="mt-1 text-sm font-semibold text-white line-clamp-2">{np?.title || 'No signal'}</div>
              {!channel.isLive && np?.duration > 0 && (
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/20">
                  <div className="h-full bg-m3-primary" style={{ width: `${progress(np)}%` }} />
                </div>
              )}
            </div>
          </button>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        {/* Settings */}
        <section className="panel h-fit p-5">
          <h2 className="eyebrow">Channel settings</h2>
          <div className="mt-2 divide-y divide-m3-borderSubtle">
            <Switch on={channel.settings?.shuffle} onClick={() => toggle('shuffle')} title="Shuffle" desc="Mix up the episode order every day" />
            <Switch on={channel.settings?.includeCommercials} onClick={() => toggle('includeCommercials')} title="Commercial breaks" desc="Play local commercials between episodes" />
          </div>
          {channel.lastVideoSync && <p className="mt-4 text-xs text-m3-muted">Last synced {new Date(channel.lastVideoSync).toLocaleString()}</p>}
          <div className="mt-4 rounded-xl border border-m3-border bg-black/30 px-3 py-2">
            <div className="label mb-0.5">Stream URL</div>
            <div className="truncate font-mono text-xs text-m3-accent select-all">{window.location.origin}/stream/{channel.id}</div>
          </div>
        </section>

        {/* Episode list styled as listings */}
        {!channel.isLive && videos.length > 0 && (
          <section className="panel p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="eyebrow">In rotation</h2>
              <span className="font-mono text-[11px] text-m3-muted">{videos.length} episodes · showing 100</span>
            </div>
            <ol className="mt-3 max-h-[480px] space-y-0.5 overflow-y-auto pr-1">
              {videos.slice(0, 100).map((v) => (
                <li key={v.id} className={`flex items-baseline gap-2 rounded-lg px-2 py-1.5 text-sm ${np?.videoId === v.id ? 'bg-m3-primary/10' : ''}`}>
                  <span className={`truncate ${v.isDead ? 'text-m3-error line-through opacity-60' : np?.videoId === v.id ? 'font-semibold text-m3-primary' : 'text-m3-text'}`}>{v.title}</span>
                  <span className="leader" />
                  <span className="shrink-0 font-mono text-xs tabular-nums text-m3-muted">{v.isDead ? 'gone' : fmtMins(v.duration) || '—'}</span>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </div>
  );
}
