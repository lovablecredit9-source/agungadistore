import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// PWA: Guard against service worker in iframe/preview contexts
const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch (e) {
    return true;
  }
})();

const isPreviewHost =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com");

if (isPreviewHost || isInIframe) {
  // Unregister & purge caches in preview/iframe contexts
  navigator.serviceWorker?.getRegistrations().then((registrations) => {
    registrations.forEach((r) => r.unregister());
  });
  if ("caches" in window) {
    caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
  }
} else {
  // Production: auto-reload when a new service worker takes control
  // This prevents stale cached versions after publishing updates
  if ("serviceWorker" in navigator) {
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    // Listen for waiting service worker and activate immediately
    navigator.serviceWorker.ready.then((registration) => {
      const checkForUpdate = () => {
        registration.update().catch(() => {});
      };
      // Check for updates every 60 seconds
      setInterval(checkForUpdate, 60_000);
      // Check on focus/visibility change
      window.addEventListener("focus", checkForUpdate);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") checkForUpdate();
      });

      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        if (!newWorker) return;
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            // New version ready — activate it now (controllerchange will reload)
            newWorker.postMessage({ type: "SKIP_WAITING" });
          }
        });
      });
    });
  }
}

createRoot(document.getElementById("root")!).render(<App />);
