import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { commerceConfiguration, parsePundiCatalog, publicPundiCatalog } from '../../src/commerce/catalog.js';
import { amountsMatch, namespaceMatches, notificationSignature, orderIdFor, providerState, statusIsSuccessful, verifyNotificationSignature } from '../../src/commerce/midtrans.js';

const configuredEnv = {
  MIDTRANS_ENV: 'production',
  MIDTRANS_SERVER_KEY: 'server-key-not-a-secret',
  MIDTRANS_CLIENT_KEY: 'client-key',
  MIDTRANS_MERCHANT_ID: 'merchant',
  PUNDI_COMMERCE_ENABLED: 'true',
  PUNDI_COMMERCE_CATALOG_JSON: JSON.stringify([{ sku: 'PUNDI-PAID', name: 'Pundi paid access', entitlement: 'paid', amount: 1000, currency: 'IDR', purchase_type: 'lifetime' }]),
};

const catalog = parsePundiCatalog(configuredEnv.PUNDI_COMMERCE_CATALOG_JSON);
assert.equal(catalog.length, 1);
assert.equal(catalog[0].amount, 1000);
assert.equal(parsePundiCatalog(JSON.stringify([{ sku: 'PUNDI-BAD', name: 'bad', entitlement: 'paid', currency: 'IDR' }])).length, 0, 'missing price must fail closed');
assert.equal(parsePundiCatalog(JSON.stringify([{ sku: 'PUNDI-BAD', name: 'bad', entitlement: 'paid', amount: 1, currency: 'USD' }])).length, 0, 'non-IDR catalog must fail closed');
assert.equal(commerceConfiguration({}).configured, false, 'empty environment must not enable checkout');
assert.equal(commerceConfiguration(configuredEnv).productionReady, true);
assert.equal(publicPundiCatalog({ ...configuredEnv, PUNDI_COMMERCE_ENABLED: 'false' }).products.length, 0);

const orderId = orderIdFor('PUNDI');
assert.match(orderId, /^PUNDI-[A-Z0-9-]+$/);
assert.equal(namespaceMatches(orderId, 'PUNDI'), true);
assert.equal(namespaceMatches(orderId, 'NOOK'), false, 'Pundi order cannot enter Nook namespace');
assert.equal(amountsMatch(1000, '1000.00'), true);
assert.equal(amountsMatch(1000, '1001.00'), false);
assert.equal(amountsMatch(1000, '1,000'), true);
assert.equal(amountsMatch(1000, '1000.001'), false);

const notification = { order_id: orderId, status_code: '200', gross_amount: '1000.00', transaction_status: 'settlement' };
const signature = notificationSignature(notification, 'test-key');
assert.equal(signature.length, 128);
assert.equal(verifyNotificationSignature({ ...notification, signature_key: signature }, 'test-key'), true);
assert.equal(verifyNotificationSignature({ ...notification, signature_key: '0'.repeat(128) }, 'test-key'), false);
assert.equal(verifyNotificationSignature({ ...notification, signature_key: signature, gross_amount: '1001.00' }, 'test-key'), false);

assert.equal(providerState({ transaction_status: 'settlement' }), 'successful');
assert.equal(providerState({ transaction_status: 'capture', fraud_status: 'challenge' }), 'pending');
assert.equal(providerState({ transaction_status: 'pending' }), 'pending');
assert.equal(providerState({ transaction_status: 'deny' }), 'failed');
assert.equal(providerState({ transaction_status: 'expire' }), 'failed');
assert.equal(providerState({ transaction_status: 'refund' }), 'revoked');
assert.equal(providerState({ transaction_status: 'chargeback' }), 'revoked');
assert.equal(statusIsSuccessful('capture', 'accept'), true);
assert.equal(statusIsSuccessful('capture', 'challenge'), false);

const midtrans = await import('../../src/commerce/midtrans.js');
let request;
const checkout = await midtrans.createSnapTransaction({
  environment: 'sandbox', serverKey: 'test-key', merchantId: 'merchant', orderId,
  amount: 1000, item: catalog[0], customerEmail: 'buyer@example.test',
  notificationUrl: 'https://app.pundi.online/api/commerce/webhook',
  fetchImpl: async (url, init) => {
    request = { url, init };
    return new Response(JSON.stringify({ token: 'snap-token', redirect_url: 'https://example.test/redirect' }), { status: 201, headers: { 'content-type': 'application/json' } });
  },
});
assert.equal(checkout.token, 'snap-token');
assert.equal(request.url, 'https://app.sandbox.midtrans.com/snap/v1/transactions');
assert.match(request.init.headers.Authorization, /^Basic /);
const requestBody = JSON.parse(request.init.body);
assert.equal(requestBody.transaction_details.gross_amount, 1000, 'provider amount comes from catalog');
assert.equal(requestBody.item_details[0].price, 1000);
assert.equal(requestBody.callbacks.finish, 'https://app.pundi.online/');

const api = await readFile(new URL('../../api/_lib/commerce-handler.js', import.meta.url), 'utf8');
const migration = await readFile(new URL('../../supabase/migrations/022_commerce.sql', import.meta.url), 'utf8');
const browser = await readFile(new URL('../../src/commerce/client.js', import.meta.url), 'utf8');
assert.match(api, /client_owned_fields_not_allowed/);
assert.match(api, /PUNDI/);
assert.match(api, /commerce_entitlements/);
assert.match(api, /function failEvent/);
assert.match(api, /await failEvent\(db, event\.id/);
assert.match(api, /provider_mismatch/);
assert.match(await readFile(new URL('../../scripts/commerce-reconcile.mjs', import.meta.url), 'utf8'), /--apply requires one explicit PUNDI/);
assert.match(migration, /enable row level security/gi);
assert.match(migration, /auth\.uid\(\).*user_id/);
assert.doesNotMatch(browser, /MIDTRANS_SERVER_KEY|SUPABASE_SERVICE_ROLE_KEY/);
console.log('Pundi commerce contracts: PASS');
