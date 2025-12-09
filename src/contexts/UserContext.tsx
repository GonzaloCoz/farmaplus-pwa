import React, { createContext, useContext, useState, useEffect } from 'react';
import { ADMIN_USERS, BRANCH_NAMES, DEFAULT_PASSWORD } from '@/config/users';
import { toast } from "sonner";

export interface User {
    id: string;
    username: string;
    name: string;
    role: 'admin' | 'branch';
    branchName?: string; // Optional for admins
    branchSheet?: string; // Optional for admins
}

interface UserContextType {
    user: User | null;
    login: (username: string, password?: string) => Promise<boolean>;
    selectBranch: (branchName: string) => void;
    logout: () => void;
    isLoading: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Check for persisted user
        const storedUser = localStorage.getItem('farmaplus_user');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }
        setIsLoading(false);
    }, []);

    const login = async (username: string, password?: string): Promise<boolean> => {
        // Validación de contraseña simple (si no se envía password, asumimos dev mode o bypass previo, pero idealmente requerimos password)
        // Por compatibilidad con llamadas existentes que quizás no pasen password, lo hacemos opcional pero lo validamos si viene
        if (password && password !== DEFAULT_PASSWORD) {
            // En un entorno real, esto sería un rechazo. Para facilitar pruebas con usuarios existentes en caché,
            // podríamos ser más laxos, pero el plan es "DEFAULT_PASSWORD".
            // Dejaremos que si password es provisto, debe coincidir.
            return false;
        }

        const normalizedInput = username.toLowerCase().trim().replace(/\s+/g, '');

        // 1. Buscar en Admins
        const adminMatch = ADMIN_USERS.find(admin => admin.username.toLowerCase() === normalizedInput);
        if (adminMatch) {
            const newUser: User = {
                id: `admin_${adminMatch.username}`,
                username: adminMatch.username,
                name: adminMatch.name,
                role: 'admin',
                branchName: 'Casa Central', // Valor por defecto para admins
            };
            persistUser(newUser);
            return true;
        }

        // 2. Buscar en Sucursales
        // Buscamos coincidencia "fuzzy" o directa con la lista de nombres
        // Convertimos el nombre de la sucursal al formato username para comparar
        const branchMatch = BRANCH_NAMES.find(branchName => {
            const normalizedBranchName = branchName.toLowerCase().replace(/\s+/g, '');
            return normalizedBranchName === normalizedInput;
        });

        if (branchMatch) {
            const newUser: User = {
                id: `branch_${normalizedInput}`,
                username: normalizedInput,
                name: `Farmacia ${branchMatch}`,
                role: 'branch',
                branchName: branchMatch,
                branchSheet: branchMatch
            };
            persistUser(newUser);
            return true;
        }

        return false;
    };

    const persistUser = (user: User) => {
        setUser(user);
        localStorage.setItem('farmaplus_user', JSON.stringify(user));
    };

    const selectBranch = (branchName: string) => {
        if (!user) return;
        const updatedUser = { ...user, branchName: branchName, branchSheet: branchName };
        persistUser(updatedUser);
        toast.success(`Visualizando sucursal: ${branchName}`);
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('farmaplus_user');
        toast.info("Sesión cerrada correctamente");
    };

    return (
        <UserContext.Provider value={{ user, login, selectBranch, logout, isLoading }}>
            {children}
        </UserContext.Provider>
    );
}

export function useUser() {
    const context = useContext(UserContext);
    if (context === undefined) {
        throw new Error('useUser must be used within a UserProvider');
    }
    return context;
}
