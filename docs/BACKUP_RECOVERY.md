# Backup & Recovery Guide

## 1. Firestore Managed Exports & Point-in-Time Recovery (PITR)
- Enable Firestore Point-in-Time Recovery (PITR) in Google Cloud Console (`Firestore -> Backups & Recovery`) for production databases to allow recovery to any minute within the last 7 days.
- Schedule daily managed exports to a dedicated GCS bucket:
  ```bash
  gcloud firestore export gs://<YOUR_BACKUP_BUCKET>/firestore/$(date +%F) \
    --project=<PROJECT_ID> --database=ai-studio-a98db9ab-2051-4bc7-8254-906ad7ca81d5
  ```

## 2. Cloud Storage Versioning
- Enable Object Versioning on your Firebase Storage bucket (`gsutil versioning set on gs://<BUCKET>`), with a lifecycle rule deleting noncurrent versions after 30 days.

## 3. User-Initiated GDPR Data Export
- Users can export their profile, settings, contacts, notifications, and recent conversation metadata via **Settings -> Account & security -> Export my data (JSON)** (`exportMyData` Cloud Function -> `exports/{uid}/export_<ts>.json`, cleaned up after 24 hours).

## 4. Account Deletion
- **Settings -> Account & security -> Delete my account** triggers `deleteMyAccount` after re-authentication and `"DELETE MY ACCOUNT"` confirmation, removing Firestore account/contact/device docs, user Auth credentials, and exported/profile storage objects.
