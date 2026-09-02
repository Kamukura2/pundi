import { createClient } from "@supabase/supabase-js";
import { apiError, nativeCors } from "./http.js";
import { commerceConfiguration, findPundiSku, publicPundiCatalog } from "../../src/commerce/catalog.js";
import { amountsMatch, createSnapTransaction, getMidtransStatus, namespaceMatches, notificationSignature, orderIdFor, providerState, safeProviderStatus, statusIsRevoked, statusIsSuccessful, verifyNotificationSignature } from "../../src/commerce/midtrans.js";
import { safeEntitlement, safeOrder } from "../../src/commerce/account.js";

const NO_CACHE = "private, no-store, no-cache, max-age=0, must-revalidate";
const clean = value => String(value ?? "").trim();

function reply(response, status, body) {
  response.setHeader("Cache-Control", NO_CACHE);
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  return response.status(status).json(body);
}

function serviceClient() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw Object.assign(new Error("Commerce service is not configured."), { status: 503, code: "not_configured" });
  }
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function authenticate(request) {
  const authorization = request.headers.authorization || "";
  if (!authorization.startsWith("Bearer ")) throw Object.assign(new Error("Authentication required."), { status: 401, code: "unauthorized" });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    throw Object.assign(new Error("Authentication service is not configured."), { status: 503, code: "not_configured" });
  }
  const auth = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const token = authorization.slice("Bearer ".length).trim();
  const { data: { user }, error } = await auth.auth.getUser(token);
  if (error || !user) throw Object.assign(new Error("Authentication required."), { status: 401, code: "unauthorized" });
  return { user, db: serviceClient() };
}

function bodyOf(request) {
  try {
    return typeof request.body === "string" ? JSON.parse(request.body || "{}") : (request.body || {});
  } catch {
    throw Object.assign(new Error("Malformed JSON request."), { status: 400, code: "invalid_json" });
  }
}

function orderRow(row) {
  return {
    ...row,
    amount: Number(row.expected_amount),
    order_id: row.provider_order_id,
  };
}

function entitlementExpiry(order, startsAt) {
  if (order.expires_at) return order.expires_at;
  if (!order.duration_days) return null;
  const timestamp = Date.parse(startsAt);
  return Number.isFinite(timestamp) ? new Date(timestamp + Number(order.duration_days) * 86400000).toISOString() : null;
}

async function refreshSubscriptionProjection(db, userId) {
  const { data: active, error: activeError } = await db
    .from("commerce_entitlements")
    .select("plan_code,source,starts_at,expires_at,sku,provider_order_id")
    .eq("user_id", userId)
    .eq("product_code", "PUNDI")
    .eq("status", "active")
    .or("expires_at.is.null,expires_at.gt." + new Date().toISOString())
    .order("starts_at", { ascending: false })
    .limit(1);
  if (activeError) throw Object.assign(new Error("Entitlement projection unavailable."), { status: 503, code: "entitlement_unavailable" });
  const { data: current, error: currentError } = await db.from("subscriptions").select("provider").eq("user_id", userId).maybeSingle();
  if (currentError) throw Object.assign(new Error("Entitlement projection unavailable."), { status: 503, code: "entitlement_unavailable" });
  if (active?.[0]) {
    const row = active[0];
    const { error } = await db.from("subscriptions").upsert({
      user_id: userId,
      plan: row.plan_code,
      status: "active",
      provider: row.source,
      provider_subscription_id: row.provider_order_id,
      started_at: row.starts_at,
      current_period_end: row.expires_at,
      entitlement_source: row.source,
      entitlement_sku: row.sku,
      entitlement_expires_at: row.expires_at,
      entitlement_provider_order_id: row.provider_order_id,
    }, { onConflict: "user_id" });
    if (error) throw Object.assign(new Error("Entitlement projection unavailable."), { status: 503, code: "entitlement_unavailable" });
    return;
  }
  // Never erase a separately managed manual/admin/Play entitlement when a
  // single Midtrans order is revoked.
  if (current?.provider && current.provider !== "midtrans_web") return;
  const { error } = await db.from("subscriptions").upsert({
    user_id: userId,
    plan: "free",
    status: "free",
    provider: "manual",
    provider_subscription_id: null,
    current_period_end: null,
    entitlement_source: null,
    entitlement_sku: null,
    entitlement_expires_at: null,
    entitlement_provider_order_id: null,
  }, { onConflict: "user_id" });
  if (error) throw Object.assign(new Error("Entitlement projection unavailable."), { status: 503, code: "entitlement_unavailable" });
}

async function activateEntitlement(db, order, provider) {
  const startsAt = order.starts_at || provider.settlement_time || new Date().toISOString();
  const expiresAt = entitlementExpiry(order, startsAt);
  const { error: entitlementError } = await db.from("commerce_entitlements").upsert({
    user_id: order.user_id,
    product_code: "PUNDI",
    sku: order.sku,
    plan_code: order.entitlement_code,
    status: "active",
    source: "midtrans_web",
    starts_at: startsAt,
    expires_at: expiresAt,
    revoked_at: null,
    provider_order_id: order.provider_order_id,
  }, { onConflict: "provider_order_id" });
  if (entitlementError) throw Object.assign(new Error("Entitlement activation failed."), { status: 503, code: "entitlement_activation_failed" });
  const { error: orderError } = await db.from("commerce_orders").update({
    status: provider.transaction_status,
    provider_transaction_id: provider.transaction_id || null,
    payment_type: provider.payment_type || null,
    starts_at: startsAt,
  }).eq("provider_order_id", order.provider_order_id);
  if (orderError) throw Object.assign(new Error("Order reconciliation failed."), { status: 503, code: "order_reconciliation_failed" });
  await refreshSubscriptionProjection(db, order.user_id);
}

async function revokeEntitlement(db, order, provider) {
  const { error: entitlementError } = await db.from("commerce_entitlements").update({
    status: provider.transaction_status === "chargeback" ? "revoked" : "refunded",
    revoked_at: new Date().toISOString(),
  }).eq("provider_order_id", order.provider_order_id).eq("user_id", order.user_id);
  if (entitlementError) throw Object.assign(new Error("Entitlement reconciliation failed."), { status: 503, code: "entitlement_reconciliation_failed" });
  const { error: orderError } = await db.from("commerce_orders").update({
    status: provider.transaction_status,
    provider_transaction_id: provider.transaction_id || null,
    payment_type: provider.payment_type || null,
  }).eq("provider_order_id", order.provider_order_id);
  if (orderError) throw Object.assign(new Error("Order reconciliation failed."), { status: 503, code: "order_reconciliation_failed" });
  await refreshSubscriptionProjection(db, order.user_id);
}

const PERSISTED_PROVIDER_STATUSES = new Set(["pending", "settlement", "capture", "deny", "cancel", "expire", "refund", "partial_refund", "chargeback", "failure"]);
function persistedProviderStatus(provider) {
  const value = clean(provider.transaction_status).toLowerCase();
  return PERSISTED_PROVIDER_STATUSES.has(value) ? value : "unknown";
}

export async function reconcileOrder(db, order, provider) {
  const state = providerState(provider);
  const status = persistedProviderStatus(provider);
  const orderUpdate = {
    status: status || state,
    provider_transaction_id: provider.transaction_id || null,
    payment_type: provider.payment_type || null,
  };
  const { error: orderError } = await db.from("commerce_orders").update(orderUpdate).eq("provider_order_id", order.provider_order_id);
  if (orderError) throw Object.assign(new Error("Order reconciliation failed."), { status: 503, code: "order_reconciliation_failed" });
  if (state === "successful" && statusIsSuccessful(provider.transaction_status, provider.fraud_status)) await activateEntitlement(db, order, provider);
  else if (state === "revoked" && statusIsRevoked(provider.transaction_status)) await revokeEntitlement(db, order, provider);
  return state;
}

function eventKey(notification) {
  return [clean(notification.order_id), clean(notification.transaction_id), clean(notification.transaction_status), clean(notification.status_code), clean(notification.gross_amount)].join(":");
}

async function recordEvent(db, notification, key) {
  const { data, error } = await db.from("commerce_events").insert({
    provider_order_id: notification.order_id,
    provider_status: clean(notification.transaction_status).toLowerCase() || "unknown",
    provider_transaction_id: clean(notification.transaction_id) || null,
    status_code: clean(notification.status_code) || null,
    gross_amount: clean(notification.gross_amount) || null,
    currency: clean(notification.currency).toUpperCase() || null,
    dedupe_key: key,
  }).select("id").maybeSingle();
  if (!error) return { id: data?.id || null, duplicate: false };
  if (error.code !== "23505") throw Object.assign(new Error("Webhook event could not be recorded."), { status: 503, code: "event_record_failed" });
  const { data: existing, error: existingError } = await db.from("commerce_events").select("id,processed_at").eq("dedupe_key", key).maybeSingle();
  if (existingError) throw Object.assign(new Error("Webhook event could not be read."), { status: 503, code: "event_read_failed" });
  return { id: existing?.id || null, duplicate: Boolean(existing?.processed_at) };
}

async function finishEvent(db, id, result) {
  if (!id) return;
  await db.from("commerce_events").update({ processed_at: new Date().toISOString(), processing_result: result }).eq("id", id);
}

async function failEvent(db, id, result) {
  if (!id) return;
  await db.from("commerce_events").update({ processing_result: result }).eq("id", id);
}

async function handleWebhook(request, response) {
  if (!nativeCors(request, response, ["POST"])) return;
  if (request.method !== "POST") return reply(response, 405, { error: "Method not allowed.", code: "method_not_allowed" });
  const config = commerceConfiguration();
  const notification = bodyOf(request);
  const orderId = clean(notification.order_id);
  if (!namespaceMatches(orderId, "PUNDI")) return reply(response, 422, { error: "Pundi order namespace required.", code: "wrong_order_namespace" });
  if (!config.hasProviderKeys || !verifyNotificationSignature(notification, config.provider.serverKey)) return reply(response, 401, { error: "Invalid provider notification.", code: "invalid_signature" });
  if (!config.configured) return reply(response, 503, { error: "Pundi commerce is not configured.", code: "not_configured" });
  const db = serviceClient();
  const { data: order, error: orderError } = await db.from("commerce_orders").select("*").eq("provider_order_id", orderId).eq("product_code", "PUNDI").maybeSingle();
  if (orderError) return reply(response, 503, { error: "Order lookup failed.", code: "order_lookup_failed" });
  if (!order) return reply(response, 404, { error: "Pundi order not found.", code: "order_not_found" });
  if (!amountsMatch(order.expected_amount, notification.gross_amount)) return reply(response, 422, { error: "Provider amount does not match the order.", code: "amount_mismatch" });
  if (notification.currency && clean(notification.currency).toUpperCase() !== order.currency) return reply(response, 422, { error: "Provider currency does not match the order.", code: "currency_mismatch" });
  if (config.provider.merchantId && notification.merchant_id && clean(notification.merchant_id) !== clean(config.provider.merchantId)) return reply(response, 422, { error: "Provider merchant does not match the order.", code: "merchant_mismatch" });
  const key = eventKey(notification);
  const event = await recordEvent(db, notification, key);
  if (event.duplicate) return reply(response, 200, { ok: true, duplicate: true });
  try {
    let provider = safeProviderStatus(notification);
    if (statusIsSuccessful(provider.transaction_status, provider.fraud_status)) {
      provider = await getMidtransStatus({ environment: config.environment, serverKey: config.provider.serverKey, orderId });
      if (!amountsMatch(order.expected_amount, provider.gross_amount)) throw Object.assign(new Error("Provider amount does not match the order."), { status: 422, code: "amount_mismatch" });
      if (provider.order_id !== orderId || !amountsMatch(order.expected_amount, provider.gross_amount) || (provider.currency && clean(provider.currency).toUpperCase() !== order.currency) || (provider.merchant_id && clean(provider.merchant_id) !== clean(config.provider.merchantId))) throw Object.assign(new Error("Provider status does not match the order."), { status: 422, code: "provider_mismatch" });
    }
    const result = await reconcileOrder(db, orderRow(order), provider);
    await finishEvent(db, event.id, result);
    return reply(response, 200, { ok: true, state: result });
  } catch (error) {
    await failEvent(db, event.id, error.code || "processing_failed");
    return reply(response, Number(error.status) || 503, { error: error.message || "Webhook processing failed.", code: error.code || "processing_failed" });
  }
}

async function catalogResponse(_, response) {
  return reply(response, 200, publicPundiCatalog());
}

async function accountResponse(request, response) {
  const { user, db } = await authenticate(request);
  const [{ data: orders, error: ordersError }, { data: entitlements, error: entitlementsError }] = await Promise.all([
    db.from("commerce_orders").select("provider_order_id,product_code,sku,expected_amount,currency,provider,status,payment_type,created_at,updated_at").eq("user_id", user.id).eq("product_code", "PUNDI").order("created_at", { ascending: false }).limit(50),
    db.from("commerce_entitlements").select("product_code,sku,plan_code,status,source,starts_at,expires_at,revoked_at,created_at,updated_at").eq("user_id", user.id).eq("product_code", "PUNDI").order("created_at", { ascending: false }).limit(50),
  ]);
  if (ordersError || entitlementsError) throw Object.assign(new Error("Commerce account unavailable."), { status: 503, code: "commerce_unavailable" });
  return reply(response, 200, { email: user.email || "", orders: (orders || []).map(safeOrder), entitlements: (entitlements || []).map(safeEntitlement) });
}

async function statusResponse(request, response, url) {
  const { user, db } = await authenticate(request);
  const orderId = clean(url.searchParams.get("order_id"));
  if (!namespaceMatches(orderId, "PUNDI")) return reply(response, 422, { error: "Pundi order namespace required.", code: "wrong_order_namespace" });
  const { data: order, error } = await db.from("commerce_orders").select("*").eq("provider_order_id", orderId).eq("user_id", user.id).eq("product_code", "PUNDI").maybeSingle();
  if (error) throw Object.assign(new Error("Order lookup failed."), { status: 503, code: "order_lookup_failed" });
  if (!order) return reply(response, 404, { error: "Order not found.", code: "order_not_found" });
  const config = commerceConfiguration();
  if (!config.configured || !config.provider.serverKey) return reply(response, 200, { order: safeOrder(order), verification: "pending_configuration" });
  const provider = await getMidtransStatus({ environment: config.environment, serverKey: config.provider.serverKey, orderId });
  if (provider.order_id !== orderId || !amountsMatch(order.expected_amount, provider.gross_amount) || (provider.currency && clean(provider.currency).toUpperCase() !== order.currency) || (provider.merchant_id && clean(provider.merchant_id) !== clean(config.provider.merchantId))) return reply(response, 422, { error: "Provider status does not match the order.", code: "provider_mismatch" });
  const state = await reconcileOrder(db, orderRow(order), provider);
  return reply(response, 200, { order: safeOrder({ ...order, status: provider.transaction_status, provider_transaction_id: provider.transaction_id, payment_type: provider.payment_type }), state });
}

async function createCheckout(request, response) {
  const { user, db } = await authenticate(request);
  const config = commerceConfiguration();
  if (!config.configured) return reply(response, 503, { error: "Pundi commerce is not configured for checkout.", code: "not_configured" });
  const body = bodyOf(request);
  if (Object.keys(body).some(key => ["amount", "gross_amount", "notification_url", "callback_url", "return_url"].includes(key))) return reply(response, 400, { error: "Price and callback fields are server-owned.", code: "client_owned_fields_not_allowed" });
  const item = findPundiSku(body.sku);
  if (!item) return reply(response, 404, { error: "Pundi product is unavailable.", code: "sku_unavailable" });
  const orderId = orderIdFor("PUNDI");
  const { data: order, error: insertError } = await db.from("commerce_orders").insert({
    user_id: user.id,
    product_code: "PUNDI",
    sku: item.sku,
    expected_amount: item.amount,
    currency: item.currency,
    provider: "midtrans",
    provider_order_id: orderId,
    status: "created",
    purchase_type: item.purchase_type,
    duration_days: item.duration_days,
    entitlement_code: item.entitlement,
    starts_at: null,
    expires_at: null,
  }).select("*").single();
  if (insertError || !order) throw Object.assign(new Error("Pundi order could not be created."), { status: 503, code: "order_create_failed" });
  try {
    const checkout = await createSnapTransaction({
      environment: config.environment,
      serverKey: config.provider.serverKey,
      merchantId: config.provider.merchantId,
      orderId,
      amount: item.amount,
      item,
      customerEmail: user.email,
      notificationUrl: config.notificationUrl,
    });
    await db.from("commerce_orders").update({ status: "pending" }).eq("provider_order_id", orderId);
    return reply(response, 201, { order_id: orderId, token: checkout.token, redirect_url: checkout.redirect_url, client_key: config.provider.clientKey, environment: config.environment });
  } catch (error) {
    await db.from("commerce_orders").update({ status: "provider_error" }).eq("provider_order_id", orderId);
    throw error;
  }
}

export async function handleCommerce(request, response, { webhook = false } = {}) {
  try {
    if (webhook) return await handleWebhook(request, response);
    const url = new URL(request.url, `https://${request.headers.host || "pundi.online"}`);
    if (request.method === "GET" && url.searchParams.get("mode") === "catalog") return await catalogResponse(request, response);
    if (request.method === "GET" && url.searchParams.get("mode") === "account") return await accountResponse(request, response);
    if (request.method === "GET" && url.searchParams.get("mode") === "status") return await statusResponse(request, response, url);
    if (request.method === "POST") return await createCheckout(request, response);
    return reply(response, 405, { error: "Method not allowed.", code: "method_not_allowed" });
  } catch (error) {
    return apiError(response, error);
  }
}
