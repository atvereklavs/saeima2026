import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";

// SITE_URL is the public origin used for canonical links and the sitemap.
// Default is the workers.dev URL until a custom domain is attached.
export default defineConfig({
  site: process.env.SITE_URL || "https://saeima2026.atvereklavs.workers.dev",
  output: "static",
  integrations: [react(), sitemap()],
  i18n: {
    defaultLocale: "lv",
    locales: ["lv", "en"],
    routing: { prefixDefaultLocale: false },
  },
  build: { inlineStylesheets: "auto" },
});
