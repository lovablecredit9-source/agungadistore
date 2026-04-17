import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

function preventBfCacheStaleRestores() {
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
      window.location.reload();
    }
  });
}

async function clearLegacyPwaArtifacts() {
  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  }

  if ("caches" in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  }
}

preventBfCacheStaleRestores();

void clearLegacyPwaArtifacts().finally(() => {
  createRoot(document.getElementById("root")!).render(<App />);
});
