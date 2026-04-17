import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

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

void clearLegacyPwaArtifacts().finally(() => {
  createRoot(document.getElementById("root")!).render(<App />);
});
