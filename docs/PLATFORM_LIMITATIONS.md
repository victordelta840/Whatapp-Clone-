# Web & PWA Platform Limitations

Converse discloses all browser and operating-system constraints transparently in both documentation and inside the app under **Settings -> Platform notes**:

| Capability | Web / PWA Reality |
|---|---|
| iOS background push notifications | Requires the PWA to be installed via **Share -> Add to Home Screen** on iOS 16.4+ |
| Full-screen incoming call wakeup | Closed web tabs receive standard push notifications; full-screen ringing occurs only when the app is open |
| Automatic background address book sync | Browsers do not allow silent address-book reads; contact discovery is strictly opt-in via Contact Picker API or `.vcf`/`.csv` upload |
| Audio output selection (`setSinkId`) | Supported on desktop Chrome/Edge; unavailable on iOS Safari |
| Service Worker offline upload queue | Best-effort; Safari lacks Background Sync API and flushes queued messages/uploads when the app reopens |
| End-to-end encryption (E2EE) | Explicitly out of scope; data is encrypted in transit (TLS) and at rest by Google Cloud / Firebase |
| Multi-party group audio/video calling | Explicitly out of scope (requires an SFU media server); 1:1 WebRTC calls are supported |
