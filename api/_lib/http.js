export function method(request, response, allowed = ["GET"]) {
  if (!allowed.includes(request.method)) {
    response.setHeader("Allow", allowed.join(", "));
    response.status(405).json({ error:"Method not allowed." });
    return false;
  }
  return true;
}

export async function fetchJson(url, options = {}, timeoutMs = 6500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal:controller.signal });
    const body = await response.json().catch(() => ({}));
    if (response.status === 429) throw Object.assign(new Error("Provider rate limit reached."), { code:"rate_limited", status:429 });
    if (!response.ok) throw Object.assign(new Error(body.message || body.error || `Provider returned ${response.status}.`), { code:"provider_error", status:response.status });
    return body;
  } catch (error) {
    if (error.name === "AbortError") throw Object.assign(new Error("Stock provider timed out."), { code:"timeout", status:504 });
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchText(url, options = {}, timeoutMs = 6500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal:controller.signal });
    const body = await response.text().catch(() => "");
    if (response.status === 429) throw Object.assign(new Error("Provider rate limit reached."), { code:"rate_limited", status:429 });
    if (!response.ok) throw Object.assign(new Error(`Provider returned ${response.status}.`), { code:"provider_error", status:response.status });
    return body;
  } catch (error) {
    if (error.name === "AbortError") throw Object.assign(new Error("Market provider timed out."), { code:"timeout", status:504 });
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export function apiError(response, error) {
  const status = Number(error.status) || 502;
  return response.status(status).json({ error:error.message || "Stock quote failed.", code:error.code || "quote_failed" });
}
