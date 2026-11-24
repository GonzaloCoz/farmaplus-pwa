import { createContext, useContext, useState, useMemo } from "react";

type SidebarState = "expanded" | "collapsed";

interface SidebarContextProps {
  state: SidebarState;
  setState: (state: SidebarState) => void;
}

const SidebarContext = createContext<SidebarContextProps | undefined>(undefined);

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
}

export function SidebarProvider({ children, initialState = "expanded" }: { children: React.ReactNode; initialState?: SidebarState }) {
  const [state, setState] = useState<SidebarState>(initialState);

  const value = useMemo(() => ({ state, setState }), [state]);

  return (
    <SidebarContext.Provider value={value}>
      {children}
    </SidebarContext.Provider>
  );
}