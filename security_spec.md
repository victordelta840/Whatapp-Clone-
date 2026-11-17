# Security Specification & Threat Model (`security_spec.md`)

## Phase 0 Security Invariants (Dirty Dozen Coverage)

1. **Default-Deny Catch-All**: `/databases/{database}/documents/{document=**}` explicitly denies `read, write: if false`.
2. **No Directory Scraping (`allow list: if false`)**:
   - `users/{uid}`, `users/{uid}/restricted/*`, `users/{uid}/private/*`, `presence/{uid}`, `usernames/*`, `phoneIndex/*`, `rateLimits/*`, `groupInvites/*`, `reports/*` forbid `list` from clients.
3. **Private PII Isolation**:
   - `users/{uid}/private/account` readable only by owner; write forbidden to clients (managed by Cloud Functions).
   - `users/{uid}/private/moderation` unreadable and unwritable by all clients.
   - `phoneIndex/{hmac}` and `usernames/{username}` server-only; never client-readable.
4. **Strict Reciprocity**:
   - `presence/{uid}` requires both viewer and target to satisfy `canViewRestrictedField(..., 'lastSeen')`.
   - `users/{uid}/restricted/photo` and `about` enforce `everyone` / `contacts` / `nobody` via `canViewRestrictedField`.
5. **Conversation Membership & Atomicity**:
   - `conversations/{cid}` readable/writable only by `participantIds` / `members/{uid}`.
   - Creating a message enforces `emailGate()`, `notRestricted()`, `isParticipant(cid)`, `senderId == request.auth.uid`, `createdAt == request.time`, and `getAfter(...).data.lastMessage.id == mid` atomically in a batch.
6. **Immutable / Windowed Message Mutations**:
   - Edits allowed only by original `senderId` within 15 minutes (`createdAt + duration.value(15, 'm')`) and only on `['text', 'editedAt']`.
   - Delete for everyone allowed only by `senderId` within 48 hours (`createdAt + duration.value(48, 'h')`) clearing `text`, `media`, and `replyTo`.
   - Reactions allowed only on `reactions.diff(...).affectedKeys().hasOnly([request.auth.uid])`.
7. **Status Expiry & Audience Enforcement**:
   - Client `get` requires `authorId == uid` or `uid in viewerIds && expiresAt > request.time`.
   - Client `create` / `update` on `statuses/{sid}` is denied (`createStatus` Cloud Function resolves audience and blocks).
8. **Calls State Machine Enforcement**:
   - Only `startCall` callable creates calls; client updates restricted by participant role (`calleeId` accepts/declines/busy from `ringing`; `callerId` cancels/misses from `ringing`; either participant ends/fails from `accepted`).
   - WebRTC signals (`calls/{callId}/signals`) enforce `from == request.auth.uid`, `to != request.auth.uid`, `to in participantIds`, and payload size <= 8 KB.
9. **Path Variable & Input Validation**:
   - `isValidId(id)` enforces `^[a-zA-Z0-9_\-]+$` (1–128 chars) on path parameters.
   - All text, URL, and enum fields enforce bounded types and lengths synchronized with `firebase-blueprint.json` and Zod schemas.
10. **Storage Rules Parity**:
    - Profile/group photos max 5 MB `image/(jpeg|png|webp|gif)`.
    - Chat media blocks executable extensions/MIME types, caps images (10 MB), video (64 MB), audio (16 MB), documents (50 MB), thumbnails (200 KB).
    - Exports readable only by owner, never client-writable.
