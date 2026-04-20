import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setBaseUrl } from "@/lib/api-client";

/**
 * GitHub Pages serves only static files. Path URLs like /repo/login 404 because no file exists.
 * This app uses hash routing (e.g. /repo/#/login). If someone opens /repo/login, send them to /repo/#/login.
 */
function redirectPathOnlyUrlToHash(): void {
  if (!import.meta.env.PROD || typeof window === "undefined") return;
  if (window.location.hash) return;

  const baseUrl = import.meta.env.BASE_URL || "/";
  const normalizedBase = baseUrl.replace(/\/$/, "") || "";
  if (!normalizedBase || normalizedBase === "/") return;

  const path = window.location.pathname;
  if (path !== normalizedBase && path !== `${normalizedBase}/` && !path.startsWith(`${normalizedBase}/`)) {
    return;
  }

  const suffix =
    path === normalizedBase || path === `${normalizedBase}/`
      ? "/"
      : path.slice(normalizedBase.length) || "/";

  if (suffix === "/") return;

  const hashPath = suffix.startsWith("/") ? suffix : `/${suffix}`;
  window.location.replace(
    `${window.location.origin}${normalizedBase}/#${hashPath}${window.location.search}`,
  );
}

redirectPathOnlyUrlToHash();

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() ?? "";

if (apiBaseUrl) {
  setBaseUrl(apiBaseUrl);
}

if (import.meta.env.PROD && apiBaseUrl) {
  console.info("[Smart Parking] API origin:", apiBaseUrl);
}

createRoot(document.getElementById("root")!).render(<App />);
