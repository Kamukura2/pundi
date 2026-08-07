# CVFinance v7.0.1 stock patch

## Changes

- IDX quantity is entered and displayed in lots; 1 lot equals 100 shares.
- US quantity is entered and displayed in shares; fractional shares remain supported.
- IDX automatically maps to Twelve Data and IDR.
- NASDAQ/NYSE automatically map to Finnhub and USD.
- Existing invalid market/provider mappings are repaired after sign-in.
- Current price remains the latest successful API value. Manual editing is retained only as a fallback.

## Data safety

No SQL migration is required. `stock_holdings.quantity` continues to store shares, so an existing IDX quantity of 10,000 is displayed as 100 lots without changing portfolio calculations.

## Deployment

Upload the complete project contents to the existing GitHub repository and commit the changes. Vercel will deploy the new commit automatically. Do not delete or recreate the Supabase project.
