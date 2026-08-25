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

import { Capacitor } from "@capacitor/core";

// En APK nativo, arrancar directamente en el Colector de Datos
if (Capacitor.isNativePlatform() && !window.location.hash.startsWith('#/stock/pre-count')) {
  window.location.hash = '#/stock/pre-count';
}

const root = ReactDOM.createRoot(document.getElementById("root")!);
root.render(
  <React.StrictMode>
    <InstallPWAProvider>
      <App />
    </InstallPWAProvider>
  </React.StrictMode>
);

// Solo registrar el Service Worker si NO estamos en Tauri ni Capacitor
if (!Capacitor.isNativePlatform() && !isTauri) {
  register();
}
