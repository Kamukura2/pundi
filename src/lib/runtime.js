import { Capacitor } from "@capacitor/core";

export const NATIVE_API_ORIGIN = "https://app.pundi.online";

export function isNativeRuntime() {
  return Boolean(Capacitor?.isNativePlatform?.());
}

export function apiUrl(path) {
  const value = String(path || "");
  if (!isNativeRuntime() || /^https?:\/\//i.test(value)) return value;
  return new URL(value, `${NATIVE_API_ORIGIN}/`).href;
}

export function authRedirectOrigin() {
  return isNativeRuntime() ? NATIVE_API_ORIGIN : window.location.origin;
}
