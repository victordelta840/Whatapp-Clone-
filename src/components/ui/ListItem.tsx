import React from 'react';

export interface ListItemProps {
  leading?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  trailing?: React.ReactNode;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}

export const ListItem: React.FC<ListItemProps> = ({
  leading,
  title,
  subtitle,
  trailing,
  selected = false,
  onClick,
  className = '',
}) => {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      className={`flex w-full min-h-[60px] items-center gap-3 px-4 py-2.5 text-start transition-colors duration-fast ${
        selected ? 'bg-brand/10 dark:bg-brand/20' : onClick ? 'hover:bg-surface-sunken' : ''
      } ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      {leading && <div className="shrink-0">{leading}</div>}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-text-primary">{title}</div>
        {subtitle && <div className="mt-0.5 truncate text-xs text-text-secondary">{subtitle}</div>}
      </div>
      {trailing && <div className="shrink-0">{trailing}</div>}
    </Tag>
  );
};
