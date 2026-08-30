# Pundi Acquisition v1

`Pundi Acquisition v1: COMPLETE` — first-party, privacy-safe acquisition measurement for the Indonesian Growth Website.

## Scope and privacy

Only aggregate CTA intent and one source attribution per authenticated account are measured. No page-view identity, cookies for identity, fingerprinting, IP address, user agent, calculator values, transactions, balances, holdings, passwords, Auth tokens, or arbitrary referrer/UTM payloads are stored. Tracking failures never block navigation.

## Ref attribution

Marketing URLs accept `?ref=` with only these values: `google`, `reddit`, `facebook`, `linkedin`, `whatsapp`, `friend`, `community`, `organic`, `direct`, `other`. Values are trimmed/lowercased; unknown values normalize to `other`. The source is carried to `app.pundi.online/?ref=<source>` and kept in session storage only as signup context. Signup attribution is inserted once for the authenticated user and is immutable to ordinary client writes.

## Measurement

Public CTA clicks are sent to the same-origin `/api/acquisition` endpoint with only `event_type`, sanitized source, landing path, and CTA name. The endpoint accepts only `cta_click`, validates the CTA allowlist, and uses the server-only service client. The app calls the same endpoint after a session exists to persist the one-row attribution. The endpoint is best-effort; app navigation does not wait on it.

## Data model

Migration `021_acquisition.sql` adds `user_acquisition` (one row per user: `user_id`, source, landing path, timestamp) and `acquisition_events` (CTA events only). Both tables are Pundi-only, additive, RLS-enabled/forced, revoked from browser roles, and service-role managed. Users can select only their own attribution row; aggregate admin reads are server-authorized. No destructive migration is used.

## Admin and status

The secure `/admin` Acquisition panel shows CTA clicks for today/7/30 days, attributable signups, CTA-to-signup ratio where available, source breakdown, top landing pages, and top CTA/source combinations. It does not show finance data or anonymous identifiers.

Run:

```bash
npm run growth:status
```

The command writes ignored `runtime/growth/latest.json` and prints aggregate metrics only: version, production health, readiness, CTA clicks, attributable signups, source breakdown, top landing pages, beta users, feedback totals, and scheduler state. Synthetic smoke fixtures using `ref=other` must be excluded from real-growth interpretation and cleaned after testing.

## Free tool

`/kalkulator-net-worth` is an Indonesian net-worth calculator. It computes `total assets - liabilities` entirely in the browser. Inputs are not persisted, sent to `/api/acquisition`, or included in any event. Its CTA is measured like other public CTAs.

## Distribution copy

### Reddit / forum
> Aku sedang mengembangkan Pundi, ruang kerja untuk mencatat pengeluaran, budget, aset, investasi, dan aktivitas trading tanpa perlu menghubungkan rekening bank. Pundi masih beta, jadi aku sedang mencari masukan yang jujur. Ada kalkulator net worth sederhana juga: https://pundi.online/kalkulator-net-worth

### Facebook / community
> Kalau kamu sedang mencari cara yang lebih rapi untuk melihat pengeluaran dan aset, Pundi bisa dicoba sebagai ruang kerja keuangan pribadi. Masih tahap beta dan input tetap kamu kendalikan—tidak ada koneksi otomatis ke rekening bank. Mulai dari panduan budgeting: https://pundi.online/budgeting

### LinkedIn
> Saya sedang membangun Pundi, workspace web untuk membantu orang meninjau cash flow, budget, aset, dan aktivitas trading dalam satu tempat. Pundi masih beta dan sengaja tidak memosisikan diri sebagai bank atau penasihat keuangan. Detailnya: https://pundi.online/

### WhatsApp
> Lagi coba Pundi, workspace sederhana buat catat pengeluaran dan pantau aset. Masih beta, jadi feedback sangat membantu. Bisa lihat dulu di https://pundi.online/

### X
> Pundi beta: ruang kerja untuk mencatat pengeluaran, budget, aset, investasi, dan trading tanpa koneksi otomatis ke rekening bank. Lihat dulu: https://pundi.online/

Tidak ada posting otomatis. Pemilik memilih komunitas, menyesuaikan konteks, dan mengirim manual.

## Landing-page map

- general: `/`
- budgeting: `/budgeting`
- expense: `/pencatat-pengeluaran`
- assets: `/aset-investasi`
- net worth: `/kalkulator-net-worth`
- trading: `/trading-journal`

## Search Console

Sitemap siap disubmit manual oleh owner: `https://pundi.online/sitemap.xml`. Status: `OWNER ACTION / NON-BLOCKING`. Tidak ada Search Console API/OAuth automation pada milestone ini.

## First-week observation

Track real outcomes only: indexed pages, organic impressions/clicks from Search Console, external referral clicks, non-owner/non-smoke attributable signups, and real feedback. Do not create synthetic traffic or signups to reach thresholds. Future Search Console imports should use impressions, clicks, CTR, average position, query, and page after explicit owner authorization.
