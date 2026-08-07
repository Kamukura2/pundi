# CVFinance v7.5.1 — Entrusted Funds and Budget Tags

## Entrusted Funds

- Use this section for money held on behalf of another person. It is a liability, not an expense.
- Choose `Cash Balance` to reduce liquid assets or `Stocks` to reduce stock assets.
- An active entry reduces net worth and every projection exactly once. It does not enter Monthly Budget, Estimated Expense, Events expense, or History.
- Mark an entry `Settled` to stop the deduction while retaining the record. Entries can also be edited, deleted, and reordered directly.

## Monthly Budget tags

- Expense tags in the History transaction editor are generated from current Monthly Budget categories.
- A History expense fills the meter whose category tag matches exactly.
- Adding or renaming a Monthly Budget automatically changes the available tags for future History entries.
- History expenses remain records and budget-progress inputs only; they are not deducted a second time in Prospect.

## Event urgency colors

- Current month: luminous coral/orange.
- Another month in the current year: dark orange.
- Another year: gray.

## Required migration

Run `supabase/migrations/009_entrusted_funds.sql` before deploying v7.5.1. It creates an additive, RLS-protected `entrusted_funds` table and does not modify or delete existing financial records.
