# Patch v8.0.3 — Wallet Sync Compatibility Fix

## Root cause

Wallet edits triggered a normal global save. The same save also included the v8.0.1 dividend audit fields. Supabase projects that had not run migration `014_dividend_credit_reversal.sql` rejected the entire payload and displayed `Sync error`.

## Fix

- Detects the missing dividend audit columns from Supabase's schema-cache response.
- Retries the dividend operation using the compatible v8.0.0 columns only.
- Continues saving Investment and Trading wallet edits normally.
- Shows `Saved · setup needed` instead of a false wallet `Sync error`.
- Keeps the full auditable credit/reversal fields whenever migration 014 is available.

## Recommended setup

Compatibility mode prevents blocked saves, but migration `014_dividend_credit_reversal.sql` should still be run once for the strongest dividend credit audit trail.
