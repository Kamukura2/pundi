# CVFinance v7.7.2

- Replaced fragile Google Finance HTML scraping with Yahoo Finance JSON for `IDR=X`.
- Manual refresh bypasses the five-minute server cache; the app continues automatic refresh every five minutes.
- The server rejects FX quotes outside IDR 10,000–25,000 per USD. The client also rejects a sudden move above 15% from a valid stored rate.
- Yahoo `query1` and `query2` hosts are tried in order. If both fail, the last valid/manual rate is retained.
- Yearly Expense cards due in the current month use the same luminous-blue urgency treatment as current-month Events.
- The Expense Perusahaan dashboard is taller with a larger chart and KPIs.
- The Clients Fixed Monthly card is slightly brighter.
- Transaction Budget and Channel values render as separate rounded chips. Clicking a chip filters the ledger by that exact tag; clicking the active chip again clears the filter.
- No Supabase migration is required.
