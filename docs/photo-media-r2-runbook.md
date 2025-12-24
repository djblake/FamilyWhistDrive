# Photo & Scan Uploads (Cloudflare Pages + R2) — Checklist Runbook

This document is the **single source of truth** for setting up and operating photo uploads for the Ruston Family Whist Drive site, and tracking progress. As work is completed, checkboxes are ticked so you can see exactly what remains.

## Quick facts

- **Site**: `https://rustonwhistdrive.pages.dev`
- **Hosting**: Cloudflare Pages (with Pages Functions)
- **Media storage**: Cloudflare R2 (public read; authenticated upload)
- **Cover picks**: up to **3** per year/tournament

## Cost model (for decision-makers)

- **Cloudflare Pages**: unlimited bandwidth for static assets on the free tier.
- **Cloudflare R2**:
  - **No egress fees** (no per-GB bandwidth charges).
  - Free tier includes **10GB storage** and generous request quotas:
    - **1M Class A ops** (writes/list operations)
    - **10M Class B ops** (reads)

## Status checklist (keep this updated)

### Repo implementation (code)

- [x] Add media API endpoints under `functions/api/media/`
  - [x] `GET /api/media/config` (`functions/api/media/config.js`)
  - [x] `GET /api/media/list` (`functions/api/media/list.js`)
  - [x] `GET /api/media/meta` (`functions/api/media/meta.js`)
  - [x] `POST /api/media/upload` (`functions/api/media/upload.js`)
  - [x] `POST /api/media/tournament-meta` (`functions/api/media/tournament-meta.js`)
- [x] Add uploader auth helper `requireUploader()` and env var `WHIST_UPLOAD_TOKEN` support (`functions/_lib/auth.js`)
- [x] Add frontend media helper library (`assets/js/media.js`) exposing `window.WhistMedia`
- [x] Include `assets/js/media.js` on:
  - [x] `tournaments/index.html`
  - [x] `tournaments/results.html`
  - [x] `tournaments/scorecard.html`

### Cloudflare configuration (prod)

- [ ] Create R2 bucket (recommended name: `whist-media`)
- [ ] Enable public reads (either public R2 URL or custom domain)
- [ ] Cloudflare Pages Functions binding:
  - [ ] R2 binding `WHIST_MEDIA` → your bucket
- [ ] Cloudflare Pages environment variables:
  - [ ] `WHIST_MEDIA_PUBLIC_BASE_URL` (public base URL that serves `/<key>`)
  - [ ] `WHIST_UPLOAD_TOKEN` (secret; Bearer token for uploads + cover pick updates)
  - [ ] `WHIST_ADMIN_PASSWORD` (secret; gates `/admin/*` pages)
  - [ ] `WHIST_FAMILY_PASSWORD` (secret; used by public upload pages to create a short-lived signed cookie)

### UI wiring (site features)

- [ ] Tournament cover picks:
  - [ ] `tournaments/results.html?year=YYYY`: display 1–3 cover images at top (strip/carousel)
  - [ ] `tournaments/index.html`: display cover thumbnail on each tournament item
- [ ] Scorecard scan verification:
  - [ ] `tournaments/scorecard.html`: add “View original scan” link per row (year/round/table)
  - [ ] Hide/disable gracefully when scan is missing
- [ ] Admin upload UI:
  - [x] Create `admin/media-upload.html`
  - [x] Prompt for upload token (store locally for session only)
  - [x] Bulk upload player scorecards by filename `YYYY_Key.jpeg` (shared hands join Keys with `_`)
  - [x] Support recursive folder selection for scorecards (select the whole `Scorecards/` folder)
  - [x] Upload tournament photos (multi-file) with **uploader name**
  - [x] After upload, set **3 cover picks** (ordered 1–3)
  - [x] Upload scorecard scans (year/round/table)
  - [x] Upload avatars (player select + crop/zoom; saves as `avatars/{playerId}.jpg`)

### Admin password gate

- [x] Protect `/admin/*` behind a password using Pages Functions middleware (`functions/_middleware.js`)
- [x] Add login endpoint (`functions/admin/login.js`) that sets a 24h signed cookie
- [x] Add visible “Media uploads” link in footer (requires password to access)

## R2 object layout (key conventions)

### Scorecard scans

One scan per table per round:

`scorecards/{year}/r{round}/t{table}.jpg`

Examples:
- `scorecards/2025/r1/t1.jpg`
- `scorecards/1997/r16/t5.jpg`

### Tournament photos (grouped by uploader)

This site has **one tournament per year**, so year uniquely identifies a tournament.

`tournament-photos/{year}/{uploaderSlug}/{timestamp}_{filename}`

Examples:
- `tournament-photos/2025/sarah/1734800000000_IMG_1234.jpg`
- `tournament-photos/2025/tom/1734800100000_podium.webp`

### Tournament photo metadata (cover picks + uploader info)

Per year:

`tournament-photos/{year}/_meta.json`

Shape (schema v1):

```json
{
  "schema": 1,
  "year": 2025,
  "photos": [
    {
      "key": "tournament-photos/2025/sarah/1734800000000_IMG_1234.jpg",
      "uploaderName": "Sarah",
      "uploaderSlug": "sarah",
      "uploadedAt": "2025-12-25T10:00:00.000Z",
      "originalName": "IMG_1234.jpg",
      "coverRank": 0
    }
  ],
  "coverPicks": [
    "tournament-photos/2025/tom/1734800100000_podium.webp",
    "tournament-photos/2025/sarah/1734800000000_IMG_1234.jpg",
    "tournament-photos/2025/sarah/1734800200000_group.jpg"
  ],
  "updatedAt": "2025-12-25T10:05:00.000Z"
}
```

Notes:
- `coverPicks` must be a list of **existing uploaded keys**.
- Up to **3** keys are kept; extra keys are ignored.
- `coverRank` is derived from `coverPicks` (1–3), otherwise `0`.

### Player avatars

`avatars/{playerId}.jpg`

Example:
- `avatars/paul_ruston.jpg`

Important: current server code expects an image upload and **stores it as** `avatars/{playerId}.jpg`. For best results today, upload a **JPG** avatar.

### Player scorecards (one per player per year)

Bulk-import-friendly storage:

`player-scorecards/{year}/{year}_{playerKey}.jpg`

The upload endpoint supports parsing the original filename format:

- `YYYY_Key.jpeg`
- Shared hands: `YYYY_Key1_Key2.jpeg`

Example:
- Local file: `1993_David_SteveBlake.jpeg`
- Stored key: `player-scorecards/1993/1993_David_SteveBlake.jpg`

#### Bulk upload from a year-folder structure

If you have a folder like:

```
Scorecards/
  1993/
    1993_David_SteveBlake.jpeg
  1994/
    1994_SteveBlake.jpeg
  ...
```

Open:

- `admin/media-upload.html`

Then use the **folder picker** (“select the whole Scorecards/ folder”). It uploads **recursively**. The subfolder names don’t matter because the uploader parses the **filename**.

## Cloudflare setup (dashboard steps)

### 1) Create the R2 bucket

In Cloudflare dashboard:
- R2 → Create bucket
- Name suggestion: `whist-media`

### 2) Enable public reads (two options)

You need a stable public base URL for images.

Option A (simplest):
- R2 → your bucket → Settings → **Public access** → enable public access.
- Use the bucket’s **public URL** (often `https://<something>.r2.dev`).

Option B (recommended long-term):
- R2 → your bucket → Custom Domains → add `media.rustonwhistdrive.pages.dev` (or any custom domain you control).

### 3) Bind R2 to Cloudflare Pages Functions

Cloudflare Pages → your project → Settings → Functions → Bindings:
- **R2 bucket binding**:
  - Variable name: `WHIST_MEDIA`
  - Bucket: `whist-media` (or your bucket name)

### 4) Configure environment variables / secrets

Cloudflare Pages → your project → Settings → Environment variables:

- `WHIST_MEDIA_PUBLIC_BASE_URL`
  - Example: `https://pub-xxxx.r2.dev` or `https://media.rustonwhistdrive.pages.dev`
  - This must be the base used to serve `/<key>` paths publicly.

- `WHIST_UPLOAD_TOKEN` (secret)
  - A random long token. Store in a password manager.
  - Anyone who has this token can upload and change cover picks.

Admin gate (protects `/admin/*` pages):

- `WHIST_ADMIN_PASSWORD` (secret)
  - Password used for the admin login screen.
  - Do not commit this value to the repo; set it only in Cloudflare.

Existing (already used for cache refresh):
- `WHIST_ADMIN_TOKEN` (secret)

### 5) Deploy

Push to `main` (or your configured branch). Cloudflare Pages builds/deploys automatically.

## Operations (how to upload + manage covers)

### A) Upload tournament-day photos (one photo)

Upload endpoint:
- `POST https://rustonwhistdrive.pages.dev/api/media/upload`

Required headers:
- `Authorization: Bearer <WHIST_UPLOAD_TOKEN>`

Form fields:
- `kind`: `tournament-photo`
- `year`: `2025`
- `uploaderName`: `Sarah`
- `file`: (binary)

Example (curl):

```bash
curl -sS -X POST "https://rustonwhistdrive.pages.dev/api/media/upload" \
  -H "Authorization: Bearer $WHIST_UPLOAD_TOKEN" \
  -F "kind=tournament-photo" \
  -F "year=2025" \
  -F "uploaderName=Sarah" \
  -F "file=@/path/to/IMG_1234.jpg"
```

The response returns `{ key, url }`.

### B) Upload scorecard scans

Fields:
- `kind`: `scorecard`
- `year`: `1997`
- `round`: `1`
- `table`: `3`
- `file`: `t3.jpg`

Example:

```bash
curl -sS -X POST "https://rustonwhistdrive.pages.dev/api/media/upload" \
  -H "Authorization: Bearer $WHIST_UPLOAD_TOKEN" \
  -F "kind=scorecard" \
  -F "year=1997" \
  -F "round=1" \
  -F "table=3" \
  -F "file=@/path/to/1997_r1_t3.jpg"
```

### C) Upload player avatar

Fields:
- `kind`: `avatar`
- `playerId`: must be the canonical player ID used by the site (alphanumeric, `_` and `-` only).
- `file`: recommended JPG

Example:

```bash
curl -sS -X POST "https://rustonwhistdrive.pages.dev/api/media/upload" \
  -H "Authorization: Bearer $WHIST_UPLOAD_TOKEN" \
  -F "kind=avatar" \
  -F "playerId=paul_ruston" \
  -F "file=@/path/to/paul.jpg"
```

### D) View / inspect uploaded tournament photos

List all photos for a year:

```bash
curl -sS "https://rustonwhistdrive.pages.dev/api/media/list?prefix=tournament-photos/2025/" | jq .
```

Fetch the year metadata:

```bash
curl -sS "https://rustonwhistdrive.pages.dev/api/media/meta?year=2025" | jq .
```

### E) Set the 3 cover picks for a year

Step 1: Get candidate keys from meta/list.

Step 2: POST them to `tournament-meta`:

```bash
curl -sS -X POST "https://rustonwhistdrive.pages.dev/api/media/tournament-meta" \
  -H "Authorization: Bearer $WHIST_UPLOAD_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "year": "2025",
    "coverPicks": [
      "tournament-photos/2025/tom/1734800100000_podium.webp",
      "tournament-photos/2025/sarah/1734800000000_IMG_1234.jpg",
      "tournament-photos/2025/sarah/1734800200000_group.jpg"
    ]
  }'
```

The backend will:
- validate keys exist in that year’s meta
- store `coverPicks` (max 3)
- update each photo’s `coverRank` (1–3)

## Remaining product work (what to implement next)
The section above (“Status checklist”) is the authoritative remaining-work list.

## Troubleshooting

- If `GET /api/media/config` returns empty `publicBaseUrl`:
  - `WHIST_MEDIA_PUBLIC_BASE_URL` env var is missing.
- If uploads return 401:
  - Missing/incorrect `Authorization: Bearer <WHIST_UPLOAD_TOKEN>`.
- If uploads return 501:
  - R2 binding `WHIST_MEDIA` not configured on Cloudflare Pages project.
- If images don’t show but URLs work:
  - ensure pages are using `assets/js/media.js` and reading from `publicBaseUrl`.

## Security notes

- Views are public: anyone can fetch images if they have the URL (and cover images will be linked from the site).
- Upload is protected by `WHIST_UPLOAD_TOKEN`. Treat it like a password; rotate if it leaks.



