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
    // Jangan hapus cache musik offline. Menghapus cache audio besar saat app
    // dibuka bisa membuat UI/player macet lama dan menghilangkan lagu offline.
    await Promise.all(keys.filter((key) => key !== "playlist-offline-v1").map((key) => caches.delete(key)));
  }
}

preventBfCacheStaleRestores();

createRoot(document.getElementById("root")!).render(<App />);

const cleanupLegacyPwa = () => { void clearLegacyPwaArtifacts(); };
if ("requestIdleCallback" in window) {
  window.requestIdleCallback(cleanupLegacyPwa, { timeout: 4000 });
} else {
  window.setTimeout(cleanupLegacyPwa, 1500);
}
