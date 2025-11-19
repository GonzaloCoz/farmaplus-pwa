import { useEffect } from "react";

/**
 * Un hook personalizado para escuchar los eventos de los gatillos
 * de un dispositivo Zebra y ejecutar una acción.
 * @param onScan - La función a ejecutar cuando se presiona un gatillo.
 */
export function useZebraScanner(onScan: () => void) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Comprueba si la tecla presionada es uno de los gatillos de Zebra
      if (
        event.key === "Right_trigger_1" ||
        event.key === "Left_trigger_2"
      ) {
        // Previene cualquier comportamiento por defecto del navegador
        event.preventDefault();
        // Ejecuta la función de escaneo proporcionada
        onScan();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    // Limpia el event listener cuando el componente se desmonta
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onScan]); // El efecto se vuelve a ejecutar si la función onScan cambia
}