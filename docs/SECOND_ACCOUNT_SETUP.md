# Add a Second CVFinance Account with Empty Data

1. Open Supabase Dashboard → Authentication → Users.
2. Choose Add user → Create new user.
3. Enter the friend's email and a unique temporary password. Enable automatic email confirmation only if Supabase asks whether the account should be confirmed immediately.
4. Do not run `seed_cvfinance_mvp` for this user and do not import the owner's JSON backup.
5. In CVFinance, sign out from the owner account and sign in with the friend's email and password.
6. The app loads an empty dataset. Add the friend's balances, budgets, clients, and holdings from inside that account.
7. Sign out and return to the owner account to verify the original data remains unchanged.

Every finance row contains `user_id`, every browser query is scoped to the signed-in user, IndexedDB cache keys include that user ID, and Supabase RLS permits only `auth.uid() = user_id`. This prevents the two accounts from reading or changing each other's data.

The existing Telegram integration belongs only to the account selected by `CVFINANCE_OWNER_USER_ID`. Do not give the second account access to that Telegram bot unless a separate multi-owner bot architecture is implemented later.
