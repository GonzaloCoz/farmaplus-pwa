// Restaurar tema oscuro guardado
const savedTheme = localStorage.getItem("theme");
if (savedTheme === "dark") {
  document.documentElement.classList.add("dark");
}

import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { register } from "./registerServiceWorker.ts";
import { InstallPWAProvider } from "./contexts/InstallPWAContext.tsx";
import React from "react";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <InstallPWAProvider>
      <App />
    </InstallPWAProvider>
  </React.StrictMode>
);

register();
