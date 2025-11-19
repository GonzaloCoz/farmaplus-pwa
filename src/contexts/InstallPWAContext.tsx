import React, { createContext, useContext, useEffect, useState } from "react";

/**
 * Interfaz para el evento `beforeinstallprompt`.
 * TypeScript no lo incluye por defecto, así que lo definimos aquí.
 */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface InstallPWAContextType {
  installPrompt: BeforeInstallPromptEvent | null;
  showInstallPrompt: () => void;
}

const InstallPWAContext = createContext<InstallPWAContextType | null>(null);

export const useInstallPWA = () => {
  const context = useContext(InstallPWAContext);
  if (!context) {
    throw new Error("useInstallPWA must be used within an InstallPWAProvider");
  }
  return context;
};

export const InstallPWAProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
    };
  }, []);

  const showInstallPrompt = () => {
    installPrompt?.prompt();
  };

  return (
    <InstallPWAContext.Provider value={{ installPrompt, showInstallPrompt }}>
      {children}
    </InstallPWAContext.Provider>
  );
};