import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ShapeProvider } from "./lib/shape-context.tsx";
import { CURRENT_APP_VERSION } from "./hooks/useAppVersion";

// Auto-purga de CacheStorage ante cambios de versión (preserva 100% localStorage e IndexedDB)
const LAST_BOOT_VERSION_KEY = "miplus_last_boot_version";
const lastVersion = localStorage.getItem(LAST_BOOT_VERSION_KEY);
if (lastVersion !== CURRENT_APP_VERSION) {
  if (typeof window !== "undefined" && "caches" in window) {
    caches.keys().then((keys) => {
      keys.forEach((key) => caches.delete(key));
    });
  }
  localStorage.setItem(LAST_BOOT_VERSION_KEY, CURRENT_APP_VERSION);
}

// Restaurar tema oscuro guardado
const savedTheme = localStorage.getItem("theme");
if (savedTheme === "dark") {
  document.documentElement.classList.add("dark");
}

// Restaurar tinte de color guardado
const savedTint = localStorage.getItem("app-tint");
if (savedTint && savedTint !== "neutral") {
  document.documentElement.setAttribute("data-tint", savedTint);
}

// Clase base para Desktop
document.documentElement.classList.add("is-tauri");

const root = ReactDOM.createRoot(document.getElementById("root")!);
root.render(
  <React.StrictMode>
    <ShapeProvider defaultShape="rounded">
      <App />
    </ShapeProvider>
  </React.StrictMode>
);
