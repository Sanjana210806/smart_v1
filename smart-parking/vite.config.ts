import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const port = Number(process.env.PORT || "5173");
// GitHub Pages project sites live at /repo-name/. Set VITE_BASE_PATH=repo-name in CI.
// Do NOT gate this on NODE_ENV — if NODE_ENV is unset when this file loads, base was "/" and
// deployed HTML pointed at /assets/... (404) instead of /smart_v1/assets/... (blank page).
const configuredBasePath = (process.env.VITE_BASE_PATH || "").trim();
const base = configuredBasePath
  ? `/${configuredBasePath.replace(/^\/+|\/+$/g, "")}/`
  : "/";

/** Lets you verify the API origin on GitHub Pages without searching minified JS (View page source → meta name="x-api-origin"). */
function apiOriginMetaPlugin() {
  return {
    name: "api-origin-meta",
    transformIndexHtml(html: string) {
      const raw = process.env.VITE_API_BASE_URL?.trim() ?? "";
      if (!raw) {
        return html.replace(
          "<head>",
          `<head>\n    <!-- Build: VITE_API_BASE_URL was empty — set it in GitHub Actions Variables before deploy. -->`,
        );
      }
      const safe = raw.replace(/[<>&'"]/g, "");
      return html.replace(
        "<head>",
        `<head>\n    <meta name="x-api-origin" content="${safe}" />`,
      );
    },
  };
}

export default defineConfig({
  base,
  plugins: [react(), tailwindcss(), apiOriginMetaPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(
        import.meta.dirname,
        "..",
        "..",
        "attached_assets",
      ),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
    proxy: {
      "/api": {
        target: process.env.VITE_API_BASE_URL || "http://localhost:8080",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});