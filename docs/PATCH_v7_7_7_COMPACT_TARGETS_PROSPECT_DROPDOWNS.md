# CVFinance v7.7.7 — compact targets and Prospect dropdowns

This patch is presentation-only and requires no Supabase migration.

## Client payment status

- Fully paid recurring and ending clients show `0 outstanding`.
- Unpaid or partially paid clients show the formatted remaining amount followed by `outstanding left`.
- The existing paid amount, monthly reset, lifecycle, sorting, and receivable calculations are unchanged.

## Target Prices

- Base and Optimistic retain separate values and Manual/Auto modes.
- Each stock keeps its Ticker and Current reference cards.
- Future years are displayed as two year-target cards per row, with the year on the first line and its input on the second.
- Inputs still save on blur or Enter and preserve the existing no-rerender-while-typing behavior.

## Future Cash + Assets

- Each year is a native expandable detail card and starts collapsed.
- The year, ages, projected total, and visible equation remain available in the summary.
- Clicking the card reveals the exact same Opening Cash, Stocks, Income, and Expenses breakdown.

No History entry is introduced into Balance, Net Worth, Cash, or Prospect. All ledger-only and auditable projection invariants remain intact.
