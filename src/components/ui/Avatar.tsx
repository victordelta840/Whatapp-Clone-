import React, { useState } from 'react';

export interface AvatarProps {
  name: string;
  src?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  online?: boolean;
  statusRing?: 'unviewed' | 'viewed' | 'none';
  className?: string;
}

const sizeClasses = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-lg',
};

const BG_PALETTE = [
  'bg-indigo-700 text-white',
  'bg-emerald-700 text-white',
  'bg-slate-700 text-white',
  'bg-amber-700 text-white',
  'bg-teal-700 text-white',
  'bg-cyan-700 text-white',
];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]?.[0] ?? '';
  const second = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + second).toUpperCase();
}

function pickPalette(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return BG_PALETTE[hash % BG_PALETTE.length] ?? BG_PALETTE[0]!;
}

export const Avatar: React.FC<AvatarProps> = ({
  name,
  src,
  size = 'md',
  online = false,
  statusRing = 'none',
  className = '',
}) => {
  const [imgFailed, setImgFailed] = useState(false);

  const ringClass =
    statusRing === 'unviewed'
      ? 'ring-2 ring-accent ring-offset-2 ring-offset-surface'
      : statusRing === 'viewed'
        ? 'ring-2 ring-border ring-offset-2 ring-offset-surface'
        : '';

  return (
    <div className={`relative inline-flex shrink-0 items-center justify-center ${className}`}>
      <div
        className={`relative overflow-hidden rounded-full flex items-center justify-center font-semibold select-none ${sizeClasses[size]} ${ringClass} ${
          !src || imgFailed ? pickPalette(name) : 'bg-surface-sunken'
        }`}
      >
        {src && !imgFailed ? (
          <img
            src={src}
            alt={name}
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <span aria-label={name}>{getInitials(name)}</span>
        )}
      </div>
      {online && (
        <span
          aria-label="Online"
          title="Online"
          className="absolute bottom-0 end-0 h-3 w-3 rounded-full border-2 border-surface-raised bg-success"
        />
      )}
    </div>
  );
};
