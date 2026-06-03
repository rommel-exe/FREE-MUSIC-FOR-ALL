import React from 'react';
import { Music } from 'lucide-react';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <div className="w-16 h-16 rounded-mac-lg bg-mac-fill/30 flex items-center justify-center mb-4">
        {icon || <Music size={28} className="text-surface-500" />}
      </div>
      <h3 className="text-[17px] font-semibold text-surface-200 mb-1">{title}</h3>
      {description && <p className="text-[13px] text-surface-400 mb-4 max-w-sm">{description}</p>}
      {actionLabel && onAction && (
        <Button variant="primary" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
