import { lingui } from "@lingui/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const BACKEND = process.env.BACKEND_URL ?? "http://localhost:3000";

export default defineConfig({
  plugins: [
    react(),
    lingui({ macroTransform: true }),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      pwaAssets: { config: true },
      manifest: {
        name: "MeteoWeb",
        short_name: "MeteoWeb",
        description: "Live camera and weather station",
        display: "standalone",
        start_url: "/",
        scope: "/",
        theme_color: "#0284c7",
        background_color: "#0b1220",
      },
      workbox: {
        // Shell only: readings and video must always come from the network.
        globPatterns: ["**/*.{html,js,css,svg,png,woff2}"],
        // Fira Code ships every script; the page only needs latin.
        globIgnores: ["**/*-{cyrillic,cyrillic-ext,greek,greek-ext,vietnamese}-*"],
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [],
      },
    }),
  ],
  server: {
    proxy: { "/api": { target: BACKEND, ws: true } },
  },
});
