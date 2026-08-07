# CVFinance v7.6.0 — Auditable Projection and Stock Cash

Run `supabase/migrations/011_stock_cash_wallet.sql` before deploying v7.6.0. The migration only adds two non-negative optional fields to each user's existing settings row; it does not delete or rewrite financial records.

## Projection equation

Every year card now uses the same visible equation:

`Opening Cash + Stocks + Income − This-month/Recurring/Yearly/Events/Credit expenses = Projected Net Worth`

The opening cash for a future year is the prior year's closing cash. Credit Card and PayLater entries are one-time obligations and appear only in their unpaid due year. Events and credit remain separate in the breakdown. Expense obligations use absolute values so a negative entry cannot cancel another bill.

## Portfolio cash

- Netcash is stored in IDR.
- Wallet is entered in USD and converted using the user's current USD/IDR setting.
- Both fields are optional and add to total stock-page assets and projections.
- Neither field changes holding P/L.

## Sorting and presentation

Pointer sorting now evaluates both row and column position in multi-column grids, while preserving vertical behavior for lists. Yearly expenses use blue for due and gray for completed. Ending clients use a flag marker, and Insight cards use higher-contrast gradients with white text.
