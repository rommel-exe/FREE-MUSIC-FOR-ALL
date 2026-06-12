import { useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Download,
  CheckCircle,
  RefreshCw,
  X,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { useUpdateStore } from '@/store/updateStore';

export function UpdateBanner() {
  const status = useUpdateStore((s) => s.status);
  const version = useUpdateStore((s) => s.version);
  const progress = useUpdateStore((s) => s.progress);
  const errorMessage = useUpdateStore((s) => s.errorMessage);
  const dismissed = useUpdateStore((s) => s.dismissed);
  const checkForUpdates = useUpdateStore((s) => s.checkForUpdates);
  const quitAndInstall = useUpdateStore((s) => s.quitAndInstall);
  const dismiss = useUpdateStore((s) => s.dismiss);

  const handleAction = useCallback(() => {
    if (status === 'downloaded') {
      quitAndInstall();
    } else if (status === 'error') {
      checkForUpdates();
    }
  }, [status, quitAndInstall, checkForUpdates]);

  const visible =
    !dismissed &&
    (status === 'checking' ||
      status === 'downloading' ||
      status === 'downloaded' ||
      status === 'error');

  const showProgress = status === 'downloading';

  const renderContent = () => {
    switch (status) {
      case 'downloaded':
        return (
          <div className="glass-popover rounded-radius-xl p-4 shadow-warm-lg border border-emerald/30 bg-emerald-subtle noise-texture">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <CheckCircle className="w-5 h-5 text-emerald" />
                <span className="text-[15px] text-groove-50 font-semibold">
                  {version ? `v${version} ready to install` : 'Update ready'}
                </span>
              </div>
              <button
                type="button"
                onClick={dismiss}
                className="w-6 h-6 flex items-center justify-center rounded-md text-groove-400 hover:text-groove-100 hover:bg-groove-600 transition-colors"
                aria-label="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <button
              type="button"
              onClick={handleAction}
              className="w-full py-2.5 rounded-radius-lg bg-emerald hover:bg-emerald-hover active:bg-emerald-active text-white text-sm font-semibold transition-all active:scale-[0.98] shadow-lg shadow-emerald/30 flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Install & Restart
            </button>
          </div>
        );

      case 'error':
        return (
          <div className="glass-popover rounded-radius-xl px-4 py-3 shadow-warm-lg border border-amber-500/30 bg-amber-500/5 noise-texture">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-amber-300 font-semibold mb-1">
                  Update failed
                </p>
                <p className="text-[12px] text-groove-300 leading-relaxed break-all whitespace-pre-wrap select-all">
                  {errorMessage}
                </p>
              </div>
              <div className="flex-shrink-0 flex items-start gap-2 mt-0.5">
                <button
                  type="button"
                  onClick={handleAction}
                  className="px-3 py-1.5 rounded-radius-sm bg-groove-600 hover:bg-groove-500 text-groove-100 hover:text-white text-xs font-medium transition-colors active:scale-95 whitespace-nowrap"
                >
                  Retry
                </button>
                <button
                  type="button"
                  onClick={dismiss}
                  className="w-6 h-6 flex items-center justify-center rounded-md text-groove-400 hover:text-groove-100 hover:bg-groove-600 transition-colors"
                  aria-label="Dismiss"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="glass-popover rounded-radius-xl px-4 py-3 shadow-warm-lg border border-groove-500/20 noise-texture">
            <div className="flex items-center gap-3">
              {status === 'checking' ? (
                <Loader2 className="w-4 h-4 animate-spin text-emerald flex-shrink-0" />
              ) : (
                <Download className="w-4 h-4 text-emerald flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-groove-100 font-medium truncate">
                  {status === 'checking'
                    ? 'Checking for updates…'
                    : version
                      ? `Downloading v${version} update…`
                      : 'Downloading update…'}
                </p>
                {showProgress && progress && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="flex-1 h-1 bg-groove-700 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-emerald rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(progress.percent, 100)}%` }}
                        transition={{ duration: 0.3, ease: 'easeOut' }}
                      />
                    </div>
                    <span className="text-[10px] text-groove-400 tabular-nums flex-shrink-0 w-8 text-right">
                      {Math.round(progress.percent)}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[60] w-[min(580px,calc(100vw-32px))]"
        >
          {renderContent()}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
