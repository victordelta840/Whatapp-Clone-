import { describe, expect, it, vi } from 'vitest';
import { updateAppBadgeCount } from '@/features/notifications/notifications.service';

describe('notifications & app badge helper', () => {
  it('updates document title with unread count and clears back to WhatsApp', () => {
    const clearSpy = vi.fn().mockResolvedValue(undefined);
    const setSpy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'setAppBadge', { value: setSpy, configurable: true });
    Object.defineProperty(navigator, 'clearAppBadge', { value: clearSpy, configurable: true });

    updateAppBadgeCount(3);
    expect(document.title).toBe('(3) WhatsApp');
    expect(setSpy).toHaveBeenCalledWith(3);

    updateAppBadgeCount(0);
    expect(document.title).toBe('WhatsApp');
    expect(clearSpy).toHaveBeenCalled();
  });
});
