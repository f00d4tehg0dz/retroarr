import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import retroApi from '../api/retroApi';
import { useChannels } from '../hooks/useChannels';

export default function ReportVideo() {
  const { data: channels } = useChannels();
  const [form, setForm] = useState({
    videoId: '',
    channelId: '',
    reason: '',
  });
  const [submitted, setSubmitted] = useState(null);

  const { mutate: submit, isPending } = useMutation({
    mutationFn: (data) => retroApi.post('/reports', data).then((r) => r.data),
    onSuccess: (data) => {
      setSubmitted(data);
      setForm({ videoId: '', channelId: '', reason: '' });
    },
  });

  function extractVideoId(input) {
    const urlMatch = input.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return urlMatch ? urlMatch[1] : input.trim();
  }

  function handleSubmit(e) {
    e.preventDefault();
    const videoId = extractVideoId(form.videoId);
    if (!videoId) return;
    submit({ ...form, videoId });
  }

  return (
    <div className="max-w-lg space-y-6">
      <div className="border-b border-m3-border pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-m3-text">
          Report Broken Video
        </h1>
        <p className="text-m3-muted text-sm mt-1">
          Flag deleted, private, or broken content for removal.
        </p>
      </div>

      {submitted && (
        <div className="border border-m3-success/30 bg-m3-successContainer/10 p-4 rounded-m3-sm">
          <div className="text-m3-success font-medium text-sm">Report Submitted</div>
          <div className="text-sm text-m3-muted mt-1">
            Video <span className="text-m3-text font-mono">{submitted.report?.videoId}</span> has been flagged.
            Status: <span className="text-m3-primary font-medium">{submitted.report?.status}</span>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="border border-m3-border p-5 rounded-m3 shadow-m3 space-y-4">
        <div>
          <label className="label">YouTube Video URL or ID *</label>
          <input
            className="input"
            type="text"
            placeholder="https://youtube.com/watch?v=... or dQw4w9WgXcQ"
            value={form.videoId}
            onChange={(e) => setForm((f) => ({ ...f, videoId: e.target.value }))}
            required
          />
        </div>

        <div>
          <label className="label">Channel (optional)</label>
          <select
            className="input"
            value={form.channelId}
            onChange={(e) => setForm((f) => ({ ...f, channelId: e.target.value }))}
          >
            <option value="">Select channel...</option>
            {channels?.map((ch) => (
              <option key={ch.id} value={ch.id}>
                CH {ch.channelNumber}: {ch.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Reason</label>
          <textarea
            className="input h-24 resize-none"
            placeholder="Video deleted, geo-blocked, wrong content, etc."
            value={form.reason}
            onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
          />
        </div>

        <button
          type="submit"
          className="btn-danger w-full"
          disabled={isPending}
        >
          {isPending ? 'Submitting...' : 'Submit Report'}
        </button>
      </form>
    </div>
  );
}
