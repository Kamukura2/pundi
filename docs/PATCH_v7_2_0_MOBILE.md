# CVFinance v7.2.0 — Mobile and Tablet UI

This release adds an isolated responsive shell for screens up to 1024 px. Desktop layout and finance logic are unchanged.

## Included

- Responsive phone and tablet layout with no page-level horizontal overflow.
- Compact typography, cards, charts, and controls.
- 44–48 px touch targets for form controls and actions.
- Icon-only persistent bottom navigation with device safe-area support.
- Automatic scroll-to-top when switching sections on mobile.
- Mobile holdings cards; projection tables remain internally scrollable.
- Safe wrapping for currency values and long labels.
- Viewport-sized, internally scrollable forms and dialogs.
- Standalone PWA metadata for an app-like installed experience.
- Secondary mobile shortcuts for Expenses, Clients, Electricity, and Insights.
- Provider Symbol can now actually be left blank when adding a ticker, matching its label and automatic mapping behavior.

## Install on Android

Open the deployed CVFinance URL in Chrome, sign in, open Data & Sync from the DA button, and choose Install CVFinance when available. Chrome may also show Install app under its three-dot menu. The installed PWA opens without the browser address bar and continues to use the same Vercel and Supabase deployment.

## Breakpoints

- Above 1024 px: existing desktop UI.
- 681–1024 px: tablet UI.
- 391–680 px: phone UI.
- Up to 390 px: compact phone adjustments.

No database migration or new environment variable is required.
