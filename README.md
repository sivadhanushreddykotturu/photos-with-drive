# PhotoDrive

**Your photos from every Google Drive — one calm, beautiful library.**

PhotoDrive is a self-hostable photo & video cloud that pools **multiple Google Drive accounts** into a single library. Photos live in *your* Drives; the app keeps only metadata in MongoDB. It ships as a fast **web app**, an installable **PWA** (iOS), and a native-feel **Android APK** — all talking to one tiny Express API.

![photo](https://img.shields.io/badge/photos-%2B-blue) ![license](https://img.shields.io/badge/license-AGPL--3.0-green) ![version](https://img.shields.io/badge/version-1.0.0-orange)

---

## How it works

```
                        ┌──────────────────────────────────────────────┐
                        │                 CLIENTS                       │
                        │  Web (Vercel) · PWA (iOS) · Android APK      │
                        └───────────────┬──────────────────────────────┘
                                        │  JWT (access + refresh)
                                        ▼
┌─────────────────┐        ┌────────────────────────────┐        ┌──────────────────┐
│  MongoDB Atlas  │◄───────│      Express API (Node)    │───────►│  Google Drive ×N │
│  metadata only  │        │  auth · files · albums ·   │  OAuth │  your accounts,  │
│  (~0.5 KB/photo)│        │  trash · shares · zip      │ tokens │  photos stay here│
└─────────────────┘        │  encrypted at rest         │        └──────────────────┘
                           └────────────┬───────────────┘
                                        ▼
                                  Brevo (email)
                           OTP codes, login alerts,
                            password resets
```

**The core trick:** uploads are *streamed* through the API straight into Google Drive (never buffered), and the API always picks the connected Drive account with the most free space. One file needs one account with room — pooling works *across* files, so a library can be bigger than any single Drive.

---

## Features

**Library** — timeline grid with justified layout, pinch zoom (2–5 columns), pull-to-refresh, instant cached thumbnails (30-day cache), video poster frames + durations, swipe-through viewer with rename/download/delete.

**Multi-Drive** — connect unlimited Google accounts (OAuth), live quota bars, upload auto-routes to the roomiest account, fresh quota checked at every upload.

**Organize** — albums (upload into, covers, zip-download whole album), favorites, trash with restore & delete-forever, nested-ready file records.

**Sharing** — public links with expiry (1 day / 7 days / 30 days / never), gallery viewer for recipients, one-click revoke, album sharing.

**Auth & security** — email+password (bcrypt), **email OTP login**, **email verification at registration**, code-based password reset, new-login alert emails with **one-click sign-out-everywhere** (instant token revocation via token versioning).

**Mobile (Android APK)** — everything above plus: upload cancellation (per-file + cancel-all), Android back-button navigation, app icon + splash, and **over-the-air update prompts** from GitHub releases.

---

## Repository layout

```
├── backend/      Express + TypeScript + Mongoose API (the only server)
├── frontend/     SvelteKit SPA (web + PWA) with Capacitor wrapper
│   └── android/  the Android project (Gradle) for the APK
└── i18n/         translations (en.json, extendable)
```

**Stack:** Express 5 · Mongoose · JWT · Zod · bcryptjs · googleapis · Brevo · SvelteKit 5 · Tailwind 4 · Capacitor 7

---

## Setup

### 1. Prerequisites

- **Node.js 20+** and **MongoDB** (local or a free [Atlas](https://cloud.mongodb.com) cluster)
- **Google Cloud project** with the **Drive API enabled** and an **OAuth client (Web application)**
- Optional: **Brevo API key** for emails (free tier) — without it, emails log to the server console in dev

### 2. Google OAuth (one time)

1. Google Cloud Console → enable **Google Drive API**
2. OAuth consent screen → External → **Publish to Production** (testing mode kills refresh tokens in 7 days)
3. Credentials → OAuth client ID → **Web application**
4. Authorized redirect URI: `https://<your-backend-host>/connected-accounts/google/callback`

### 3. Backend

```bash
cd backend
cp .env.example .env    # fill in the values below
npm install
npm run dev             # or: npm run build && node dist/server.js
```

| Variable | What |
|---|---|
| `MONGODB_URI` | Atlas or local Mongo connection string |
| `FRONTEND_URL` | origin of the web app (CORS + share links) |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | 32+ char random strings |
| `ENCRYPTION_KEY` | 32+ char random string (encrypts Drive tokens at rest) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | from step 2 |
| `GOOGLE_REDIRECT_URI` | `https://<backend-host>/connected-accounts/google/callback` |
| `BREVO_API_KEY` / `EMAIL_FROM` | transactional email (OTP, alerts) |
| `MAX_UPLOAD_BYTES` | per-file cap (default 300 MB) |

On PaaS (Render etc.) the port comes from `PORT` automatically.

### 4. Frontend (web + PWA)

```bash
cd frontend
npm install --legacy-peer-deps
PUBLIC_API_URL=http://localhost:4000 npm run dev
```

Production: set `PUBLIC_API_URL` to the backend URL and deploy `frontend/` as a static site (a `vercel.json` with SPA rewrites is included). iOS users then install via **Safari → Share → Add to Home Screen**.

### 5. Android APK

Prereqs: **JDK 21** + **Android SDK** (platform-tools, build-tools).

```bash
cd frontend
PUBLIC_API_URL=https://<your-backend> npm run build
npx cap sync android
cd android && ./gradlew assembleDebug
# APK: android/app/build/outputs/apk/debug/app-debug.apk
```

---

## Releases & over-the-air updates

The Android app checks the **latest GitHub release** on launch. When a newer tag exists, it shows the release notes and a **Download update** button (installs over the old app — data and logins persist).

**To ship an update:**

```bash
# 1. bump version in frontend/package.json and android/app/build.gradle (versionName)
# 2. rebuild the APK (steps above)
# 3. create a GitHub release, tag vX.Y.Z, attach app-debug.apk
```

Web/PWA users always get the latest on refresh — no action needed there.

---

## License

AGPL-3.0. The frontend is derived from [Immich](https://immich.app) (AGPL) — substantial parts of the timeline engine and UI are reused and rewired to this custom backend.
