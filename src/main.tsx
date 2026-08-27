// Restaurar tema oscuro guardado
const savedTheme = localStorage.getItem("theme");
if (savedTheme === "dark") {
  document.documentElement.classList.add("dark");
}

// Detectar entorno Tauri Desktop
const isTauri = typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
if (isTauri) {
  document.documentElement.classList.add("is-tauri");
  // Si venimos de un navegador previo, limpiar cualquier service worker residual
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister();
      }
    });
  }
}

import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { register } from "./registerServiceWorker.ts";
import { InstallPWAProvider } from "./contexts/InstallPWAContext.tsx";
import React from "react";

// Normalizar rutas directas en la web para evitar duplicados como /solicitudes/#/solicitudes
if (typeof window !== 'undefined' && !isTauri) {
  const pathname = window.location.pathname;
  if (pathname && pathname !== '/' && !pathname.endsWith('index.html')) {
    const directPath = pathname;
    const currentHash = window.location.hash ? window.location.hash.replace(/^#/, '') : '';
    const targetRoute = currentHash || directPath;
    const cleanRoute = targetRoute.startsWith('/') ? targetRoute : `/${targetRoute}`;
    window.history.replaceState(null, '', `/#${cleanRoute}`);
  }
}

const root = ReactDOM.createRoot(document.getElementById("root")!);
root.render(
  <React.StrictMode>
    <InstallPWAProvider>
      <App />
    </InstallPWAProvider>
  </React.StrictMode>
);

// Solo registrar el Service Worker si NO estamos en Tauri Desktop
if (!isTauri) {
  register();
}
