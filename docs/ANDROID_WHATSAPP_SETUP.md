# Android & Real WhatsApp Setup Guide

This guide walks through every step needed to make this app run on **Android** and work like **real WhatsApp** (live SMS OTP login, real-time chats & groups, contact discovery, background push notifications, and cellular/Wi-Fi audio/video calls).

---

## Step 1: Enable Real Phone Number + SMS OTP in Firebase Console

1. Open [Firebase Console](https://console.firebase.google.com/) and select your project (`gen-lang-client-0894043053`).
2. Go to **Authentication -> Sign-in method -> Add new provider -> Phone** and toggle **Enable**, then click **Save**.
3. Under **Authentication -> Settings -> Authorized domains**, verify your hosting / preview domains are listed:
   - `localhost`
   - `gen-lang-client-0894043053.firebaseapp.com`
   - `gen-lang-client-0894043053.web.app`
   - Any preview / custom Android TWA domain you serve from.
4. *(Recommended while testing)* Under **Phone -> Phone numbers for testing**, add your test numbers (e.g. `+91 9999999999` with code `123456`) so you can verify logins repeatedly without hitting SMS carrier quotas.
5. Under **Authentication -> Settings -> SMS region policy**, allow the country codes your users will sign in from (e.g., India `+91`, US `+1`, UK `+44`).
6. *(Important for real production SMS)* Link a **Cloud Billing (Blaze)** account in Firebase — Google Identity Platform provides free daily SMS quota on Blaze, whereas Spark restricts SMS delivery.

---

## Step 2: Deploy Rules, Indexes, and Cloud Functions

The web app and `functions/src/**` are pre-configured for the named Firestore database:
`ai-studio-a98db9ab-2051-4bc7-8254-906ad7ca81d5`.

1. Install dependencies locally and in `functions/`:
   ```bash
   npm install
   npm --prefix functions install
   ```
2. Log into Firebase CLI and select the project:
   ```bash
   npx firebase login
   npx firebase use gen-lang-client-0894043053
   ```
3. Set the required server secrets for contact phone discovery (`PHONE_HASH_PEPPER`) and WebRTC TURN relay (`TURN_SHARED_SECRET`, `TURN_URLS`):
   ```bash
   npx firebase functions:secrets:set PHONE_HASH_PEPPER
   npx firebase functions:secrets:set TURN_SHARED_SECRET
   npx firebase functions:secrets:set TURN_URLS
   ```
4. Deploy Firestore Security Rules, composite indexes, Storage rules, Cloud Functions, and Hosting:
   ```bash
   npm run build
   npm --prefix functions run build
   npx firebase deploy --only firestore:rules,firestore:indexes,storage,functions,hosting
   ```
   > If your CLI deploys rules only to `(default)` when using a named database, ensure `firebase.json` targets `ai-studio-a98db9ab-2051-4bc7-8254-906ad7ca81d5` or deploy via Google Cloud / AI Studio Firebase Rules deployment.

---

## Step 3: Enable Real-Time Background Push Notifications on Android

1. In Firebase Console -> **Project settings -> Cloud Messaging -> Web Push certificates**, click **Generate key pair**.
2. Copy the public VAPID key and set `VITE_FIREBASE_VAPID_KEY` in `.env.local` (before `npm run build`):
   ```env
   VITE_FIREBASE_VAPID_KEY=YOUR_PUBLIC_VAPID_KEY
   ```
3. Enable **Firebase App Check** (Project settings -> App Check -> Register app with reCAPTCHA Enterprise) and set `VITE_APPCHECK_SITE_KEY` in `.env.local`.
4. After logging in on Android, open **Settings -> Notifications -> Register device** and allow notification permission. Incoming messages and calls trigger FCM notifications via `onMessageCreated` and `onCallCreated`.

---

## Step 4: Enable Real Audio/Video Calls Over Mobile Data (TURN Relay)

Direct peer-to-peer STUN works on local Wi-Fi, while cellular 4G/5G carrier NATs require a TURN server:
1. Provision a coturn server or managed TURN provider (e.g. Cloudflare Calls, Metered, Twilio Network Traversal).
2. Store the shared secret and comma-separated `turn:` / `turns:` URLs in Step 2:
   - `TURN_SHARED_SECRET` = coturn `static-auth-secret`
   - `TURN_URLS` = `turn:turn.yourdomain.com:3478,turns:turn.yourdomain.com:5349`
3. Verify connectivity in the app under **Settings -> Diagnostics -> Test TURN**.

---

## Step 5: Install & Run as a Native-Style Android App

### Option A: Instant Install on Android (Chrome WebAPK — No Android Studio Needed)
1. Open your deployed HTTPS URL (e.g. `https://gen-lang-client-0894043053.web.app`) in **Google Chrome** on your Android phone.
2. Tap the **Install** banner (or tap Chrome's **⋮ menu -> Install app** / **Add to Home screen**, or go to **Settings -> Account & security -> Install now**).
3. Chrome generates and installs a signed **Android WebAPK**:
   - Launches from your home screen & app drawer in full-screen standalone mode (`display: standalone`, no browser address bar).
   - Supports Android long-press icon shortcuts (**Chats**, **Updates**, **Calls**), unread app icon badges, soft-keyboard auto-resizing, camera/mic calls, and lock-screen push notifications.

### Option B: Build a Distributable `.apk` / Play Store `.aab` (Trusted Web Activity)
If you want an `.apk` file to sideload or upload to Google Play Console:
```bash
npm i -g @bubblewrap/cli
bubblewrap init --manifest=https://gen-lang-client-0894043053.web.app/manifest.webmanifest
bubblewrap build
```
Upload the SHA-256 certificate fingerprint generated by Bubblewrap into `public/.well-known/assetlinks.json` (and Firebase Hosting) so the Android APK opens seamlessly without any browser chrome.
