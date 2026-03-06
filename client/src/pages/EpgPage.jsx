import { useQuery } from '@tanstack/react-query';
import { useChannels } from '../hooks/useChannels';
import GuideGrid from '../components/epg/GuideGrid';
import LoadingSpinner from '../components/shared/LoadingSpinner';

function useEpgXml() {
  return useQuery({
    queryKey: ['epg'],
    queryFn: () => fetch('/epg.xml').then((r) => r.text()),
    staleTime: 30 * 60 * 1000,
    refetchInterval: 60 * 60 * 1000,
  });
}

export default function EpgPage() {
  const { data: channels, isLoading: channelsLoading } = useChannels();
  const { data: xmlData, isLoading: epgLoading } = useEpgXml();

  const isLoading = channelsLoading || epgLoading;

  return (
    <div className="-m-5 flex flex-col h-[calc(100vh-3rem)]">
      <div className="px-5 pt-5 pb-3 border-b border-m3-border flex items-end justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-m3-text">TV Guide</h1>
          <p className="text-m3-muted text-sm mt-1">
            {new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
            {' — '}Next 3 hours
          </p>
        </div>
        <div className="text-xs font-medium text-m3-primary border border-m3-primary/40 px-2.5 py-1 rounded-full">
          Live
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <LoadingSpinner size="lg" text="Loading guide..." />
        </div>
      ) : !channels?.length ? (
        <div className="p-5">
          <div className="border border-m3-border p-6 rounded-m3 text-center">
            <div className="text-m3-muted font-medium text-sm">No enabled channels.</div>
            <div className="text-m3-muted text-xs mt-1">Enable channels from the Channel Grid first.</div>
          </div>
        </div>
      ) : !xmlData ? (
        <div className="p-5">
          <div className="border border-m3-error/30 bg-m3-errorContainer/10 p-4 rounded-m3-sm">
            <span className="font-medium text-m3-error text-sm">EPG Unavailable — </span>
            <span className="text-m3-text text-sm">Run a sync from Settings to populate channel data.</span>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <GuideGrid xmlData={xmlData} channels={channels.filter((c) => c.enabled)} />
        </div>
      )}
    </div>
  );
}
