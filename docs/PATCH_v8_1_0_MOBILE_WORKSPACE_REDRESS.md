# CVFinance v8.1.0 — Mobile Workspace Redesign

## Purpose

- Rebuild phone and tablet layouts with compact cards, readable typography, stable vertical scrolling, and no horizontal financial-value overflow.
- Replace the mobile floating navigation with nine ordered actions using the same colored icons as the desktop sidebar.
- Rename the top-level Clients destination to Income and add a Clients subcategory switcher.
- Match History filter styling to the Stocks workspace tabs without changing filtering behavior.
- Add Available Balance above the desktop sidebar projections.
- Add reversible per-record deletion to Trading Ledger and rename dividend review action to `✓ Confirm`.

## GitHub upload

Upload the files in this patch archive at the repository root and allow GitHub to replace files with matching names. The archive contains fewer than 100 files.

No Supabase migration or new environment variable is required for v8.1.0.

## Verification

Run:

```bash
npm run check
npm run build
```

After deployment, refresh the installed PWA once so service worker cache `v8.1.0-mobile-workspace-redesign` becomes active.
