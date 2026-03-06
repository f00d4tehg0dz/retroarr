import { useParams, Link } from 'react-router-dom';
import { useChannel, useUpdateChannel } from '../hooks/useChannels';
import LoadingSpinner from '../components/shared/LoadingSpinner';

export default function ChannelDetail() {
  const { id } = useParams();
  const { data: channel, isLoading, error } = useChannel(id);
  const { mutate: update, isPending } = useUpdateChannel();

  if (isLoading) return (
    <div className="flex items-center justify-center h-40">
      <LoadingSpinner text="Loading channel..." />
    </div>
  );
  if (error || !channel) return (
    <div className="border border-m3-error/30 bg-m3-errorContainer/10 p-4 rounded-m3-sm font-medium text-m3-error">
      Channel not found.
    </div>
  );

  function toggle(field) {
    update({
      id: channel.id,
      patch: { settings: { [field]: !channel.settings[field] } },
    });
  }

  function toggleEnabled() {
    update({ id: channel.id, patch: { enabled: !channel.enabled } });
  }

  return (
    <div className="max-w-2xl space-y-5">
      {/* Breadcrumb */}
      <div className="text-sm text-m3-muted">
        <Link to="/" className="hover:text-m3-primary transition-colors">Channels</Link>
        <span className="mx-2 text-m3-border">/</span>
        <span className="text-m3-text">{channel.name}</span>
      </div>

      {/* Header */}
      <div className="border border-m3-border p-5 rounded-m3 shadow-m3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-m3-primary text-xs font-bold">
              CH {channel.channelNumber}
            </div>
            <h1 className="text-2xl font-bold mt-1 text-m3-text">{channel.name}</h1>
            <div className="flex gap-3 mt-2 text-sm text-m3-muted">
              <span>{channel.decade}</span>
              <span className="text-m3-border">—</span>
              <span>{channel.category}</span>
              <span className="text-m3-border">—</span>
              <span><span className="text-m3-primary font-medium">{channel.cachedVideos?.length ?? 0}</span> videos</span>
            </div>
          </div>

          <button
            onClick={toggleEnabled}
            disabled={isPending}
            className={channel.enabled ? 'btn-secondary' : 'btn-primary'}
          >
            {channel.enabled ? 'Disable' : 'Enable'}
          </button>
        </div>
      </div>

      {/* Settings */}
      <div className="border border-m3-border p-5 rounded-m3 shadow-m3 space-y-4">
        <h2 className="text-sm font-semibold text-m3-primary border-b border-m3-border pb-2">
          Settings
        </h2>

        {/* Shuffle toggle */}
        <div
          className="flex items-center justify-between cursor-pointer group"
          onClick={() => toggle('shuffle')}
        >
          <div>
            <div className="text-sm font-medium text-m3-text group-hover:text-m3-primary transition-colors">
              Shuffle Playlist
            </div>
            <div className="text-xs text-m3-muted">Randomize video order daily</div>
          </div>
          <div
            className={`relative h-6 w-12 rounded-full transition-colors cursor-pointer ${
              channel.settings?.shuffle
                ? 'bg-m3-primary'
                : 'bg-m3-border'
            }`}
          >
            <span
              className={`absolute top-1 h-4 w-4 bg-white rounded-full transition-transform shadow-sm ${
                channel.settings?.shuffle ? 'translate-x-[26px]' : 'translate-x-1'
              }`}
            />
          </div>
        </div>

        {/* Commercials toggle */}
        <div
          className="flex items-center justify-between cursor-pointer group"
          onClick={() => toggle('includeCommercials')}
        >
          <div>
            <div className="text-sm font-medium text-m3-text group-hover:text-m3-primary transition-colors">
              Include Commercials
            </div>
            <div className="text-xs text-m3-muted">
              Play local commercial files between videos
            </div>
          </div>
          <div
            className={`relative h-6 w-12 rounded-full transition-colors cursor-pointer ${
              channel.settings?.includeCommercials
                ? 'bg-m3-primary'
                : 'bg-m3-border'
            }`}
          >
            <span
              className={`absolute top-1 h-4 w-4 bg-white rounded-full transition-transform shadow-sm ${
                channel.settings?.includeCommercials ? 'translate-x-[26px]' : 'translate-x-1'
              }`}
            />
          </div>
        </div>
      </div>

      {/* Last sync */}
      {channel.lastVideoSync && (
        <div className="text-xs text-m3-muted">
          Last synced: {new Date(channel.lastVideoSync).toLocaleString()}
        </div>
      )}

      {/* Videos list */}
      {channel.cachedVideos?.length > 0 && (
        <div className="border border-m3-border p-5 rounded-m3 shadow-m3 space-y-2">
          <h2 className="text-sm font-semibold text-m3-primary border-b border-m3-border pb-2">
            Videos ({channel.cachedVideos.length})
          </h2>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {channel.cachedVideos.slice(0, 50).map((v) => (
              <div key={v.id} className="flex items-center gap-3 text-xs py-1 border-b border-m3-borderSubtle">
                <span className="text-m3-muted font-mono w-10 shrink-0">
                  {v.duration ? `${Math.floor(v.duration / 60)}m` : '—'}
                </span>
                <span className={`truncate font-medium ${v.isDead ? 'line-through text-m3-error opacity-60' : 'text-m3-text'}`}>
                  {v.title}
                </span>
                {v.isDead && (
                  <span className="text-m3-error font-medium text-xs shrink-0 border border-m3-error/30 px-1.5 py-0.5 rounded-full">
                    Dead
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
