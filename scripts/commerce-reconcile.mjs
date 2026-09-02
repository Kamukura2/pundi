#!/usr/bin/env node
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { getMidtransStatus, amountsMatch, providerState } from "../src/commerce/midtrans.js";
import { reconcileOrder } from "../api/_lib/commerce-handler.js";

const args = new Set(process.argv.slice(2));
const orderArgIndex = process.argv.indexOf("--order");
const requestedOrder = orderArgIndex >= 0 ? process.argv[orderArgIndex + 1] : "";
const apply = args.has("--apply");
if (apply && !/^PUNDI-[A-Z0-9-]+$/i.test(requestedOrder)) {
  console.error("--apply requires one explicit PUNDI-* order via --order; no mass writes are allowed.");
  process.exit(2);
}

const env = process.env;
const supabaseUrl = String(env.PUNDI_SUPABASE_URL || "").trim();
const serviceKey = String(env.PUNDI_SUPABASE_SERVICE_ROLE_KEY || "").trim();
const serverKey = String(env.MIDTRANS_SERVER_KEY || "").trim();
const merchantId = String(env.MIDTRANS_MERCHANT_ID || "").trim();
assert(supabaseUrl.includes("ndeycwoyjwyntjkgbzlz"), "PUNDI_SUPABASE_URL must target ndeycwoyjwyntjkgbzlz");
assert(serviceKey && serverKey && merchantId, "Pundi service/provider environment is incomplete");

const db = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const statusFilter = ["created", "pending", "unknown", "refund", "partial_refund", "chargeback"];
const { data: orders, error } = await db.from("commerce_orders").select("*").eq("product_code", "PUNDI").in("status", statusFilter).order("created_at", { ascending: true }).limit(100);
if (error) throw new Error("Pundi order report query failed.");

const summary = { product: "PUNDI", inspected: 0, remotely_successful: 0, remotely_revoked: 0, pending: 0, mismatches: 0, errors: 0, applied_order: null, orders: [] };
for (const order of orders || []) {
  if (requestedOrder && order.provider_order_id !== requestedOrder) continue;
  summary.inspected += 1;
  const item = { order_id: order.provider_order_id, local_status: order.status, remote_state: "unknown", action: "dry_run" };
  try {
    const provider = await getMidtransStatus({ environment: env.MIDTRANS_ENV === "sandbox" ? "sandbox" : "production", serverKey, orderId: order.provider_order_id });
    const matches = provider.order_id === order.provider_order_id && amountsMatch(order.expected_amount, provider.gross_amount) && (!provider.merchant_id || provider.merchant_id === merchantId) && (!provider.currency || provider.currency === order.currency);
    if (!matches) {
      item.action = "provider_mismatch";
      summary.mismatches += 1;
    } else {
      item.remote_state = providerState(provider);
      if (item.remote_state === "successful") summary.remotely_successful += 1;
      else if (item.remote_state === "revoked") summary.remotely_revoked += 1;
      else if (item.remote_state === "pending") summary.pending += 1;
      if (apply && order.provider_order_id === requestedOrder) {
        const state = await reconcileOrder(db, order, provider);
        const dedupeKey = `reconcile:${order.provider_order_id}:${provider.transaction_id || "none"}:${provider.transaction_status || "unknown"}`;
        await db.from("commerce_events").upsert({ provider_order_id: order.provider_order_id, provider_status: provider.transaction_status || "unknown", provider_transaction_id: provider.transaction_id || null, status_code: provider.status_code || null, gross_amount: provider.gross_amount || null, currency: provider.currency || null, dedupe_key: dedupeKey, processed_at: new Date().toISOString(), processing_result: state }, { onConflict: "dedupe_key" });
        item.action = `applied:${state}`;
        summary.applied_order = order.provider_order_id;
      }
    }
  } catch {
    item.action = "provider_error";
    summary.errors += 1;
  }
  summary.orders.push(item);
}
console.log(JSON.stringify(summary));
