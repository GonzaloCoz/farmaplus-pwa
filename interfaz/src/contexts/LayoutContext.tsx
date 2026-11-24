import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

interface LayoutContextType {
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  toggleSidebar: () => void;
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined);

export function LayoutProvider({ children }: { children: React.ReactNode }) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const toggleSidebar = useCallback(() => {
    setIsSidebarCollapsed(prev => !prev);
  }, []);

  const value = useMemo(() => ({
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    toggleSidebar,
  }), [isSidebarCollapsed, toggleSidebar]);

  return (
    <LayoutContext.Provider value={value}>
      {children}
    </LayoutContext.Provider>
  );
}

export function useLayout() {
  const context = useContext(LayoutContext);
  if (!context) {
    return {
      isSidebarCollapsed: false,
      setIsSidebarCollapsed: () => {},
      toggleSidebar: () => {},
    };
  }
  return context;
}
