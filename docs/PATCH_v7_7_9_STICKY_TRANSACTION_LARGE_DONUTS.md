# CVFinance v7.7.9 — sticky transaction entry and larger donuts

This patch requires no Supabase migration.

## Client card copy

- A fully paid recurring or ending client displays `PAID`.
- An unpaid or partially paid client displays only the formatted outstanding nominal.
- The amount calculation, monthly reset, ending-client state, and receivable totals are unchanged.

## Faster batch transaction entry

- Description is positioned above Amount.
- After a transaction is saved, the next Add Transaction form reuses its type, description, amount, category, channel, and date.
- The template is derived from the newest synchronized transaction record, so it survives closing the modal, refreshing the app, or using the cloud dataset again.
- Editing an older transaction does not falsely make it the newest batch template.

## History charts

- Expense Categories and Expense Channels donuts scale up to 340 px on desktop.
- Responsive sizes remain contained on tablet and mobile.
- Nominal and percentage legends remain unchanged.

History remains ledger-only. No transaction is added to Balance, Cash, Net Worth, or Prospect calculations.
