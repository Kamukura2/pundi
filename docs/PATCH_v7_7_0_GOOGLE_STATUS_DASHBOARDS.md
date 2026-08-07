# CVFinance v7.7.0 — Google-only FX and richer dashboards

- USD/IDR is fetched only from Google Finance. The server tries Google Finance beta and standard routes in Indonesian and English locales, parses both decimal conventions, and never substitutes Yahoo or Finnhub.
- Manual USD/IDR refresh bypasses the API cache. A failed Google refresh keeps the last saved rate and labels it `GOOGLE UNAVAILABLE`.
- Recurring client cards use bright blue for outstanding and dark blue for paid. Ending clients use distinct unpaid and paid gray states.
- Client summary includes Fixed Yearly, calculated as Fixed Monthly × 12 for the full year.
- Yearly expense cards use the same blue/gray status language as Events.
- Expense Perusahaan is a permanent History tag and indicator dashboard. It does not create a budget and does not affect Balance or Prospect.
- Insights include a momentum note and year-by-year momentum bars; story cards are approximately 20% brighter.
- Stock sections have increased vertical spacing.

No Supabase migration is required.
