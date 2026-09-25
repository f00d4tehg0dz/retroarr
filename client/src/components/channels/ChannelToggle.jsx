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
      type="button"
      role="switch"
      aria-checked={!!channel.enabled}
      onClick={handleToggle}
      disabled={isPending}
      title={channel.enabled ? 'Channel on — click to turn off' : 'Channel off — click to turn on'}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${channel.enabled ? 'bg-m3-primary' : 'bg-m3-border'} ${isPending ? 'opacity-40' : ''}`}
    >
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${channel.enabled ? 'left-[18px]' : 'left-0.5'}`} />
    </button>
  );
}
