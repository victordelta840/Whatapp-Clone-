# Deployment Guide

## Prerequisites
- Firebase CLI (`npm i -g firebase-tools`) logged into your project (`gen-lang-client-0894043053` or your target project).
- Node.js 22+ and Blaze billing enabled on Firebase for Cloud Functions 2nd gen and Storage.

## 1. Environment & Secrets
1. Frontend public variables live in `.env.local` (or `firebase-applet-config.json` fallback):
   - `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_DATABASE_ID`
   - Optional external integrations: `VITE_FIREBASE_VAPID_KEY`, `VITE_APPCHECK_SITE_KEY`
2. Server-only secrets for Cloud Functions (never placed in `VITE_*`):
   ```bash
   firebase functions:secrets:set PHONE_HASH_PEPPER
   firebase functions:secrets:set TURN_SHARED_SECRET
   firebase functions:secrets:set TURN_URLS
   ```
3. **Named Firestore Database**: The AI Studio provisioned project uses named database `ai-studio-a98db9ab-2051-4bc7-8254-906ad7ca81d5` in `firebase-applet-config.json`. Both the frontend SDK and `functions/src/lib/db.ts` (`FIRESTORE_DATABASE_ID`) target this named database automatically.
4. For complete Android PWA / `.apk` and real Phone OTP + Push setup instructions, see `docs/ANDROID_WHATSAPP_SETUP.md`.

## 2. Build & Deploy Steps
```bash
# Install root and functions dependencies
npm install
npm --prefix functions install

# Run checks & production build
npm run typecheck
npm run lint
npm test
npm run build
npm --prefix functions run build

# Deploy rules, indexes, functions, and hosting
npm run deploy:rules
npm run deploy:functions
npm run deploy:hosting
```

## 3. Rollback Checklist
1. **Hosting**: Re-deploy previous release in Firebase Hosting Console ("Roll back").
2. **Rules**: Revert `firestore.rules` / `storage.rules` commit and run `firebase deploy --only firestore:rules,storage`.
3. **Functions**: Re-deploy prior tag via `firebase deploy --only functions`.
