import React from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore } from '@/store/uiStore';

export function ToastContainer() {
  const { toasts, removeToast } = useUIStore();

  const icons = {
    success: <CheckCircle size={16} className="text-mac-green" />,
    error: <AlertCircle size={16} className="text-mac-red" />,
    info: <Info size={16} className="text-mac-blue" />,
  };

  return (
    <div className="fixed top-10 right-3 z-[100] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 40, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="pointer-events-auto glass-elevated rounded-mac-lg px-4 py-3 flex items-center gap-3 shadow-xl min-w-[260px] max-w-[340px]"
          >
            {icons[toast.type]}
            <span className="text-[13px] text-surface-200 flex-1">{toast.message}</span>
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              className="text-surface-500 hover:text-surface-100 transition-colors duration-150"
            >
              <X size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
