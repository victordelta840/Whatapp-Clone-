import React from 'react';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  variant?: 'ghost' | 'surface' | 'brand' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

const variantMap = {
  ghost: 'text-text-secondary hover:text-text-primary hover:bg-surface-sunken',
  surface: 'border border-border bg-surface-raised text-text-primary hover:bg-surface-sunken',
  brand: 'bg-brand text-brand-foreground hover:bg-brand-hover',
  danger: 'bg-danger text-white hover:opacity-90',
};

const sizeDimMap = {
  sm: 'min-h-[36px] min-w-[36px]',
  md: 'min-h-[44px] min-w-[44px]',
  lg: 'min-h-[48px] min-w-[48px]',
};

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, variant = 'ghost', size = 'md', className = '', type = 'button', children, ...rest }, ref) => {
    const dim = sizeDimMap[size];
    return (
      <button
        ref={ref}
        type={type}
        aria-label={label}
        title={label}
        className={`inline-flex items-center justify-center rounded-xl transition-colors duration-fast shrink-0 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${dim} ${variantMap[variant]} ${className}`}
        {...rest}
      >
        {children}
      </button>
    );
  },
);

IconButton.displayName = 'IconButton';
