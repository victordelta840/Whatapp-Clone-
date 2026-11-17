import React from 'react';

export interface ConversationPaneProps {
  children: React.ReactNode;
  className?: string;
}

export const ConversationPane: React.FC<ConversationPaneProps> = ({ children, className = '' }) => {
  return (
    <main
      id="main-content"
      className={`flex min-w-0 flex-1 flex-col bg-surface overflow-hidden ${className}`}
    >
      {children}
    </main>
  );
};
