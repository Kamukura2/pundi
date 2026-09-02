# Pundi + Nook Midtrans Commerce v1

This repository owns the Pundi side of the shared merchant boundary. It never
reads or writes Nook data. Nook has its own copy of this document and its own
Supabase project.

## Current production state

- Target Supabase: `Pundi` / `ndeycwoyjwyntjkgbzlz`.
- Migration `022_commerce.sql` is applied and recorded remotely.
- Sandbox checkout is configured for E2E with the owner-approved Pundi catalog;
  Production checkout remains fail-closed (`production = false`).
- Approved launch product: `PUNDI_PRO_LIFETIME`, Pundi Pro Lifetime, IDR
  49,000, one-time, permanent account entitlement subject to provider/admin
  revocation.

## Boundary

One Midtrans merchant may receive both products, but each order is partitioned:

- Pundi order IDs: `PUNDI-<random-id>`.
- Pundi webhook: `https://app.pundi.online/api/commerce/webhook`.
- Pundi tables: `commerce_orders`, `commerce_events`,
  `commerce_entitlements`, and the existing `subscriptions` projection.
- Pundi source: `midtrans_web`; future `google_play`, `promo`, and `admin`
  remain compatible with the same account entitlement model.

No email, user name, token, finance value, or Nook identifier belongs in an
order ID. There is no shared user/content/finance table or cross-product FK.

## Server flow

1. An authenticated Pundi account requests a SKU only.
2. `api/commerce.js` resolves the SKU, amount, currency, plan, and entitlement
   from the server-side catalog. Sandbox uses the scoped
   `PUNDI_COMMERCE_CATALOG_JSON_SANDBOX`; clients never submit an amount.
3. The server creates the Midtrans Snap transaction and returns only a Snap
   token, public client key, environment, and order ID.
4. Browser Snap callbacks are display signals only. They never grant access.
5. The fixed webhook and the authenticated status endpoint verify the provider
   order, namespace, amount, currency, merchant, signature, and provider state.
   Snap creation uses `app.sandbox.midtrans.com`/`app.midtrans.com`; status
   verification uses `api.sandbox.midtrans.com`/`api.midtrans.com`.
6. Only `settlement` or accepted `capture` activates the account entitlement.
   Duplicate events are deduplicated. Refund, partial refund, and chargeback
   revoke the affected entitlement without deleting order history.
7. The existing `subscriptions` row is updated as a compatibility projection,
   so the current web/native account resolver sees the same paid account state.

## Configuration

Keep these in Vercel encrypted environment variables, never in Git or client
bundles:

- `MIDTRANS_ENV`: exactly `sandbox` or `production`; `PUNDI_COMMERCE_ENV`
  may override it for a project-local Sandbox deployment.
- `MIDTRANS_MERCHANT_ID`, `MIDTRANS_CLIENT_KEY`, and `MIDTRANS_SERVER_KEY`
  are the Production-scope names; the Server Key is server-side only.
- `MIDTRANS_MERCHANT_ID_SANDBOX`, `MIDTRANS_CLIENT_KEY_SANDBOX`, and
  `MIDTRANS_SERVER_KEY_SANDBOX` are encrypted Sandbox-scope names.
- Invalid environment values fail closed; they never select Production as a
  fallback.
- `PUNDI_COMMERCE_ENABLED`: `true` only after all gates pass.
- `PUNDI_COMMERCE_CATALOG_JSON` (Production) or
  `PUNDI_COMMERCE_CATALOG_JSON_SANDBOX` (Sandbox): an approved JSON catalog.
  The current approved Sandbox entry is:

```json
[{"sku":"PUNDI_PRO_LIFETIME","name":"Pundi Pro Lifetime","amount":49000,"currency":"IDR","entitlement":"pundi_pro_lifetime","purchase_type":"lifetime","active":true}]
```

For `expiring` or `recurring` products, `duration_days` is required. Amounts
are integer IDR and are never accepted from the browser.

Production requires an HTTPS fixed notification URL and an approved merchant
scope for both product domains. Production is disabled if any required value
is missing.

## Client/account behavior

The Pundi account panel reads sanitized orders and entitlements from the
server. It does not expose raw Midtrans payloads. A website purchase belongs to
the Pundi account, not to a device license. A later Google Play verifier must
write the same `commerce_entitlements` model with `source = google_play`; no
second license universe is required.

## Operations and QA

Before production activation, run `npm run test:commerce`, the existing Pundi
regression gates, `git diff --check`, and a client-artifact secret scan. Test
pending, failed, expired, forged signature, wrong amount/SKU/namespace,
replay, duplicate event, cross-user, and cross-product cases. A real checkout
must never be enabled without an approved price/catalog and verified Midtrans
merchant configuration.

The local source also contains `021_acquisition.sql`, which was not applied as
part of commerce work because it is unrelated. Do not use a broad migration
push until that pre-existing migration-history discrepancy is consciously
resolved with the database owner.
