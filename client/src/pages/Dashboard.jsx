import { useChannels, useNowPlaying } from '../hooks/useChannels';
import ChannelGrid from '../components/channels/ChannelGrid';
import ChannelCard from '../components/channels/ChannelCard';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import useChannelStore from '../store/useChannelStore';

const DECADES = ['60s', '70s', '80s', '90s', '00s', '10s', '20s'];
const CATEGORIES = [
  'Shows', 'Sitcoms', 'Cartoons', 'Movies', 'Commercials',
  'Drama', 'Specials', 'Theme Songs', 'Trailers', 'Bumpers', 'Kids',
  'Documentary', 'Talk TV',
];

export default function Dashboard() {
  const { data: channels, isLoading, error } = useChannels();
  const { data: nowPlayingList } = useNowPlaying();
  const { selectedDecade, selectedCategory, setDecadeFilter, setCategoryFilter, clearFilters } =
    useChannelStore();

  const nowPlayingMap = {};
  if (nowPlayingList) {
    for (const entry of nowPlayingList) {
      nowPlayingMap[entry.id] = entry;
    }
  }

  if (isLoading) return (
    <div className="flex items-center justify-center h-40">
      <LoadingSpinner size="lg" text="Loading channels..." />
    </div>
  );
  if (error) return (
    <div className="border border-m3-error/30 bg-m3-errorContainer/10 p-4 rounded-m3-sm">
      <span className="font-semibold text-m3-error">Error — </span>
      <span className="text-m3-text">Failed to load channels: {error.message}</span>
    </div>
  );

  const enabledCount = channels?.filter((c) => c.enabled).length ?? 0;
  const totalCount = channels?.length ?? 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-end justify-between border-b border-m3-border pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-m3-text">
            Channel Grid
          </h1>
          <p className="text-m3-muted text-sm mt-1">
            <span className="text-m3-primary font-medium">{enabledCount}</span> of {totalCount} channels active
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-col gap-1 text-right">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-m3-muted">M3U</span>
              <code className="text-xs font-mono text-m3-accent bg-m3-surfaceContainer border border-m3-border px-2 py-0.5 rounded-m3-sm select-all">
                {window.location.origin}/playlist.m3u
              </code>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-m3-muted">EPG</span>
              <code className="text-xs font-mono text-m3-accent bg-m3-surfaceContainer border border-m3-border px-2 py-0.5 rounded-m3-sm select-all">
                {window.location.origin}/epg.xml
              </code>
            </div>
          </div>
          <button
            onClick={clearFilters}
            className="btn-secondary text-xs"
          >
            Clear filters
          </button>
        </div>
      </div>

      {/* Decade filter */}
      <div>
        <div className="text-xs font-medium text-m3-muted mb-2">Decade</div>
        <div className="flex gap-2 flex-wrap">
          {DECADES.map((d) => (
            <button
              key={d}
              onClick={() => setDecadeFilter(selectedDecade === d ? null : d)}
              className={`px-4 py-1.5 text-sm font-medium border rounded-full transition-all ${
                selectedDecade === d
                  ? 'bg-m3-primary text-m3-onPrimary border-m3-primary'
                  : 'bg-transparent text-m3-textSecondary border-m3-border hover:border-m3-primary/50 hover:text-m3-primary'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Category filter */}
      <div>
        <div className="text-xs font-medium text-m3-muted mb-2">Category</div>
        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(selectedCategory === cat ? null : cat)}
              className={`px-3 py-1 text-xs font-medium border rounded-full transition-all ${
                selectedCategory === cat
                  ? 'bg-m3-primary text-m3-onPrimary border-m3-primary'
                  : 'bg-transparent text-m3-textSecondary border-m3-border hover:border-m3-primary/50 hover:text-m3-primary'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {channels && (
        <ChannelGrid channels={channels.filter((c) => !c.isPlugin)} nowPlayingMap={nowPlayingMap} />
      )}

      {/* Custom / Plugin Channels */}
      {channels && channels.some((c) => c.isPlugin) && (
        <div className="mt-8 space-y-3">
          <div className="border-b border-m3-border pb-2">
            <h2 className="text-lg font-bold tracking-tight text-m3-text">
              Custom Channels
            </h2>
            <p className="text-m3-muted text-sm mt-1">
              Plugin channels from <code className="text-m3-accent">plugins/</code> directory
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
            {channels
              .filter((c) => c.isPlugin)
              .map((ch) => {
                const nowPlaying = nowPlayingMap[ch.id]?.nowPlaying;
                return (
                  <ChannelCard key={ch.id} channel={ch} nowPlaying={nowPlaying} />
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
