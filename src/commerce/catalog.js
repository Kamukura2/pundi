export const PUNDI_PRODUCT = "PUNDI";
export const PUNDI_CATALOG_ENV = "PUNDI_COMMERCE_CATALOG_JSON";
export const PUNDI_NOTIFICATION_URL = "https://app.pundi.online/api/commerce/webhook";

const ENVIRONMENTS = new Set(["sandbox", "production"]);
const PURCHASE_TYPES = new Set(["lifetime", "recurring", "expiring"]);
const clean = value => typeof value === "string" ? value.trim() : "";

function positiveInteger(value) {
  const number = typeof value === "number" ? value : Number(String(value ?? "").trim());
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function safeCatalogItem(item) {
  if (!item || typeof item !== "object") return null;
  const sku = clean(item.sku);
  const name = clean(item.name);
  const entitlement = clean(item.entitlement || item.plan);
  const purchaseType = clean(item.purchase_type || item.purchaseType) || "lifetime";
  const amount = positiveInteger(item.amount);
  const currency = clean(item.currency || "IDR").toUpperCase();
  if (!sku || !name || !entitlement || !amount || currency !== "IDR" || !PURCHASE_TYPES.has(purchaseType)) return null;
  if (!/^[A-Z0-9][A-Z0-9._:-]{1,63}$/i.test(sku)) return null;
  if (!/^[a-z][a-z0-9._:-]{1,63}$/i.test(entitlement)) return null;
  const durationDays = item.duration_days == null ? null : positiveInteger(item.duration_days);
  if (purchaseType !== "lifetime" && !durationDays) return null;
  if (purchaseType === "expiring" && !durationDays) return null;
  return {
    product: PUNDI_PRODUCT,
    sku,
    name,
    description: clean(item.description),
    entitlement,
    purchase_type: purchaseType,
    duration_days: durationDays,
    amount,
    currency,
    active: item.active !== false,
  };
}

export function parsePundiCatalog(raw) {
  if (!raw) return [];
  let value;
  try { value = typeof raw === "string" ? JSON.parse(raw) : raw; } catch { return []; }
  const items = Array.isArray(value) ? value : Array.isArray(value?.products) ? value.products : [];
  return items.map(safeCatalogItem).filter(Boolean);
}

export function environmentFrom(env = process.env) {
  const value = clean(env.MIDTRANS_ENV || env.PUNDI_COMMERCE_ENV).toLowerCase();
  return ENVIRONMENTS.has(value) ? value : "sandbox";
}

export function configuredNotificationUrl(env = process.env) {
  const value = clean(env.PUNDI_MIDTRANS_NOTIFICATION_URL) || PUNDI_NOTIFICATION_URL;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !["pundi.online", "app.pundi.online"].includes(url.hostname)) return "";
    return url.href;
  } catch { return ""; }
}

export function readPundiCatalog(env = process.env) {
  return parsePundiCatalog(env[PUNDI_CATALOG_ENV]);
}

export function commerceConfiguration(env = process.env) {
  const environment = environmentFrom(env);
  const catalog = readPundiCatalog(env).filter(item => item.active);
  const hasProviderKeys = Boolean(clean(env.MIDTRANS_SERVER_KEY) && clean(env.MIDTRANS_CLIENT_KEY) && clean(env.MIDTRANS_MERCHANT_ID));
  const enabled = String(env.PUNDI_COMMERCE_ENABLED || "").toLowerCase() === "true";
  const notificationUrl = configuredNotificationUrl(env);
  const configured = enabled && hasProviderKeys && Boolean(notificationUrl) && catalog.length > 0;
  return {
    environment,
    catalog,
    notificationUrl,
    enabled,
    hasProviderKeys,
    configured,
    productionReady: configured && environment === "production",
  };
}

export function findPundiSku(sku, env = process.env) {
  const value = clean(sku);
  return commerceConfiguration(env).catalog.find(item => item.sku === value) || null;
}

export function publicPundiCatalog(env = process.env) {
  const config = commerceConfiguration(env);
  return {
    environment: config.environment,
    configured: config.configured,
    production: config.productionReady,
    currency: "IDR",
    products: config.configured ? config.catalog.map(({ product, sku, name, description, entitlement, purchase_type, duration_days, amount, currency }) => ({ product, sku, name, description, entitlement, purchase_type, duration_days, amount, currency })) : [],
  };
}
