# CVFinance v7.5.0 — Remaining Year, Sorting, and Archives

## Finance rules

- Current-month expense transactions in History only update monthly budget progress; they are not deducted independently from Prospect.
- Current-month additional income in History is added to projected cash.
- Current-year recurring expense equals the current month's remaining budget plus the default monthly budget for every full month after it through December.
- Current-year recurring client income equals current receivables plus the fixed recurring income for every full month after the current month through December.
- Yearly expenses, Events, and unpaid credit are included only when their due month and year are reached. Overdue unpaid yearly and credit items are collected into the current month.
- Recurring client payment state resets automatically when the calendar month changes. Ending-client completion remains persistent.

## Workflow and UI

- Drag the body of a yearly, Event, credit, paid-credit archive, or client card to sort it. On touchscreens, hold briefly before moving. Buttons remain clickable.
- Event cards are terracotta for the current month, orange for another month in the current year, and gray for another year.
- Yearly and Event cards show the due year and highlighted month together.
- History groups transactions automatically by month and year and provides edit and delete actions.
- Every SVG chart exposes exact values on hover, keyboard focus, click, and touch.
- Prospect shows current-year and 2036 values in the primary hero and includes remaining income in each year card.

## Required migration

Run `supabase/migrations/008_event_credit_sort_order.sql` before deploying the source. It adds ordering metadata for Events and credit plus a month marker for recurring-client payment state. The migration is additive and does not delete financial records.
