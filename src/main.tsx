import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ShapeProvider } from "./lib/shape-context.tsx";

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
