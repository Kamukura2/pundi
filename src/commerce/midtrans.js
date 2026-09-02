import { createHash, timingSafeEqual, randomUUID } from "node:crypto";

export const SUCCESS_STATUSES = new Set(["settlement", "capture"]);
export const REVOKED_STATUSES = new Set(["refund", "partial_refund", "chargeback"]);
export const FAILED_STATUSES = new Set(["deny", "cancel", "expire"]);

const clean = value => String(value ?? "").trim();

export function normalizeIdrAmount(value) {
  const text = clean(value).replace(/,/g, "");
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return null;
  const amount = Number(text);
  return Number.isSafeInteger(amount) && amount >= 0 ? amount : null;
}

export function amountsMatch(expected, received) {
  const left = normalizeIdrAmount(expected);
  const right = normalizeIdrAmount(received);
  return left !== null && left === right;
}

export function orderIdFor(prefix) {
  const namespace = clean(prefix).toUpperCase();
  if (!/^[A-Z][A-Z0-9]{1,15}$/.test(namespace)) throw new Error("Invalid order namespace.");
  return `${namespace}-${Date.now().toString(36).toUpperCase()}-${randomUUID().replaceAll("-", "").toUpperCase()}`;
}

export function namespaceMatches(orderId, prefix) {
  return typeof orderId === "string" && orderId.startsWith(`${prefix}-`) && orderId.length > prefix.length + 2;
}

export function signatureInput(notification, serverKey) {
  return `${clean(notification.order_id)}${clean(notification.status_code)}${clean(notification.gross_amount)}${serverKey}`;
}

export function notificationSignature(notification, serverKey) {
  return createHash("sha512").update(signatureInput(notification, serverKey), "utf8").digest("hex");
}

export function verifyNotificationSignature(notification, serverKey) {
  if (!clean(serverKey) || !/^[a-f0-9]{128}$/i.test(clean(notification?.signature_key))) return false;
  const actual = Buffer.from(notificationSignature(notification, serverKey), "hex");
  const received = Buffer.from(clean(notification.signature_key), "hex");
  return actual.length === received.length && timingSafeEqual(actual, received);
}

export function providerState(notification) {
  const status = clean(notification?.transaction_status).toLowerCase();
  const fraud = clean(notification?.fraud_status).toLowerCase();
  if (status === "capture" && fraud && fraud !== "accept") return "pending";
  if (SUCCESS_STATUSES.has(status)) return "successful";
  if (REVOKED_STATUSES.has(status)) return "revoked";
  if (FAILED_STATUSES.has(status)) return "failed";
  if (status === "pending") return "pending";
  return "unknown";
}

export function statusIsSuccessful(status, fraudStatus = "") {
  const normalized = clean(status).toLowerCase();
  return normalized === "settlement" || (normalized === "capture" && (!clean(fraudStatus) || clean(fraudStatus).toLowerCase() === "accept"));
}

export function statusIsRevoked(status) {
  return REVOKED_STATUSES.has(clean(status).toLowerCase());
}

export function safeProviderStatus(payload = {}) {
  return {
    order_id: clean(payload.order_id),
    transaction_id: clean(payload.transaction_id),
    transaction_status: clean(payload.transaction_status).toLowerCase(),
    fraud_status: clean(payload.fraud_status).toLowerCase() || null,
    status_code: clean(payload.status_code),
    gross_amount: clean(payload.gross_amount),
    currency: clean(payload.currency).toUpperCase() || null,
    payment_type: clean(payload.payment_type) || null,
    merchant_id: clean(payload.merchant_id) || null,
    settlement_time: clean(payload.settlement_time) || null,
  };
}

export function midtransBaseUrl(environment) {
  return environment === "production" ? "https://app.midtrans.com" : "https://app.sandbox.midtrans.com";
}

export function snapScriptUrl(environment) {
  const base = midtransBaseUrl(environment);
  return `${base}/snap/snap.js`;
}

export function midtransApiBaseUrl(environment) {
  return environment === "production" ? "https://api.midtrans.com" : "https://api.sandbox.midtrans.com";
}

function providerHeaders(serverKey, extra = {}) {
  const auth = Buffer.from(`${serverKey}:`, "utf8").toString("base64");
  return { Authorization: `Basic ${auth}`, Accept: "application/json", "Content-Type": "application/json", ...extra };
}

async function providerJson(response) {
  const body = await response.json().catch(() => null);
  if (!response.ok || !body) throw Object.assign(new Error("Midtrans request failed."), { status:502, code:"provider_request_failed" });
  return body;
}

export async function createSnapTransaction({ environment, serverKey, merchantId, orderId, amount, item, customerEmail, notificationUrl, fetchImpl = fetch }) {
  const response = await fetchImpl(`${midtransBaseUrl(environment)}/snap/v1/transactions`, {
    method: "POST",
    headers: providerHeaders(serverKey, { "X-Override-Notification": notificationUrl }),
    body: JSON.stringify({
      transaction_details: { order_id: orderId, gross_amount: amount },
      item_details: [{ id: item.sku, price: item.amount, quantity: 1, name: item.name }],
      customer_details: customerEmail ? { email: customerEmail } : undefined,
      callbacks: { finish: notificationUrl.replace(/\/api\/commerce\/webhook$/, "/") },
      custom_field1: item.product,
      custom_field2: item.sku,
      custom_field3: merchantId || undefined,
    }),
  });
  const body = await providerJson(response);
  if (!clean(body.token)) throw Object.assign(new Error("Midtrans checkout token unavailable."), { status:502, code:"provider_token_missing" });
  return { token: body.token, redirect_url: clean(body.redirect_url) || null };
}

export async function getMidtransStatus({ environment, serverKey, orderId, fetchImpl = fetch }) {
  const response = await fetchImpl(`${midtransApiBaseUrl(environment)}/v2/${encodeURIComponent(orderId)}/status`, {
    method: "GET",
    headers: providerHeaders(serverKey),
  });
  return safeProviderStatus(await providerJson(response));
}
