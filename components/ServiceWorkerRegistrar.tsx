"use client";

import { useEffect } from "react";

/**
 * Registers public/sw.js. Mounted once inside each installable route group
 * (member and check) rather than at the root, so the landing page does not
 * install a worker for a visitor who never opens the app.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // A failed registration must never break the page. The app works
        // online without it; offline support is the only thing lost.
      });
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}
