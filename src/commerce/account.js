export function safeOrder(row = {}) {
  return {
    order_id: row.provider_order_id || null,
    sku: row.sku || null,
    product: row.product_code || "PUNDI",
    amount: Number(row.expected_amount || 0),
    currency: row.currency || "IDR",
    provider: row.provider || "midtrans",
    status: row.status || "unknown",
    payment_type: row.payment_type || null,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
  };
}

export function safeEntitlement(row = {}) {
  return {
    product: row.product_code || "PUNDI",
    sku: row.sku || null,
    plan: row.plan_code || null,
    status: row.status || "inactive",
    source: row.source || null,
    starts_at: row.starts_at || null,
    expires_at: row.expires_at || null,
    revoked_at: row.revoked_at || null,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
  };
}
