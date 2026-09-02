import { getAuthenticatedSession } from "../lib/supabase.js";
import { apiUrl } from "../lib/runtime.js";

const json = async response => {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Commerce request failed.");
  return body;
};

export async function fetchCommerceCatalog() {
  const response = await fetch(apiUrl("/api/commerce?mode=catalog"), { cache: "no-store" });
  return json(response);
}

async function authenticatedRequest(path, options = {}) {
  const { session } = await getAuthenticatedSession();
  if (!session?.access_token) throw new Error("Authentication required.");
  return json(await fetch(apiUrl(path), {
    cache: "no-store",
    ...options,
    headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json", "Cache-Control": "no-cache", ...(options.headers || {}) },
  }));
}

export async function fetchCommerceAccount() {
  return authenticatedRequest("/api/commerce?mode=account");
}

export async function createCommerceCheckout(sku) {
  return authenticatedRequest("/api/commerce", { method: "POST", body: JSON.stringify({ sku }) });
}

export async function fetchCommerceStatus(orderId) {
  return authenticatedRequest(`/api/commerce?mode=status&order_id=${encodeURIComponent(orderId)}`);
}

let snapPromise;
export function loadMidtransSnap(clientKey, environment) {
  if (!clientKey || !["sandbox", "production"].includes(environment)) throw new Error("Checkout configuration is unavailable.");
  if (snapPromise) return snapPromise;
  snapPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector("script[data-pundi-midtrans-snap]");
    if (existing) {
      if (existing.dataset.environment !== environment || existing.dataset.clientKey !== clientKey) {
        reject(new Error("A different checkout environment is already loaded."));
        return;
      }
      existing.addEventListener("load", () => resolve(window.snap));
      if (window.snap) resolve(window.snap);
      return;
    }
    const script = document.createElement("script");
    script.src = environment === "production" ? "https://app.midtrans.com/snap/snap.js" : "https://app.sandbox.midtrans.com/snap/snap.js";
    script.dataset.pundiMidtransSnap = "true";
    script.dataset.environment = environment;
    script.dataset.clientKey = clientKey;
    script.setAttribute("data-client-key", clientKey);
    script.onload = () => window.snap ? resolve(window.snap) : reject(new Error("Checkout UI unavailable."));
    script.onerror = () => reject(new Error("Checkout UI could not be loaded."));
    document.head.appendChild(script);
  });
  return snapPromise;
}
