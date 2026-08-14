# CVFinance v7.9.1 — Mobile Scroll Recovery

## Purpose

Restore reliable native vertical scrolling on mobile and tablet after the v7.9.0 Trading responsive patch.

## Fix

- Returns vertical scrolling ownership to the root document.
- Removes restrictive root overscroll and touch containment.
- Explicitly allows vertical pan gestures across Trading cards and panels.
- Prevents background and realtime renders from calling `scrollTo` on screens up to 1024 px.
- Keeps scroll-to-top only when the user intentionally changes tabs.
- Leaves Sell, Reset All, Trading P/L, Investment, and all other financial behavior unchanged.

No Supabase migration or environment-variable update is required.
