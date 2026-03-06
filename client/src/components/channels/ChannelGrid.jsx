import ChannelCard from './ChannelCard';
import useChannelStore from '../../store/useChannelStore';

const DECADES = ['60s', '70s', '80s', '90s', '00s', '10s', '20s'];
const CATEGORIES = [
  'Shows', 'Sitcoms', 'Cartoons', 'Movies', 'Commercials',
  'Drama', 'Specials', 'Theme Songs', 'Trailers', 'Bumpers', 'Kids',
  'Documentary', 'Talk TV',
];

export default function ChannelGrid({ channels, nowPlayingMap = {} }) {
  const { selectedDecade, selectedCategory } = useChannelStore();

  const gridChannels = channels.filter((c) => !c.isPlugin);
  const decades = selectedDecade ? [selectedDecade] : DECADES;

  return (
    <div className="space-y-4">
      {/* Category header row */}
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `56px repeat(${CATEGORIES.length}, 1fr)` }}
      >
        <div />
        {CATEGORIES.map((cat) => (
          <div
            key={cat}
            className={`text-xs font-medium pb-1 border-b text-center truncate px-0.5 ${
              selectedCategory === cat
                ? 'text-m3-primary border-m3-primary'
                : 'text-m3-muted border-m3-borderSubtle'
            }`}
          >
            {cat}
          </div>
        ))}
      </div>

      {/* Decade rows */}
      {decades.map((decade) => {
        const decadeChannels = gridChannels.filter((c) => c.decade === decade);
        const cats = selectedCategory
          ? CATEGORIES.filter((c) => c === selectedCategory)
          : CATEGORIES;
        const colCount = selectedCategory ? 1 : CATEGORIES.length;

        return (
          <div
            key={decade}
            className="grid gap-1"
            style={{ gridTemplateColumns: `56px repeat(${colCount}, 1fr)` }}
          >
            {/* Decade label */}
            <div className="flex items-start pt-2 pl-1">
              <span className="text-m3-primary font-bold text-sm">{decade}</span>
            </div>

            {/* Channel cards */}
            {cats.map((category) => {
              const ch = decadeChannels.find((c) => c.category === category);
              if (!ch) return (
                <div key={category} className="border border-m3-borderSubtle rounded-m3-sm opacity-20 min-h-[80px]" />
              );
              const nowPlaying = nowPlayingMap[ch.id]?.nowPlaying;
              return <ChannelCard key={ch.id} channel={ch} nowPlaying={nowPlaying} />;
            })}
          </div>
        );
      })}
    </div>
  );
}
