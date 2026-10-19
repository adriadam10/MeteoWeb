import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { initI18n } from "./lib/i18n";
import { registerServiceWorker } from "./lib/pwa";
import "./index.css";

const root = document.getElementById("root");
if (!root) throw new Error("#root missing from index.html");

registerServiceWorker();
await initI18n();
createRoot(root).render(
  <StrictMode>
    <I18nProvider i18n={i18n}>
      <App />
    </I18nProvider>
  </StrictMode>,
);
