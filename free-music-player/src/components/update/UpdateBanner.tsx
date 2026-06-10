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

/* ------------------------------------------------------------------ */
/*  UpdateBanner — subtle bar at the bottom of the screen              */
/* ------------------------------------------------------------------ */

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
    } else if (status === 'error' || status === 'not-available') {
      checkForUpdates();
    }
  }, [status, quitAndInstall, checkForUpdates]);

  // Determine visibility
  const visible =
    !dismissed &&
    (status === 'checking' ||
      status === 'downloading' ||
      status === 'downloaded' ||
      status === 'error');

  // We never show the banner for idle/not-available/available
  // (available transitions immediately to downloading when auto-download kicks in)

  let icon: React.ReactNode;
  let title: string;
  let actionLabel: string | null = null;
  let showProgress = false;

  switch (status) {
    case 'checking':
      icon = <Loader2 className="w-4 h-4 animate-spin text-mac-blue" />;
      title = 'Checking for updates…';
      break;
    case 'downloading':
      icon = <Download className="w-4 h-4 text-mac-blue" />;
      title = version
        ? `Downloading v${version} update…`
        : 'Downloading update…';
      showProgress = true;
      break;
    case 'downloaded':
      icon = <CheckCircle className="w-4 h-4 text-mac-green" />;
      title = version
        ? `v${version} ready to install`
        : 'Update ready to install';
      actionLabel = 'Restart';
      break;
    case 'error':
      icon = <AlertTriangle className="w-4 h-4 text-amber-400" />;
      title = errorMessage
        ? `Update failed: ${errorMessage}`
        : 'Update check failed';
      actionLabel = 'Retry';
      break;
    default:
      return null;
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] w-[min(740px,calc(100vw-32px))]"
        >
          <div className={`glass-popover rounded-mac-xl px-4 py-3 shadow-mac-xl border border-white/[0.08] ${status === 'error' ? 'border-amber-500/30' : ''}`}>
            <div className="flex items-start gap-3">
              {/* Icon — aligns to top so it doesn't stretch with multi-line text */}
              <div className="flex-shrink-0 mt-0.5">{icon}</div>

              {/* Content — text wraps naturally, full message visible */}
              <div className="flex-1 min-w-0">
                {status === 'error' ? (
                  <div className="space-y-1">
                    <p className="text-[13px] text-amber-300 font-semibold">
                      Update failed
                    </p>
                    <p className="text-[12px] text-white/60 leading-relaxed break-all whitespace-pre-wrap select-all">
                      {errorMessage}
                    </p>
                  </div>
                ) : (
                  <p className="text-[13px] text-white/80 font-medium truncate">
                    {title}
                  </p>
                )}

                {/* Progress bar */}
                {showProgress && progress && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-mac-blue rounded-full"
                        initial={{ width: 0 }}
                        animate={{
                          width: `${Math.min(progress.percent, 100)}%`,
                        }}
                        transition={{ duration: 0.3, ease: 'easeOut' }}
                      />
                    </div>
                    <span className="text-[10px] text-white/40 tabular-nums flex-shrink-0 w-8 text-right">
                      {Math.round(progress.percent)}%
                    </span>
                  </div>
                )}
              </div>

              {/* Action button — aligns to top */}
              <div className="flex-shrink-0 flex items-start gap-2 mt-0.5">
                {actionLabel && (
                  <button
                    type="button"
                    onClick={handleAction}
                    className="px-3 py-1.5 rounded-mac-sm bg-white/10 hover:bg-white/15 text-white/80 hover:text-white text-xs font-medium transition-colors active:scale-95 whitespace-nowrap"
                  >
                    {status === 'downloaded' ? (
                      <span className="flex items-center gap-1.5">
                        <RefreshCw className="w-3 h-3" />
                        {actionLabel}
                      </span>
                    ) : (
                      actionLabel
                    )}
                  </button>
                )}

                {/* Dismiss */}
                <button
                  type="button"
                  onClick={dismiss}
                  className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-md text-white/30 hover:text-white/70 hover:bg-white/[0.08] transition-colors"
                  aria-label="Dismiss"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
