# Patch: Stock Hub Consolidation & Investment Dividend Ledger

CVFinance v8.0.0 combines the former Investment and Trading navigation items into one **Stocks** page. Use the switch at the top of Stocks to open either workspace. Existing Investment holdings/targets and the isolated Trading portfolio/ledger are not merged and their formulas are unchanged.

## Included changes

- One sidebar/mobile destination: **Stocks**.
- In-page **Investment / Trading** switch, remembered on the device.
- Matching Netcash & USD Wallet card layout and Add/Withdraw dialogs in both workspaces.
- A separate, dynamic Dividend Income section under Stocks → Investment.
- No Investment ticker means no dividend rows.
- Confirmed dividend discovery through official records plus configured market-data providers.
- Per-event announcement, ex-dividend, record and payment dates; dividend/share; eligible shares; gross amount; source and status.
- Future confirmed events enter Prospect only in their payment month/year.
- At the record date, eligible shares are locked and the amount becomes an Investment receivable.
- At the payment date, the receivable is credited once to the matching Investment IDR Netcash or USD Wallet.
- Events discovered after their record date require one eligibility review, preventing the app from assuming shares were owned historically.
- Investment dividends never enter or alter the Trading ledger, Trading P/L, Trading wallet, or SPY comparison.

## Required deployment order

1. In Supabase SQL Editor, run `supabase/migrations/013_investment_dividends.sql`.
2. Confirm the table `public.investment_dividends` exists and Row Level Security is enabled.
3. Upload/commit the v8.0.0 patch files to GitHub.
4. Let Vercel redeploy, then hard-refresh or fully close/reopen the installed PWA once so the v8.0.0 service-worker cache activates.

Running the application files before migration 013 will make synchronization report a missing-table setup error. Migration 013 is additive: it does not delete or rewrite Investment, Trading, History, or any other existing data.

## Provider behavior

- The existing `TWELVE_DATA_API_KEY` is reused; no new client-side secret is added.
- Official issuer records are preferred when available. The initial verified issuer override covers Bank Mandiri's confirmed 2026 interim and final distributions.
- Provider results are numbers and corporate-action dates only; article text is not stored.
- A provider failure retains the last synchronized dividend data.
- The weekday Vercel cron checks quotes and newly confirmed dividend events. Opening Stocks → Investment also performs a quota-aware daily check.

## Bank Mandiri 2026 verified schedule

- Interim: IDR 100/share, paid 14 January 2026.
- Final: IDR 376.956938949/share, paid 25 May 2026.
- Total: IDR 476.956938949/share.

Because these record dates are already past, a newly added BMRI holding shows an eligibility review before wallet credit. This avoids crediting a historical dividend to shares bought after the record date.

## Rollback

Rolling the frontend back to v7.9.6 leaves the additive dividend table unused. Do not drop the table when preserving dividend records. Investment and Trading data remain in their existing tables throughout.
