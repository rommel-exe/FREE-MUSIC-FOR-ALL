import { useEffect, useState } from 'react';
import { ipc, UpdateState } from '@/utils/ipc';
import { Download, RefreshCw, X, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';

/**
 * Update banner — appears at the top of the app when an update is available.
 * Shows current status (checking, downloading, downloaded, etc.) and lets the
 * user trigger a manual check or restart to install the downloaded update.
 */
export function UpdateBanner() {
  const [state, setState] = useState<UpdateState>({ status: 'idle' });
  const [dismissed, setDismissed] = useState(false);
  const [version, setVersion] = useState<string>('1.0.0');

  useEffect(() => {
    // Get current app version
    ipc.update.getVersion().then(setVersion).catch(() => {});

    // Get current update state
    ipc.update.getState().then(setState).catch(() => {});

    // Subscribe to status changes
    const unsub = ipc.update.onStatusChange?.((newState) => {
      setState(newState);
      // Reset dismissed when a new update becomes available
      if (newState.status === 'available') setDismissed(false);
    });

    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, []);

  // Don't show the banner at all if there's nothing to show
  const visible =
    !dismissed &&
    (state.status === 'available' ||
      state.status === 'downloading' ||
      state.status === 'downloaded' ||
      state.status === 'error' ||
      state.status === 'not-available');

  if (!visible) return null;

  const isDev = state.error === 'Updates are only available in production builds';

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 px-4 py-2.5 flex items-center justify-between gap-3 text-sm shadow-md ${
        state.status === 'error'
          ? 'bg-red-900/90 border-b border-red-700 text-red-100'
          : state.status === 'downloaded'
          ? 'bg-green-900/90 border-b border-green-700 text-green-100'
          : 'bg-blue-900/90 border-b border-blue-700 text-blue-100'
      }`}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {state.status === 'available' && <Sparkles size={16} className="shrink-0" />}
        {state.status === 'downloading' && <Download size={16} className="shrink-0 animate-pulse" />}
        {state.status === 'downloaded' && <CheckCircle2 size={16} className="shrink-0" />}
        {state.status === 'error' && <AlertCircle size={16} className="shrink-0" />}
        {state.status === 'not-available' && <CheckCircle2 size={16} className="shrink-0 opacity-70" />}

        <div className="flex-1 min-w-0 truncate">
          {state.status === 'available' && (
            <span>
              <strong>Version {state.version}</strong> is available — you're on v{version}.
            </span>
          )}
          {state.status === 'downloading' && (
            <span>
              Downloading update…
              {state.percent !== undefined && (
                <>
                  {' '}
                  <span className="font-mono">{Math.round(state.percent)}%</span>
                </>
              )}
            </span>
          )}
          {state.status === 'downloading' && state.percent !== undefined && (
            <div className="mt-1 h-1 bg-blue-950/50 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-300 transition-all duration-300"
                style={{ width: `${state.percent}%` }}
              />
            </div>
          )}
          {state.status === 'downloaded' && (
            <span>
              <strong>Version {state.version}</strong> ready to install — restart the app to apply.
            </span>
          )}
          {state.status === 'error' && (
            <span>
              {isDev
                ? 'Auto-updates are disabled in development builds.'
                : `Update check failed: ${state.error || 'Unknown error'}`}
            </span>
          )}
          {state.status === 'not-available' && <span>You're on the latest version (v{version}).</span>}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {state.status === 'available' && (
          <button
            type="button"
            onClick={() => ipc.update.download()}
            className="px-3 py-1 rounded bg-blue-700 hover:bg-blue-600 text-white text-xs font-medium flex items-center gap-1"
          >
            <Download size={12} /> Download
          </button>
        )}
        {state.status === 'downloaded' && (
          <button
            type="button"
            onClick={() => ipc.update.install()}
            className="px-3 py-1 rounded bg-green-700 hover:bg-green-600 text-white text-xs font-medium flex items-center gap-1"
          >
            <RefreshCw size={12} /> Restart now
          </button>
        )}
        {(state.status === 'error' || state.status === 'not-available') && (
          <button
            type="button"
            onClick={() => ipc.update.check()}
            className="px-3 py-1 rounded bg-white/10 hover:bg-white/20 text-white text-xs font-medium flex items-center gap-1"
          >
            <RefreshCw size={12} /> Retry
          </button>
        )}
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="p-1 rounded hover:bg-white/10"
          aria-label="Dismiss"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
