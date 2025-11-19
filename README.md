# Farmaplus - PWA de Gestión de Inventario

![Farmaplus Screenshot](https://lovable.dev/opengraph-image-p98pqg.png)

Una aplicación web progresiva (PWA) moderna y responsiva para la gestión de inventarios, diseñada para funcionar a la perfección tanto en dispositivos de escritorio como móviles, incluyendo terminales de escaneo profesionales.

**[Ver Demo en Vivo](https://gonzalocoz.github.io/farmaplus-pwa/)**

---

## ✨ Características Principales

- **Diseño Adaptativo:** Interfaz optimizada para una experiencia de usuario excepcional en cualquier tamaño de pantalla, desde móviles hasta monitores de escritorio anchos.
- **Progressive Web App (PWA):**
  - **Instalable:** Se puede añadir a la pantalla de inicio de cualquier dispositivo para una experiencia similar a la de una aplicación nativa.
  - **Soporte Offline:** Gracias al Service Worker, la aplicación puede funcionar incluso sin conexión a internet.
  - **Interfaz Limpia:** Se ejecuta en modo `standalone` para ocultar la interfaz del navegador.
- **Navegación Intuitiva:**
  - **Escritorio:** Una barra lateral minimalista con iconos y tooltips para un uso eficiente del espacio.
  - **Móvil:** Una barra de navegación inferior ergonómica, siguiendo las guías de Material Design 3.
- **Gestión de Inventario:**
  - Dashboard principal.
  - Importación de inventario.
  - Seguimiento de inventarios cíclicos.
  - Gestión de productos.
  - Generación de reportes.

## 🚀 Tecnologías Utilizadas

- **Framework:** React
- **Bundler:** Vite
- **Lenguaje:** TypeScript
- **Estilos:** Tailwind CSS
- **Componentes UI:** shadcn/ui
- **Iconos:** Lucide React
- **Enrutamiento:** React Router
- **Gestión de Estado (Servidor):** TanStack Query

## 🏁 Cómo Empezar

Sigue estos pasos para ejecutar el proyecto en tu máquina local.

### Prerrequisitos

- Node.js (versión 18 o superior)
- npm (o tu gestor de paquetes preferido)

### Instalación

1. **Clona el repositorio:**
   ```bash
   git clone https://github.com/GonzaloCoz/farmaplus-pwa.git
   ```

2. **Navega al directorio del proyecto:**
   ```bash
   cd farmaplus-pwa
   ```

3. **Instala las dependencias:**
   ```bash
   npm install
   ```

4. **Inicia el servidor de desarrollo:**
   ```bash
   npm run dev
   ```

Abre http://localhost:8080 en tu navegador para ver la aplicación.

## 📜 Scripts Disponibles

- `npm run dev`: Inicia el servidor de desarrollo.
- `npm run build`: Compila la aplicación para producción.
- `npm run preview`: Previsualiza la build de producción localmente.
- `npm run deploy`: Despliega la aplicación en GitHub Pages.