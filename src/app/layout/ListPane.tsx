import React from 'react';

export interface ListPaneProps {
  children: React.ReactNode;
  className?: string;
}

export const ListPane: React.FC<ListPaneProps> = ({ children, className = '' }) => {
  return (
    <aside
      aria-label="List pane"
      className={`flex h-full w-full shrink-0 flex-col border-e border-border bg-surface-raised md:w-[340px] lg:w-[380px] xl:w-[410px] ${className}`}
    >
      {children}
    </aside>
  );
};
