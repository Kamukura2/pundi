# CVFinance v7.3.0 — Finance Logic and Vibrant UI

## Required migration

Run `supabase/migrations/006_client_types_yearly_status.sql` once before deploying the v7.3.0 source. The migration is additive: old clients remain recurring and no finance records are deleted.

## Finance behavior

- Accumulation is current liquid balances plus current portfolio value.
- Planned budgets, future credit due dates, yearly costs, and Events do not reduce Accumulation.
- Active recurring clients are the only client income source used by Prospect.
- Ending clients use paid/unpaid final-payment tracking and never repeat in future years.
- Frozen clients stay visible and remain excluded from recurring income.
- An Event reduces only the matching year in Prospect; editing or deleting it recalculates that year immediately.
- A yearly expense marked `DONE THIS YEAR` stays visible, is not charged twice in the active-year projection, and automatically becomes due in the next calendar year.
- The sidebar's `Projected <current year>` value is the current net worth and its year label changes automatically.

## UI behavior

- Theme-specific light and dark surfaces prevent dark panels from leaking into light mode.
- Highlight and metric cards use stronger, theme-aware gradients.
- Clients are grouped into Recurring, Ending, and Frozen lanes.
- Expenses uses vibrant Monthly Budget, Yearly Expense, and Events section tabs.
- Credit Card, GoPayLater, and ShopeePayLater use separate inline SVG icons; all credit entries can be edited.
- Electricity panels use a light outline/fill treatment and more separation before the reading log.
- Mobile navigation contains seven persistent icon-only controls, including Clients and Electricity.
- Mobile holdings hide redundant auto-provider fields and emphasize quantity, prices, value, and profit/loss.

## Verification

- `npm run check`
- `npm run build`
- Page-level horizontal overflow checked at 360, 412, 768, and 1440 px.
- Light-mode Clients, Electricity, Expenses, Stocks, and Prospect visually rendered at each width.

