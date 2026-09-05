import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { StatusBar, Style } from "@capacitor/status-bar";
import { isNativeRuntime } from "./runtime.js";

let initialized = false;

export async function initializeNativeShell() {
  if (!isNativeRuntime() || initialized) return;
  initialized = true;

  await Promise.allSettled([
    StatusBar.setOverlaysWebView({ overlay: false }),
    StatusBar.setBackgroundColor({ color: "#0D1B3D" }),
    StatusBar.setStyle({ style: Style.Light })
  ]);

  App.addListener("backButton", ({ canGoBack }) => {
    if (window.__pundiHandleNativeBack?.()) return;
    if (canGoBack && window.history.length > 1) {
      window.history.back();
      return;
    }
    App.exitApp();
  });

  document.addEventListener("click", event => {
    const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
    if (!anchor) return;
    const url = new URL(anchor.href, window.location.href);
    if (!["http:", "https:"].includes(url.protocol) || url.origin === window.location.origin) return;
    event.preventDefault();
    Browser.open({ url: url.href }).catch(() => { window.location.href = url.href; });
  }, { capture: true });
}
