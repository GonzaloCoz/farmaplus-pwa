// Restaurar tema oscuro guardado
const savedTheme = localStorage.getItem("theme");
if (savedTheme === "dark") {
  document.documentElement.classList.add("dark");
}

// Registrar clase si estamos en Electron
const isElectron = typeof window !== 'undefined' && !!(window as any).electronAPI;
if (isElectron) {
  document.documentElement.classList.add("is-electron");
}

import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { register } from "./registerServiceWorker.ts";
import { InstallPWAProvider } from "./contexts/InstallPWAContext.tsx";
import React from "react";

import { Capacitor } from "@capacitor/core";

const root = ReactDOM.createRoot(document.getElementById("root")!);
root.render(
  <React.StrictMode>
    <InstallPWAProvider>
      <App />
    </InstallPWAProvider>
  </React.StrictMode>
);

// Solo registrar el Service Worker si NO estamos en una plataforma nativa (iOS/Android Capacitor)
// Esto evita conflictos con el esquema interno de Capacitor y mejora la compatibilidad
if (!Capacitor.isNativePlatform()) {
  register();
}
