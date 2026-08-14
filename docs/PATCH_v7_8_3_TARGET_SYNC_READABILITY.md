# CVFinance v7.8.3 — Trading Target Sync Stability & Readability

## Purpose

Fix Target Price values that briefly appeared and then reverted when a Trading API refresh and Supabase save happened at nearly the same time.

## Changes

- Target Price updates local state continuously while the input is being edited.
- Automatic quote refresh never replaces an active form editor.
- Realtime cloud reloads wait until every queued local save is finished.
- A transient Supabase optimistic-lock conflict reloads cloud metadata and retries the unchanged local snapshot once.
- A failed save no longer overwrites the user's local Target Price with an older cloud value.
- Automatic Trading quote refresh saves quietly without repeatedly flashing the global Saving indicator.
- Target Price Simulation headings, ticker details, labels, input value, projected P/L, and projected value use larger type.

## Deployment

No Supabase migration and no environment-variable change are required. Replace the repository files, redeploy, then hard-refresh the installed app/browser once so service-worker cache v7.8.3 becomes active.
