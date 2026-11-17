# Security Architecture & Verification

## 1. Defense in Depth
- **Firestore & Storage Rules**: Default-deny catch-all, strict field whitelists, path-variable regex checks, `emailGate()` verification requirement, server-only `private/moderation`, `private/account`, `usernames`, `phoneIndex`, `rateLimits`, and `groupInvites`.
- **Reciprocity**: Last-seen/online presence and direct-chat read receipts enforce two-way reciprocity.
- **No Directory Enumeration**: `allow list: if false` on `users`, `presence`, `usernames`, `phoneIndex`, `reports`.
- **Server-Side Rate Limiting**: Token/window counters in `rateLimits/{uid_action}` for `lookupUser`, `discoverContacts`, `startDirectChat`, `createGroup`, `createStatus`, `startCall`, `getIceServers`, and `exportMyData`.
- **No XSS / Unsafe Links**: Zero `dangerouslySetInnerHTML`; linkification permits only `http:`, `https:`, `mailto:`, `tel:` with `rel="noopener noreferrer nofollow"`.
- **Upload Safety**: Executable extensions and MIME types blocked both client-side and in `storage.rules`; canvas re-encoding strips EXIF metadata from images.

## 2. App Check
- `src/config/appCheck.ts` initializes ReCaptchaV3Provider before any Firebase service call when `VITE_APPCHECK_SITE_KEY` is configured, and enables `consumeAppCheckToken: true` on sensitive callables (`discoverContacts`, `lookupUser`, `getIceServers`).
- In development without a site key, diagnostics explicitly reports **Requires external configuration**.

## 3. Known Security Non-Claims
- Messages are encrypted in transit (TLS) and at rest by Google Cloud/Firebase, **not** end-to-end encrypted.
- Security rules should be audited and verified against the Firebase Emulator Suite (`npm run test:rules`) before broad public rollout.
