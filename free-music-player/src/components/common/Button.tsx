import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}

export function Button({ variant = 'primary', size = 'md', loading, icon, children, className = '', disabled, ...props }: ButtonProps) {
  const baseClasses = 'inline-flex items-center justify-center gap-2 font-medium transition-all duration-150 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer';

  const variantClasses = {
    primary: 'bg-mac-blue hover:bg-[#0070E0] text-white',
    secondary: 'glass-control text-surface-200 hover:bg-mac-fill-hover border border-mac-separator',
    ghost: 'bg-transparent hover:bg-white/5 text-surface-300',
    danger: 'bg-mac-red hover:bg-[#E03D34] text-white',
  };

  const sizeClasses = {
    sm: 'h-7 px-3 text-[13px] rounded-mac-sm',
    md: 'h-7 px-4 text-[13px] rounded-mac-sm',
    lg: 'h-9 px-5 text-[15px] rounded-mac',
  };

  return (
    <button
      type="button"
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ) : icon ? (
        icon
      ) : null}
      {children}
    </button>
  );
}
