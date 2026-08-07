# CVFinance v7.4.0 — Projection, Workflow, and Insights

Run `supabase/migrations/007_projection_budget_sort_language.sql` once before deploying this source. It is additive and preserves existing finance rows. Existing frozen clients are converted to pending recurring clients because the UI now has only Recurring and Ending sections.

## Projection rules

- Current month closing cash = liquid balance + unpaid recurring/ending receivables + additional History income − remaining monthly budgets − yearly due/overdue − events due − credit due/overdue.
- History expenses are tracking records. They can reduce an Auto budget's remaining amount but are never deducted as a second expense.
- Later months use recurring client income, full monthly budgets, and date-matched yearly/events/credit items.
- Ending clients never become future recurring income.
- Each future year carries forward the prior year's closing cash and adds the selected stock scenario as assets.

## Workflow changes

- Monthly budgets support Auto from History, Partial, and Done this month.
- Yearly expenses automatically place unpaid items first and support drag ordering.
- Client cards support drag/touch movement between Recurring and Ending.
- Credit Card and PayLater appear only inside Events.
- Expense yearly recap is an indicator: recurring × 12 + yearly + events/credit.

## UI changes

- Pure black OLED background in dark mode.
- Stronger vibrant state colors, gray pending clients, and green paid clients.
- Signed Prospect and stock P/L values use red/green semantics.
- US/ID toggle persists in Supabase settings.
- Six generated transparent 3D illustrations drive data-dependent Insight cards.
