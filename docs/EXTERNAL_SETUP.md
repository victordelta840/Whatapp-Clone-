# External Setup Guide

Follow every manual step below to connect Converse to a live production Firebase project.

## 1. Firebase Project & Web App
1. Open the [Firebase Console](https://console.firebase.google.com/) and create separate projects for `development`, `staging`, and `production` (or use the project provisioned by AI Studio).
2. Register a Web App in Project Settings and copy the public `VITE_FIREBASE_*` keys into your environment configuration (see `.env.example`). Never commit `.env` files.
3. Copy `.firebaserc.example` to `.firebaserc` and map your `development`, `staging`, and `production` project IDs.

## 2. Upgrade to Blaze (Pay-As-You-Go) Plan
2nd-generation Cloud Functions, Cloud Scheduler jobs, Secret Manager, and production Phone Authentication require the Firebase **Blaze** plan.
1. Upgrade the project in Firebase Console → **Usage and billing**.
2. Set a Google Cloud billing **budget alert** (e.g., 50%, 90%, 100%) to guard against quota or SMS-pumping spikes.

## 3. Enable Authentication Providers
In Firebase Console → **Authentication → Sign-in method**:
1. Enable **Email/Password** (with email enumeration protection enabled in Settings → User actions, and a minimum password length policy of 8 characters).
2. Enable **Google** sign-in and configure the support email.
3. Enable **Phone** sign-in:
   - Add test phone numbers and verification codes for development/testing.
   - Configure an **SMS Region Policy** allowing only intended countries to prevent SMS-pumping abuse.
4. Under **Authentication → Settings → Authorized domains**, add your Firebase Hosting domain, custom domain, and preview/local domains.
5. For installed iOS PWAs and browsers that partition third-party storage, configure a custom `authDomain` on the app's own domain (see Firebase Hosting reverse proxy guidance).

## 4. Enable Firestore, Storage, and TTL Policies
1. Enable **Cloud Firestore** in Native mode.
2. Enable **Cloud Storage** in the matching region.
3. Configure a **Firestore TTL policy** on collection group `statuses`, field `deleteAt`:
   ```bash
   gcloud firestore fields ttls update deleteAt \
     --collection-group=statuses \
     --enable-ttl \
     --project=<PROJECT_ID>
   ```
4. Enable Firestore **Point-in-Time Recovery (PITR)** and scheduled backups (see `docs/BACKUP_RECOVERY.md`).

## 5. App Check (reCAPTCHA Enterprise)
1. In Google Cloud Console → **reCAPTCHA Enterprise**, create a score-based web key for your domains (or register a **reCAPTCHA v3** key as the fallback).
2. Set `VITE_APPCHECK_SITE_KEY` in your client environment.
3. In Firebase Console → **App Check**, register the Web App with the reCAPTCHA Enterprise site key, deploy in **monitoring mode** first, review request metrics, and then enforce for Firestore, Storage, Authentication, and Functions.
4. For local development only, set `VITE_APPCHECK_DEBUG_TOKEN` to a registered debug token from Firebase Console → App Check → Apps → Manage debug tokens.

## 6. FCM Web Push (VAPID Key)
1. Open Firebase Console → **Project Settings → Cloud Messaging → Web configuration**.
2. Generate a **Web Push certificate** key pair.
3. Set the public key as `VITE_FIREBASE_VAPID_KEY`.

## 7. Cloud Functions Secrets (TURN & Phone Pepper)
Set required server secrets in Secret Manager via the Firebase CLI (never put secrets in `VITE_*` variables):
```bash
firebase functions:secrets:set PHONE_HASH_PEPPER
firebase functions:secrets:set TURN_SHARED_SECRET
firebase functions:secrets:set TURN_URLS
```
Supported TURN providers:
- **Self-hosted coturn**: Configure `use-auth-secret` and `static-auth-secret` in `coturn`, then store the shared secret in `TURN_SHARED_SECRET` and `turns:<host>:5349` in `TURN_URLS` so `getIceServers` mints short-lived (1-hour) HMAC-SHA1 TURN credentials.
- **Managed TURN** (e.g., Cloudflare Calls / Twilio NTS / Metered): Adapt `getIceServers` or provide static/ephemeral credentials via Secret Manager.

## 8. Firebase Hosting & Deployment
Deploy rules, indexes, functions, and hosting in order using the exact commands in `docs/DEPLOYMENT.md`.
