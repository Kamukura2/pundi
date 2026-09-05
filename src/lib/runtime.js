import { Capacitor } from "@capacitor/core";

export const NATIVE_API_ORIGIN = "https://app.pundi.online";

export function isNativeRuntime() {
  return Boolean(Capacitor?.isNativePlatform?.());
}

export function isDesktopRuntime() {
  if (typeof window === "undefined") return false;
  const desktopFlag = new URLSearchParams(window.location.search).get("pundi_desktop");
  return window.location.protocol === "file:" || desktopFlag === "1";
}

export function isAppRuntime() {
  return isNativeRuntime() || isDesktopRuntime();
}

export function apiUrl(path) {
  const value = String(path || "");
  if (!isAppRuntime() || /^https?:\/\//i.test(value)) return value;
  return new URL(value, `${NATIVE_API_ORIGIN}/`).href;
}

export function authRedirectOrigin() {
  return isAppRuntime() ? NATIVE_API_ORIGIN : window.location.origin;
}
