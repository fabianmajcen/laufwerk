import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { isMockMode, seedFixturesIfNeeded } from "./dev/mockSync";

// Ask the platform not to evict IndexedDB (best-effort; native WebView app data
// is not subject to browser eviction anyway).
navigator.storage?.persist?.().catch(() => {});

if (isMockMode) {
  seedFixturesIfNeeded().catch((e) => console.error("[mock] seeding failed", e));
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
