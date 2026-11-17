import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SetupRequired } from '@/app/SetupRequired';
import { Button, EmptyState } from '@/components/ui';

describe('App & UI primitives', () => {
  it('renders SetupRequired with missing keys clearly', () => {
    render(
      <SetupRequired
        missing={['VITE_FIREBASE_API_KEY']}
        invalid={[{ key: 'VITE_FIREBASE_PROJECT_ID', message: 'Invalid format' }]}
      />,
    );
    expect(screen.getByText('Firebase Setup Required')).toBeInTheDocument();
    expect(screen.getByText('VITE_FIREBASE_API_KEY')).toBeInTheDocument();
    expect(screen.getByText(/Invalid format/)).toBeInTheDocument();
  });

  it('renders Button and EmptyState primitives accessibly', () => {
    render(
      <EmptyState
        title="No chats"
        description="Start messaging."
        action={<Button>New chat</Button>}
      />,
    );
    expect(screen.getByText('No chats')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New chat' })).toBeInTheDocument();
  });
});
