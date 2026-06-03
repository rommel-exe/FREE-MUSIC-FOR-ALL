import React from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            className={`relative ${sizeClasses[size]} w-full bg-surface-800 border border-mac-separator rounded-mac-lg shadow-2xl overflow-hidden`}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', duration: 0.25, bounce: 0.15 }}
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-mac-separator">
              <h2 className="text-[15px] font-semibold text-surface-100">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded-mac-sm hover:bg-white/5 text-surface-400 hover:text-surface-100 transition-colors duration-150"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-5 max-h-[70vh] overflow-y-auto">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
