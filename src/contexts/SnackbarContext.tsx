import React, { createContext, useContext, useState, useCallback } from "react";
import { Snackbar, SnackbarProps } from "@/components/Snackbar";

interface SnackbarContextType {
    showSnackbar: (props: Omit<SnackbarProps, "open" | "onClose">) => void;
}

const SnackbarContext = createContext<SnackbarContextType | undefined>(
    undefined
);

export function useSnackbar() {
    const context = useContext(SnackbarContext);
    if (!context) {
        throw new Error("useSnackbar must be used within SnackbarProvider");
    }
    return context;
}

interface QueuedSnackbar extends Omit<SnackbarProps, "open" | "onClose"> {
    id: string;
}

export function SnackbarProvider({ children }: { children: React.ReactNode }) {
    const [snackbars, setSnackbars] = useState<QueuedSnackbar[]>([]);
    const [currentSnackbar, setCurrentSnackbar] =
        useState<QueuedSnackbar | null>(null);

    const showSnackbar = useCallback(
        (props: Omit<SnackbarProps, "open" | "onClose">) => {
            const id = Math.random().toString(36).substring(7);
            const newSnackbar = { ...props, id };

            if (!currentSnackbar) {
                setCurrentSnackbar(newSnackbar);
            } else {
                setSnackbars((prev) => [...prev, newSnackbar]);
            }
        },
        [currentSnackbar]
    );

    const handleClose = useCallback(() => {
        setCurrentSnackbar(null);
        // Show next snackbar after a short delay
        setTimeout(() => {
            setSnackbars((prev) => {
                if (prev.length > 0) {
                    setCurrentSnackbar(prev[0]);
                    return prev.slice(1);
                }
                return prev;
            });
        }, 200);
    }, []);

    return (
        <SnackbarContext.Provider value={{ showSnackbar }}>
            {children}
            {currentSnackbar && (
                <Snackbar
                    {...currentSnackbar}
                    open={true}
                    onClose={handleClose}
                />
            )}
        </SnackbarContext.Provider>
    );
}
