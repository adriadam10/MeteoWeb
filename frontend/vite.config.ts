import { lingui } from "@lingui/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const BACKEND = process.env.BACKEND_URL ?? "http://localhost:3000";

export default defineConfig({
  plugins: [react(), lingui({ macroTransform: true }), tailwindcss()],
  test: { environment: "jsdom" },
  server: {
    proxy: {
      "/api": { target: BACKEND, ws: true },
      // Served by the backend so they follow the language (backend/src/meteoweb/pwa.py).
      "/manifest.webmanifest": BACKEND,
      "/offline": BACKEND,
    },
  },
});
