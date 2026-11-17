import React from 'react';
import { Loader2 } from 'lucide-react';

const SPINNER_SIZES = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-8 w-8',
};

export const Spinner: React.FC<{
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}> = ({ label = 'Loading', size = 'md', className }) => {
  const sizeClass = className ?? SPINNER_SIZES[size];
  return (
    <span role="status" aria-label={label} className="inline-flex items-center justify-center">
      <Loader2 className={`animate-spin text-brand ${sizeClass}`} aria-hidden="true" />
    </span>
  );
};
