# Supabase setup

1. Create a Supabase project and save its project URL, public anon/publishable key, and database password.
2. Open **SQL Editor** and run these files in order:
   - New project: run every file in `supabase/migrations/` from `001` through `013` in numeric order.
   - Existing v7.9.6 project: run only `supabase/migrations/013_investment_dividends.sql` before deploying v8.0.0.
3. In **Authentication → Providers → Email**, keep email/password enabled and disable unrestricted new-user registration/sign-ups.
4. In **Authentication → Users**, create and confirm one private user manually. Do not expose a sign-up page.
5. In **Authentication → URL Configuration**, set the Vercel production URL as Site URL after the first deployment.
6. Sign in to CVFinance. Use either:
   - **Import v6.3.1 local data** on the device/browser that contains the old data;
   - **Import JSON backup**; or
   - **Load MVP seed data** for the included sample.

Every personal table has `id`, `user_id`, `created_at`, and `updated_at`. RLS is enabled and forced. Separate SELECT, INSERT, UPDATE, and DELETE policies require `auth.uid() = user_id`. The app never uses a service-role key in browser code.

To verify RLS, create a second temporary Auth user, insert one row per user, and confirm each authenticated session can only read its own row. Delete the temporary user afterward.

Official references: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Supabase Auth](https://supabase.com/docs/guides/auth).
