import { useState, useEffect } from 'react';
import { useSettings, useUpdateSettings, useForceSync } from '../hooks/useSettings';
import LoadingSpinner from '../components/shared/LoadingSpinner';

export default function Settings() {
  const { data: settings, isLoading } = useSettings();
  const { mutate: updateSettings, isPending: isSaving } = useUpdateSettings();
  const { mutate: forceSync, isPending: isSyncing, data: syncResult } = useForceSync();

  const [form, setForm] = useState({
    remoteApiUrl: '',
    deviceName: 'RetroArr',
    streamQuality: '720p',
    tunerCount: 4,
  });

  useEffect(() => {
    if (settings) {
      setForm({
        remoteApiUrl: settings.remoteApiUrl || '',
        deviceName: settings.deviceName || 'RetroArr',
        streamQuality: settings.streamQuality || '720p',
        tunerCount: settings.tunerCount || 4,
      });
    }
  }, [settings]);

  function handleSave(e) {
    e.preventDefault();
    updateSettings(form);
  }

  if (isLoading) return (
    <div className="flex items-center justify-center h-40">
      <LoadingSpinner text="Loading settings..." />
    </div>
  );

  return (
    <div className="max-w-lg space-y-6">
      <div className="border-b border-m3-border pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-m3-text">Settings</h1>
      </div>

      {/* Status panel */}
      <div className="border border-m3-border p-5 rounded-m3 shadow-m3 space-y-3">
        <h2 className="text-sm font-semibold text-m3-primary border-b border-m3-border pb-2">
          System Status
        </h2>
        <div className="flex justify-between items-center">
          <span className="font-medium text-m3-muted text-sm">Last Sync</span>
          <span className="text-m3-text text-sm">
            {settings?.lastSync ? new Date(settings.lastSync).toLocaleString() : 'Never'}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="font-medium text-m3-muted text-sm">Channels</span>
          <span className="text-m3-text text-sm">
            <span className="text-m3-primary font-medium">{settings?.enabledChannelCount}</span>
            {' / '}{settings?.channelCount} enabled
          </span>
        </div>
      </div>

      {/* Config form */}
      <form onSubmit={handleSave} className="border border-m3-border p-5 rounded-m3 shadow-m3 space-y-4">
        <h2 className="text-sm font-semibold text-m3-primary border-b border-m3-border pb-2">
          Configuration
        </h2>

        <div>
          <label className="label">Remote API URL</label>
          <input
            className="input"
            type="url"
            placeholder="https://retroarr-api.f00d.me"
            value={form.remoteApiUrl}
            onChange={(e) => setForm((f) => ({ ...f, remoteApiUrl: e.target.value }))}
          />
          <p className="text-xs text-m3-muted mt-1.5">
            Endpoint for video metadata.
          </p>
        </div>

        <div>
          <label className="label">Device Name</label>
          <input
            className="input"
            type="text"
            value={form.deviceName}
            onChange={(e) => setForm((f) => ({ ...f, deviceName: e.target.value }))}
          />
        </div>

        <div>
          <label className="label">Stream Quality</label>
          <select
            className="input"
            value={form.streamQuality}
            onChange={(e) => setForm((f) => ({ ...f, streamQuality: e.target.value }))}
          >
            <option value="720p">720p (HD)</option>
            <option value="1080p">1080p (Full HD)</option>
          </select>
        </div>

        <div>
          <label className="label">Tuner Count (max simultaneous streams)</label>
          <select
            className="input"
            value={form.tunerCount}
            onChange={(e) => setForm((f) => ({ ...f, tunerCount: parseInt(e.target.value) }))}
          >
            {[1, 2, 3, 4, 6, 8].map((n) => (
              <option key={n} value={n}>{n} tuner{n > 1 ? 's' : ''}</option>
            ))}
          </select>
        </div>

        <button type="submit" className="btn-primary w-full" disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Settings'}
        </button>
      </form>

      {/* Sync panel */}
      <div className="border border-m3-border p-5 rounded-m3 shadow-m3 space-y-3">
        <h2 className="text-sm font-semibold text-m3-primary border-b border-m3-border pb-2">
          Data Sync
        </h2>
        <p className="text-sm text-m3-muted">
          Pull the latest video data from your remote API. Runs automatically at 3 AM daily.
        </p>

        <button
          onClick={() => forceSync()}
          disabled={isSyncing}
          className="btn-secondary w-full"
        >
          {isSyncing ? <LoadingSpinner size="sm" text="Syncing..." /> : 'Sync Now'}
        </button>

        {syncResult && (
          <div className="border border-m3-success/30 bg-m3-successContainer/10 p-3 rounded-m3-sm text-sm">
            <span className="text-m3-success font-medium">Sync Complete — </span>
            <span className="text-m3-text">{syncResult.syncedCount} channels updated</span>
            {syncResult.errorCount > 0 && (
              <span className="text-m3-error ml-2">({syncResult.errorCount} errors)</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
