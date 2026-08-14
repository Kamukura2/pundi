# CVFinance v7.7.8 — monthly History and expense mix

This patch requires no Supabase migration. Existing transaction dates provide the monthly boundary and archive identity.

## Current-month workspace

- The three Recorded Income, Recorded Expense, and Recorded Net cards are replaced by one `Total Expense This Month` headline.
- The headline, category donut, channel donut, Budget Pace, and active transaction area only read transactions whose date belongs to the current calendar month.
- On the first day of a new month the active view therefore starts at zero automatically.
- No scheduled deletion or destructive reset is used.

## Permanent archive

- Transactions outside the active month are grouped into collapsed month/year archive cards.
- Archive data remains editable, searchable, filterable, and deletable only through the existing explicit delete action.
- Every month remains stored in the same authoritative transaction table.

## Expense charts

- Expense Categories groups the active month's expense rows by category.
- Expense Channels groups the same rows by channel/platform, including GoFood, GrabFood, Offline, Shopee, Transfer, Tokopedia, and custom channel tags.
- Each chart legend displays its nominal IDR value and percentage of the active month's total expense.

## Financial isolation

History remains a ledger-only record. Its entries are explicitly excluded from Balance, Cash, Net Worth, the monthly timeline, and Prospect projection calls. No financial formula or target-price persistence behavior changes in this patch.
