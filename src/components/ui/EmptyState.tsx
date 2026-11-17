import React from 'react';
import { Button } from './Button';

export interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  illustration?: 'chats' | 'status' | 'calls' | 'search' | 'notifications';
}

const IllustrationSvg: React.FC<{ kind: NonNullable<EmptyStateProps['illustration']> }> = ({
  kind,
}) => {
  return (
    <svg
      width="88"
      height="88"
      viewBox="0 0 88 88"
      fill="none"
      aria-hidden="true"
      className="mx-auto text-brand/80"
    >
      <circle cx="44" cy="44" r="40" className="fill-surface-sunken stroke-border" strokeWidth="1.5" />
      {kind === 'chats' && (
        <>
          <rect x="24" y="26" width="40" height="28" rx="8" className="fill-brand/15 stroke-brand" strokeWidth="2" />
          <path d="M32 54L26 62V54" className="fill-brand/15 stroke-brand" strokeWidth="2" strokeLinejoin="round" />
          <circle cx="36" cy="40" r="2.5" className="fill-accent" />
          <circle cx="44" cy="40" r="2.5" className="fill-brand" />
          <circle cx="52" cy="40" r="2.5" className="fill-brand" />
        </>
      )}
      {kind === 'status' && (
        <>
          <circle cx="44" cy="44" r="18" className="stroke-accent" strokeWidth="3" strokeDasharray="18 6" />
          <circle cx="44" cy="44" r="10" className="fill-brand/20 stroke-brand" strokeWidth="2" />
        </>
      )}
      {kind === 'calls' && (
        <path
          d="M32 28C32 28 36 28 38 33C39 36 37 38 36 40C38 44 44 50 48 52C50 51 52 49 55 50C60 52 60 56 60 56C60 58 57 61 52 61C40 61 27 48 27 36C27 31 30 28 32 28Z"
          className="fill-brand/15 stroke-brand"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      )}
      {kind === 'search' && (
        <>
          <circle cx="41" cy="41" r="13" className="fill-brand/15 stroke-brand" strokeWidth="2" />
          <path d="M51 51L60 60" className="stroke-brand" strokeWidth="2.5" strokeLinecap="round" />
        </>
      )}
      {kind === 'notifications' && (
        <>
          <path
            d="M44 26C37 26 33 31 33 38V47L29 53H59L55 47V38C55 31 51 26 44 26Z"
            className="fill-brand/15 stroke-brand"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <circle cx="44" cy="58" r="3" className="fill-accent" />
        </>
      )}
    </svg>
  );
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  action,
  actionLabel,
  onAction,
  illustration = 'chats',
}) => {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      {icon ? (
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-surface-sunken border border-border">
          {icon}
        </div>
      ) : (
        <IllustrationSvg kind={illustration} />
      )}
      <h2 className="mt-4 text-base font-semibold text-text-primary">{title}</h2>
      <p className="mt-1.5 max-w-sm text-sm text-text-secondary leading-relaxed">{description}</p>
      {action ? (
        <div className="mt-5">{action}</div>
      ) : (
        actionLabel &&
        onAction && (
          <div className="mt-5">
            <Button onClick={onAction}>{actionLabel}</Button>
          </div>
        )
      )}
    </div>
  );
};
