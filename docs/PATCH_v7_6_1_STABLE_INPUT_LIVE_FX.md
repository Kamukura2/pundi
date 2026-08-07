# CVFinance v7.6.1 — Stable Target Inputs and Live USD/IDR

## Target price editing

- Base and Optimistic target-price fields keep their local draft while typing.
- Values commit on blur or Enter instead of re-rendering the whole app on every change.
- Whole-number values render without a trailing `.00`.
- Native number stepper arrows are hidden. Fractional share quantities remain supported.
- A completed background save no longer triggers a second full render that can steal focus.

## Dialog dismissal

- A dialog closes from a short, direct press on its backdrop.
- Text selection or mouse dragging that starts inside a field never closes the dialog, even when the pointer finishes over the backdrop.

## USD/IDR market rate

- The authenticated server route `/api/stocks/fx` retrieves the latest available USD/IDR quote.
- Finnhub is attempted first and Yahoo Finance USD/IDR is the provider fallback.
- The successful rate is saved in the existing per-user `app_settings.usd_idr` field.
- When both providers fail, CVFinance retains the last saved rate instead of zeroing or corrupting USD assets.
- Rates refresh after sign-in, every five minutes while the app is open, and whenever the Stocks refresh button is pressed.
- US holding value remains `shares × current USD price × USD/IDR`; USD Wallet remains `wallet USD × USD/IDR`.

No database migration is required for this patch.
