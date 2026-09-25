import ChannelCard from './ChannelCard';

// Responsive tile grid for a list of channels.
export default function ChannelGrid({ channels, nowPlayingMap = {}, empty = 'No channels match these filters.' }) {
  if (!channels.length) {
    return <div className="panel p-8 text-center text-sm text-m3-muted">{empty}</div>;
  }
  return (
    <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      {channels
        .slice()
        .sort((a, b) => a.channelNumber - b.channelNumber)
        .map((ch) => (
          <ChannelCard key={ch.id} channel={ch} nowPlaying={nowPlayingMap[ch.id]?.nowPlaying} />
        ))}
    </div>
  );
}
