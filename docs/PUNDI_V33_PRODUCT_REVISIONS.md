# Pundi V3.3 targeted product revisions

## Account and entitlement display

The account panel exposes the current plan, purchase/access state, password change, and sign-out only. Developer seed/import/export/delete controls and raw account status metadata are not rendered.

`accountPlanPresentation()` is fail-closed: `Premium` is shown only for an active, non-expired `paid`, `premium`, `pro`, `lifetime`, or `pundi_pro_lifetime` subscription/entitlement. Lifetime codes display `Premium` / `Lifetime Access`; all missing, expired, cancelled, or unavailable records display `Free` and never grant access. Commerce catalog and account reads are independent so a catalog/network failure cannot erase a known account plan or expose a raw fetch error.

No entitlement or financial data is written by this UI revision. Existing migrated account rows remain unchanged; a Premium/Lifetime result requires an auditable entitlement record in the configured Pundi backend.

## Ticker icons

The current market-data contract provides quotes and provider health, but no trusted ticker logo URL. V3.3 therefore uses `src/ui/ticker-icons.js`: a deterministic local map for common IDX/US/crypto assets (including `MU` / Micron), with a neutral monogram fallback for unknown symbols. Icons are rendered persistently in allocation legends, holding rows, and Trading position headers. No remote image request or provider secret is introduced; `title` and accessible labels retain the full symbol/company context.

## Favicon and responsive surface

The approved Pundi mark remains unchanged. Web/PWA favicon assets use a `0.41` canvas fraction versus the prior `0.68` fraction; desktop/Android launcher assets retain their established scale. The Trading summary uses equal-width `Total Portfolio` and `Allocation` cards with a quiet green gradient and collapses to one column at the mobile breakpoint. The accepted drawer/FAB behavior remains unchanged.
