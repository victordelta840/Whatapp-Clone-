import React from 'react';

export interface BadgeProps {
  count: number;
  muted?: boolean;
  label?: string;
}

export const Badge: React.FC<BadgeProps> = ({ count, muted = false, label }) => {
  if (count <= 0) return null;
  const display = count > 99 ? '99+' : String(count);
  return (
    <span
      aria-label={label ?? `${count} unread`}
      className={`inline-flex min-w-[22px] h-[22px] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums ${
        muted
          ? 'bg-surface-sunken text-text-secondary'
          : 'bg-brand text-brand-foreground'
      }`}
    >
      {display}
    </span>
  );
};
