import React from 'react';
import { Search } from 'lucide-react';

interface InputProps {
  label?: string;
  icon?: React.ReactNode;
  error?: string;
  className?: string;
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  type?: string;
}

export function Input({ label, icon, error, className = '', placeholder, value, onChange, onKeyDown, type = 'text' }: InputProps) {
  return (
    <div className="w-full">
      {label && <label className="block text-[13px] font-medium text-surface-300 mb-1.5">{label}</label>}
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500">
            {icon}
          </div>
        )}
        <input
          type={type}
          className={`w-full h-7 bg-mac-fill/50 border border-mac-separator rounded-mac-sm px-3 text-[13px] text-surface-100 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-mac-blue/30 focus:border-mac-blue/50 transition-all duration-150 ${icon ? 'pl-9' : ''} ${error ? 'border-mac-red/50' : ''} ${className}`}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          onKeyDown={onKeyDown}
        />
      </div>
      {error && <p className="mt-1 text-[11px] text-mac-red">{error}</p>}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search...', className = '' }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <Input
      icon={<Search size={14} />}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={className}
    />
  );
}
