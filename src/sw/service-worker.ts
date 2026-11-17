/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { ExpirationPlugin } from 'workbox-expiration';
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';

declare let self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// SPA navigation fallback; never cache authenticated API/Firebase traffic
const navigationHandler = createHandlerBoundToURL('/index.html');
const navigationRoute = new NavigationRoute(navigationHandler, {
  denylist: [/^\/api\//, /^\/__\//],
});
registerRoute(navigationRoute);

// Only cache static local public assets (never Firestore, Storage, Auth, or Functions)
registerRoute(
  ({ url, request }) =>
    url.origin === self.location.origin &&
    (request.destination === 'image' || request.destination === 'font'),
  new CacheFirst({
    cacheName: 'converse-static-assets',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 64,
        maxAgeSeconds: 30 * 24 * 60 * 60,
      }),
    ],
  }),
);

interface PushPayload {
  title?: string;
  body?: string;
  tag?: string;
  url?: string;
  conversationId?: string;
  callId?: string;
  kind?: string;
  unreadCount?: string;
}

self.addEventListener('push', (event: PushEvent) => {
  if (!event.data) return;
  let data: PushPayload = {};
  try {
    const raw = event.data.json() as {
      notification?: { title?: string; body?: string; tag?: string };
      data?: PushPayload;
    };
    data = {
      title: raw.notification?.title ?? raw.data?.title ?? 'WhatsApp',
      body: raw.notification?.body ?? raw.data?.body ?? 'New activity',
      tag: raw.notification?.tag ?? raw.data?.tag ?? raw.data?.conversationId ?? 'whatsapp-general',
      url: raw.data?.url,
      conversationId: raw.data?.conversationId,
      callId: raw.data?.callId,
      kind: raw.data?.kind,
      unreadCount: raw.data?.unreadCount,
    };
  } catch {
    data = {
      title: 'WhatsApp',
      body: event.data.text(),
      tag: 'whatsapp-general',
    };
  }

  const targetUrl =
    data.url ??
    (data.callId
      ? `/call/${data.callId}`
      : data.conversationId
        ? `/chats/${data.conversationId}`
        : '/chats');

  const isCall = data.kind === 'call' || Boolean(data.callId);
  const actions: Array<{ action: string; title: string }> = isCall
    ? [
        { action: 'answer', title: 'Answer' },
        { action: 'decline', title: 'Decline' },
      ]
    : [];

  event.waitUntil(
    (async () => {
      if (data.unreadCount && 'setAppBadge' in self.navigator) {
        const count = Number.parseInt(data.unreadCount, 10);
        if (Number.isFinite(count) && count > 0) {
          try {
            await (self.navigator as unknown as { setAppBadge: (n: number) => Promise<void> }).setAppBadge(count);
          } catch {
            // Badge API unavailable in this context
          }
        }
      }

      const notificationOptions: NotificationOptions & {
        actions?: Array<{ action: string; title: string }>;
      } = {
        body: data.body ?? 'New message',
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tag: data.tag,
        data: {
          url: targetUrl,
          conversationId: data.conversationId,
          callId: data.callId,
        },
        actions,
      };

      await self.registration.showNotification(data.title ?? 'WhatsApp', notificationOptions);
    })(),
  );
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  const payload = (event.notification.data ?? {}) as {
    url?: string;
    conversationId?: string;
    callId?: string;
  };
  let targetUrl = payload.url ?? '/chats';
  if (event.action === 'answer' && payload.callId) {
    targetUrl = `/call/${payload.callId}?action=answer`;
  } else if (event.action === 'decline' && payload.callId) {
    targetUrl = `/call/${payload.callId}?action=decline`;
  }

  event.waitUntil(
    (async () => {
      const windowClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      for (const client of windowClients) {
        if ('focus' in client) {
          await client.focus();
          client.postMessage({
            type: 'CONVERSE_NOTIFICATION_CLICK',
            url: targetUrl,
            action: event.action || 'open',
            callId: payload.callId,
            conversationId: payload.conversationId,
          });
          return;
        }
      }
      await self.clients.openWindow(targetUrl);
    })(),
  );
});

self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if (event.data && (event.data as { type?: string }).type === 'SKIP_WAITING') {
    void self.skipWaiting();
  }
});
