import React, { useState } from 'react';
import {
  Avatar,
  Badge,
  Banner,
  BottomSheet,
  Button,
  Checkbox,
  ConfirmDialog,
  Dialog,
  EmptyState,
  ErrorState,
  IconButton,
  Input,
  ListItem,
  Menu,
  Radio,
  SearchField,
  Select,
  Skeleton,
  Spinner,
  Switch,
  Tabs,
  TextArea,
  toast,
  TooltipProvider,
} from '@/components/ui';
import { MoreVertical, Plus, Send } from 'lucide-react';

export const ComponentGallery: React.FC = () => {
  const [switchVal, setSwitchVal] = useState(true);
  const [searchVal, setSearchVal] = useState('');
  const [tabVal, setTabVal] = useState('buttons');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <TooltipProvider>
      <main className="mx-auto max-w-5xl space-y-8 p-6 bg-surface text-text-primary">
        <header className="border-b border-border pb-4">
          <h1 className="text-2xl font-bold">Converse UI Component Gallery</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Development-only preview of design tokens and UI primitives using inline sample props.
          </p>
        </header>

        <Banner
          variant="info"
          message="Development gallery is excluded from production bundles."
          actionLabel="Trigger Toast"
          onAction={() =>
            toast.success('Sample toast', 'Demonstrating accessible toast with undo', {
              label: 'Undo',
              onClick: () => toast.info('Undone'),
            })
          }
        />

        <Tabs
          value={tabVal}
          onValueChange={setTabVal}
          items={[
            {
              value: 'buttons',
              label: 'Buttons & Inputs',
              content: (
                <div className="space-y-6 rounded-2xl border border-border bg-surface-raised p-6">
                  <div className="flex flex-wrap items-center gap-3">
                    <Button variant="primary">Primary</Button>
                    <Button variant="secondary">Secondary</Button>
                    <Button variant="accent">Accent</Button>
                    <Button variant="ghost">Ghost</Button>
                    <Button variant="danger">Danger</Button>
                    <Button loading>Loading</Button>
                    <IconButton label="New message" variant="brand">
                      <Plus className="h-5 w-5" />
                    </IconButton>
                    <IconButton label="Send" variant="surface">
                      <Send className="h-5 w-5" />
                    </IconButton>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Input label="Display name" placeholder="Alex Rivera" />
                    <Input
                      label="Username"
                      defaultValue="bad!"
                      error="Usernames must be 3-30 lowercase letters, numbers, dots, or underscores."
                    />
                    <Select
                      label="Privacy audience"
                      options={[
                        { value: 'everyone', label: 'Everyone' },
                        { value: 'contacts', label: 'My contacts' },
                        { value: 'nobody', label: 'Nobody' },
                      ]}
                    />
                    <SearchField value={searchVal} onChange={setSearchVal} placeholder="Search..." />
                  </div>

                  <TextArea label="About" placeholder="Share a short status line..." rows={2} />

                  <div className="space-y-2 border-t border-border pt-4">
                    <Switch
                      label="Read receipts"
                      description="Reciprocal: turning off hides others' read ticks."
                      checked={switchVal}
                      onCheckedChange={setSwitchVal}
                    />
                    <Checkbox label="Allow discovery by email" defaultChecked />
                    <Radio name="theme-sample" label="System theme" defaultChecked />
                  </div>
                </div>
              ),
            },
            {
              value: 'lists',
              label: 'Lists, Avatars & States',
              content: (
                <div className="space-y-6 rounded-2xl border border-border bg-surface-raised p-6">
                  <div className="flex items-center gap-4">
                    <Avatar name="Sample User" size="sm" />
                    <Avatar name="Maya Lin" size="md" online />
                    <Avatar name="Jordan Park" size="lg" statusRing="unviewed" />
                    <Avatar name="Samira Patel" size="xl" statusRing="viewed" />
                    <Badge count={3} />
                    <Badge count={120} muted />
                    <Spinner />
                  </div>

                  <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
                    <ListItem
                      leading={<Avatar name="Design Team" online />}
                      title="Design Team"
                      subtitle="Updated the spacing tokens for mobile."
                      trailing={
                        <Menu
                          trigger={
                            <IconButton label="Row options">
                              <MoreVertical className="h-4 w-4" />
                            </IconButton>
                          }
                          items={[
                            { id: 'pin', label: 'Pin chat', onSelect: () => toast.info('Pinned') },
                            {
                              id: 'del',
                              label: 'Delete',
                              danger: true,
                              onSelect: () => setConfirmOpen(true),
                            },
                          ]}
                        />
                      }
                      onClick={() => toast.info('Row clicked')}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <EmptyState
                      title="No conversations yet"
                      description="Start a direct or group chat."
                      actionLabel="New chat"
                      onAction={() => setDialogOpen(true)}
                    />
                    <ErrorState
                      message="Sample recoverable error state."
                      onRetry={() => toast.info('Retried')}
                    />
                  </div>
                  <Skeleton className="h-12 w-full" />
                </div>
              ),
            },
            {
              value: 'overlays',
              label: 'Dialogs & Sheets',
              content: (
                <div className="flex flex-wrap gap-3 rounded-2xl border border-border bg-surface-raised p-6">
                  <Button onClick={() => setDialogOpen(true)}>Open Dialog</Button>
                  <Button variant="secondary" onClick={() => setSheetOpen(true)}>
                    Open Bottom Sheet
                  </Button>
                  <Button variant="danger" onClick={() => setConfirmOpen(true)}>
                    Open Confirm Dialog
                  </Button>
                </div>
              ),
            },
          ]}
        />

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen} title="Sample Dialog">
          <p className="text-sm text-text-secondary">Focus is trapped inside this modal.</p>
        </Dialog>

        <BottomSheet open={sheetOpen} onOpenChange={setSheetOpen} title="Sample Bottom Sheet">
          <p className="text-sm text-text-secondary">Slides up on mobile viewports.</p>
        </BottomSheet>

        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title="Delete item?"
          description="This demonstrates a destructive confirmation prompt."
          destructive
          onConfirm={() => {
            setConfirmOpen(false);
            toast.success('Confirmed');
          }}
        />
      </main>
    </TooltipProvider>
  );
};
