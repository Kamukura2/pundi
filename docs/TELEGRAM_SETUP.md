# Private CVFinance Telegram bot setup

This integration is independent from every other bot. It has its own token, route, environment names, state table, and logs. Runtime uses a Telegram webhook on Vercel; the PC may be turned off.

## 1. Run the Supabase migration

1. Open Supabase → project **cvfinance**.
2. Left sidebar → **SQL Editor** → **New query**.
3. Open `supabase/migrations/005_telegram_cvfinance.sql`, copy all text, and paste it into the query.
4. Click **Run** in the lower-right/top toolbar.
5. Confirm **Success. No rows returned**.

The migration does not delete or reset existing finance data.

## 2. Create a new dedicated bot

1. In Telegram, search for the verified **@BotFather** account.
2. Send `/newbot`.
3. Enter a distinct name such as `CVFinance Private`.
4. Enter a new username ending in `bot`, for example `my_cvfinance_private_bot`.
5. Copy the new token to a private password manager. Do not reuse another bot's token and do not paste it into chat or GitHub.
6. Open the new bot, click **Start**, and send `hello` once.

## 3. Find the private Telegram IDs once

This is a one-time setup lookup, not runtime long polling.

Open Windows PowerShell and run:

```powershell
$cvfToken = Read-Host "Paste the NEW CVFinance bot token"
$cvfUpdates = Invoke-RestMethod -Uri "https://api.telegram.org/bot$cvfToken/getUpdates"
$cvfUpdates.result | ConvertTo-Json -Depth 10
```

In the output from the `hello` message, save:

- `message.from.id` → `TELEGRAM_CVFINANCE_ALLOWED_USER_ID`
- `message.chat.id` → `TELEGRAM_CVFINANCE_ALLOWED_CHAT_ID`

For a private chat they are normally the same, but copy both exact values. Close PowerShell afterward.

## 4. Generate a separate webhook secret

Run this in a fresh PowerShell window:

```powershell
$cvfBytes = New-Object byte[] 32
$cvfRng = New-Object System.Security.Cryptography.RNGCryptoServiceProvider
$cvfRng.GetBytes($cvfBytes)
$cvfSecret = -join ($cvfBytes | ForEach-Object { $_.ToString("x2") })
$cvfSecret
```

Save the result as `TELEGRAM_CVFINANCE_WEBHOOK_SECRET`. It must be different from `CRON_SECRET` and secrets used by other bots.

## 5. Copy the Supabase owner UUID and server key

Owner UUID:

1. Supabase left sidebar → **Authentication** → **Users**.
2. Click the confirmed CVFinance user.
3. Copy the user's **UID/ID** (UUID), not the email.
4. Save it as `CVFINANCE_OWNER_USER_ID`.

Server key:

1. Supabase left sidebar → **Project Settings** (gear icon) → **API Keys**.
2. Copy a server-only **Secret key** (`sb_secret_...`). A legacy `service_role` key also works.
3. Save it in Vercel under the environment name `SUPABASE_SERVICE_ROLE_KEY`.

Never put this server key in frontend code, Telegram, GitHub, or a variable beginning with `VITE_`/`NEXT_PUBLIC_`.

## 6. Add Vercel environment variables

1. Vercel dashboard → project **cvfinance**.
2. Top menu → **Settings**.
3. Left menu → **Environment Variables**.
4. Add each value below and enable **Production**, **Preview**, and **Development**:

| Name | Value |
|---|---|
| `TELEGRAM_CVFINANCE_BOT_TOKEN` | New dedicated BotFather token |
| `TELEGRAM_CVFINANCE_ALLOWED_USER_ID` | `message.from.id` |
| `TELEGRAM_CVFINANCE_ALLOWED_CHAT_ID` | `message.chat.id` |
| `TELEGRAM_CVFINANCE_WEBHOOK_SECRET` | New random secret |
| `CVFINANCE_OWNER_USER_ID` | Supabase Auth user UUID |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase secret/service-role key |

Keep the existing `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `FINNHUB_API_KEY` values.

## 7. Deploy the complete project

Upload/replace the complete v7.1.0 project contents in the existing GitHub `cvfinance` repository. Commit it. Vercel should automatically deploy. Wait until the newest deployment is **Ready**.

The dedicated route is:

`https://cvfinance-nu.vercel.app/api/telegram/cvfinance-webhook`

If the production domain shown by Vercel is different, replace only the domain in the setup command below.

## 8. Configure the BotFather command menu

1. Open **@BotFather** → send `/setcommands`.
2. Select the new CVFinance bot only.
3. Paste exactly:

```text
start - Start CVFinance Bot
help - Show commands and examples
summary - Current finance snapshot
balance - View or update balances
client - Client payments
credit - Credit Card and PayLater
electricity - Electricity readings
stocks - Portfolio summary
```

## 9. Register the webhook

Open PowerShell and run:

```powershell
$cvfToken = Read-Host "Paste the NEW CVFinance bot token"
$cvfSecret = Read-Host "Paste TELEGRAM_CVFINANCE_WEBHOOK_SECRET"
$cvfWebhook = "https://cvfinance-nu.vercel.app/api/telegram/cvfinance-webhook"
$cvfBody = @{
  url = $cvfWebhook
  secret_token = $cvfSecret
  drop_pending_updates = $true
  allowed_updates = @("message", "callback_query")
} | ConvertTo-Json
Invoke-RestMethod -Uri "https://api.telegram.org/bot$cvfToken/setWebhook" -Method Post -ContentType "application/json" -Body $cvfBody
```

Expected result: `ok: True` and `result: True`.

Verify:

```powershell
Invoke-RestMethod -Uri "https://api.telegram.org/bot$cvfToken/getWebhookInfo"
```

The URL must end with `/api/telegram/cvfinance-webhook` and `last_error_message` should be empty.

## 10. Short end-to-end test

1. Send `/help`.
2. Send `-50k grocery`; confirm one Food/Offline expense appears in the open PWA.
3. Send `-85k coffee grab`; confirm Coffee/Grab.
4. Send `+500000`, then reply `Bonus sales`; confirm one income row.
5. Test `/balance`, `/client Getlook`, `/credit`, `/electricity`, `/stocks`, and `/summary`.
6. Send a message to the bot from another Telegram account; it must receive no data and create no Supabase row.

## `/help` content

The exact runtime help text is maintained in `api/telegram/_lib/messages.js` and includes quick transactions, balances, clients, credit, electricity, stocks, summary, dates, and natural-language shortcuts.

## Official references

- Telegram Bot API (`setWebhook`, `secret_token`, `setMyCommands`): https://core.telegram.org/bots/api
- Vercel Functions: https://vercel.com/docs/functions
- Supabase server-only secret/service-role keys and RLS: https://supabase.com/docs/guides/database/secure-data
