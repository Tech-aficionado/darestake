/**
 * Service Worker Registration
 *
 * Registers the service worker in production or when on app pages.
 * Handles update detection and notifies the user when a new version is available.
 */

type SWUpdateCallback = (registration: ServiceWorkerRegistration) => void;

let updateCallback: SWUpdateCallback | null = null;

export function onSWUpdate(callback: SWUpdateCallback) {
  updateCallback = callback;
}

export function registerServiceWorker() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  // Registered on all pages unconditionally - notifications need the worker
  // available everywhere, not just on app routes.

  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
      });

      // Check for updates periodically (every 60 minutes)
      setInterval(
        () => {
          registration.update();
        },
        60 * 60 * 1000
      );

      // Handle updates
      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener("statechange", () => {
          if (
            newWorker.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            // New version available
            if (updateCallback) {
              updateCallback(registration);
            }
          }
        });
      });
    } catch (error) {
      console.error("SW registration failed:", error);
    }
  });
}

export function unregisterServiceWorker() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  navigator.serviceWorker.ready.then((registration) => {
    registration.unregister();
  });
}
