# Converse Architecture

## Overview
Converse is a responsive, installable Progressive Web App (PWA) built with React, TypeScript (strict mode), Vite, Tailwind CSS, and Firebase (Authentication, Cloud Firestore, Cloud Storage, Cloud Functions 2nd gen, Cloud Messaging, and App Check).

## Feature-Sliced Module Boundaries
- `src/config/`: Environment validation (`env.ts` — the sole `import.meta.env` consumer), centralized limits (`constants.ts`), App Check (`appCheck.ts`), and Firebase modular SDK initialization (`firebase.ts`).
- `src/types/`: Zod-validated domain schemas and `FirestoreDataConverter` definitions.
- `src/lib/`: Cross-cutting client engines — IndexedDB persistence (`idb.ts`), local message search index (`search-index.ts`), media compression/recording (`media/`), WebRTC signaling & peer management (`webrtc/`), PWA install & SW update helpers (`pwa/`), formatting (`format/`), redacted logger (`logger.ts`), and error mapping (`errors.ts`).
- `src/components/ui/`: Accessible UI primitives built with Radix UI and Tailwind CSS tokens.
- `src/features/*`: Isolated domain modules (`auth`, `profile`, `presence`, `contacts`, `conversations`, `messages`, `groups`, `status`, `calls`, `notifications`, `privacy`, `settings`). Each exposes a public `index.ts`; cross-feature deep imports are prohibited.
- `functions/src/`: 2nd-generation TypeScript Cloud Functions organized into `callable/`, `triggers/`, `scheduled/`, and `lib/`.

## Key Architectural Decisions
1. **Named Firestore Database Support**: `src/config/firebase.ts` initializes Firestore with `persistentLocalCache({ tabManager: persistentMultipleTabManager() })` and passes `firestoreDatabaseId` when configured (supporting both `(default)` and provisioned named databases). Falls back to `memoryLocalCache()` in private browsing where IndexedDB is restricted, surfacing the degraded state in **Settings → Diagnostics**.
2. **Offline-First Message Ordering**: Message creation uses client-generated document IDs and a single batched write (`messages/{mid}` + `conversations/{cid}.lastMessage*`) validated atomically in Firestore rules via `getAfter()`. This keeps chat list previews accurate offline and makes retries idempotent.
3. **High-Water Receipt Pointers**: Rather than per-message receipt writes, `conversations/{cid}/members/{uid}` stores `lastDeliveredAt`, `lastReadAt`, and `lastReadMessageId`, updated monotonically once on chat open/scroll.
4. **Presence Heartbeats**: Presence uses `presence/{uid}` with a 45-second visibility-aware heartbeat and a 90-second viewer threshold instead of adding Realtime Database. Realtime Database `onDisconnect` is recorded as an optional future upgrade requiring explicit approval.
5. **Single Service Worker**: `vite-plugin-pwa` uses `injectManifest` (`src/sw/service-worker.ts`) to unify Workbox precaching, safe static runtime caching, FCM background push handling, and `notificationclick` routing. Authenticated Firebase requests (Firestore, Storage, Auth, Functions) are never cached by the service worker.
6. **Local Message Search**: Because Firestore does not provide native full-text search, Converse maintains an IndexedDB per-user search index (`idb`) populated from active listeners (up to 5,000 messages per conversation) and clearly labels search results as covering locally synced messages.
