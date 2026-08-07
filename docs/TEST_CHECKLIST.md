# Test checklist

- [ ] Sign-in succeeds; no public sign-up control exists.
- [ ] RLS test confirms another user cannot read or modify the private user's rows.
- [ ] All eight tabs open on Windows desktop, Windows laptop, and Android.
- [ ] Dark/light mode, privacy mode, and mobile bottom navigation remain correct.
- [ ] Android layout uses the full viewport and respects the safe-area inset.
- [ ] Editing an Android balance appears on PC/laptop without refresh.
- [ ] A new transaction updates Cashflow, Accumulation, Expenses, Prospect, and Insights.
- [ ] Client payment/status updates outstanding income and Prospect; Freeze stays excluded.
- [ ] Fractional US quantities remain exact.
- [ ] Stock price refresh updates portfolio/Prospect without changing Base/Optimistic targets.
- [ ] Twelve Data denial leaves the previous/manual IDX price visible with the plan warning.
- [ ] Electricity readings update interval, daily usage, and cost at Rp1,740/kWh.
- [ ] Saving, saved, offline, unsynced, error, and last-synced states appear correctly.
- [ ] Offline changes remain visible, queue locally, and sync after reconnecting.
- [ ] Simultaneous edits trigger conflict protection rather than silent overwrite.
- [ ] JSON export downloads; import restores the same records.
- [ ] PWA installs on Android and its offline shell opens without caching private API responses.
- [ ] `npm run build` and `npm run check` pass.
