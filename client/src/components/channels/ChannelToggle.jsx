import { useUpdateChannel } from '../../hooks/useChannels';

export default function ChannelToggle({ channel }) {
  const { mutate, isPending } = useUpdateChannel();

  function handleToggle(e) {
    e.stopPropagation();
    e.preventDefault();
    mutate({ id: channel.id, patch: { enabled: !channel.enabled } });
  }

  return (
    <button
      onClick={handleToggle}
      disabled={isPending}
      title={channel.enabled ? 'Disable channel' : 'Enable channel'}
      className={`w-9 h-5 rounded-full relative transition-all
        ${channel.enabled
          ? 'bg-m3-primary'
          : 'bg-m3-border'
        }
        ${isPending ? 'opacity-40' : ''}`}
    >
      <span
        className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all shadow-sm
          ${channel.enabled ? 'left-[calc(100%-18px)]' : 'left-0.5'}`}
      />
    </button>
  );
}
