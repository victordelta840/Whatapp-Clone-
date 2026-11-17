# Known Limitations

## Explicitly Out of Scope (By Specification)
1. **No End-to-End Encryption (E2EE)**: Messages, media, statuses, and backups are protected in transit (TLS) and at rest by Google Cloud infrastructure and are readable by the service operator. Converse never claims end-to-end encryption.
2. **No Multi-Party Group Calls**: Calls are strictly one-to-one peer-to-peer WebRTC (`RTCPeerConnection`). Group calls require an SFU/media server and are out of scope.
3. **No Server-Side Link Previews**: URLs in messages are safely linkified (`http`, `https`, `mailto`, `tel` with `rel="noopener noreferrer nofollow"`), without server-side OpenGraph fetching.
4. **No Stickers, GIF Search, Broadcast Lists, Channels, Communities, Payments, or Native Binaries**: Not built or simulated.

## Platform & Infrastructure Limitations
1. **Presence Abrupt Disconnect Lag**: Presence relies on a 45-second Firestore heartbeat and a 90-second freshness window. If a tab crashes or loses connectivity abruptly without firing `pagehide`, the user can appear online for up to 90 seconds. (Realtime Database `onDisconnect` is an optional future upgrade requiring explicit approval.)
2. **Background Ringing on the Web**: Browsers do not allow web apps to display a native full-screen incoming-call UI or play ringtones continuously while the app is closed. Closed-app incoming calls rely on Web Push notifications; opening the notification is required to answer.
3. **Preview Frame Restrictions**: Inside sandboxed iframe previews (such as AI Studio preview), Service Workers, Web Push notifications, camera/microphone permissions, and OAuth popups may be blocked by iframe sandbox or permissions policies. Validate PWA install, push, and calling on a deployed HTTPS origin or in a full browser tab.
4. **Local Full-Text Search Scope**: Firestore lacks native full-text search. Global and in-chat message search queries the client's IndexedDB index (up to 5,000 messages per conversation) covering messages synced to the current device.
5. **Blocking & Firestore Queries**: Firestore security rules cannot filter documents out of a collection query (`messages`). Therefore, messages sent by a blocked user before/around blocking are suppressed server-side for notifications/unread counts and hidden in the blocker's client UI.
6. **Deleted Account Data in Backups**: Account deletion purges active Firestore profiles, chat states, devices, statuses, Storage media, and replaces sent message text with a "Deleted account" tombstone; however, historical data may persist inside scheduled Firestore/Storage backups until their retention windows expire.
7. **Storage Rules Cross-Service Database Name**: `storage.rules` cross-service `firestore.get()` calls target `(default)` Firestore database in standard Firebase deployments. If using a non-default named Firestore database, storage rules cross-service lookups require `(default)` or server-mediated signed access.
