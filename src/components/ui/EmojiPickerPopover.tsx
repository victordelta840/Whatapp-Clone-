import React, { useEffect, useRef, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Smile } from 'lucide-react';
import { IconButton } from './IconButton';

interface EmojiPickerPopoverProps {
  onSelectEmoji: (emoji: string) => void;
  disabled?: boolean;
  label?: string;
}

const LazyEmojiElement: React.FC<{ onSelect: (emoji: string) => void }> = ({ onSelect }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    let pickerEl: HTMLElement | null = null;
    const handleEmojiClick = (event: Event) => {
      const detail = (event as CustomEvent<{ unicode?: string }>).detail;
      if (detail?.unicode) {
        onSelect(detail.unicode);
      }
    };

    void import('emoji-picker-element').then(() => {
      if (!mounted || !containerRef.current) return;
      const el = document.createElement('emoji-picker');
      el.className = 'converse-emoji-picker';
      el.addEventListener('emoji-click', handleEmojiClick);
      containerRef.current.innerHTML = '';
      containerRef.current.appendChild(el);
      pickerEl = el;
      setLoaded(true);
    });

    return () => {
      mounted = false;
      if (pickerEl) {
        pickerEl.removeEventListener('emoji-click', handleEmojiClick);
      }
    };
  }, [onSelect]);

  return (
    <div className="min-h-[320px] min-w-[300px]">
      {!loaded && (
        <div className="flex h-[320px] items-center justify-center text-xs text-text-secondary">
          Loading emoji picker...
        </div>
      )}
      <div ref={containerRef} />
    </div>
  );
};

export const EmojiPickerPopover: React.FC<EmojiPickerPopoverProps> = ({
  onSelectEmoji,
  disabled = false,
  label = 'Insert emoji',
}) => {
  const [open, setOpen] = useState(false);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <IconButton label={label} disabled={disabled}>
          <Smile className="h-5 w-5" aria-hidden="true" />
        </IconButton>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          align="start"
          sideOffset={8}
          className="z-50 overflow-hidden rounded-2xl border border-border bg-surface-raised shadow-xl focus:outline-none"
        >
          {open && (
            <LazyEmojiElement
              onSelect={(emoji) => {
                onSelectEmoji(emoji);
              }}
            />
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};
