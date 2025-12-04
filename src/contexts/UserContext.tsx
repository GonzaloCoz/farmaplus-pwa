import React, { createContext, useContext, useState, useEffect } from 'react';

export interface User {
    id: string;
    name: string;
    branchName: string;
    branchSheet: string; // The sheet name in lab_sucu.xlsx
}

interface UserContextType {
    user: User | null;
    login: (username: string) => Promise<boolean>;
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

    const login = async (username: string): Promise<boolean> => {
        // Simulación de login con mapeo de sucursales
        // En una app real, esto vendría del backend o de una configuración más robusta
        let newUser: User | null = null;

        const normalizedUser = username.toLowerCase().trim();

        if (normalizedUser === 'barracas') {
            newUser = {
                id: 'user_barracas',
                name: 'Farmacia Barracas',
                branchName: 'Barracas',
                branchSheet: 'Barracas'
            };
        } else if (normalizedUser === 'tribunales') {
            newUser = {
                id: 'user_tribunales',
                name: 'Farmacia Tribunales',
                branchName: 'Tribunales',
                branchSheet: 'Tribunales'
            };
        }

        if (newUser) {
            setUser(newUser);
            localStorage.setItem('farmaplus_user', JSON.stringify(newUser));
            return true;
        }

        return false;
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('farmaplus_user');
    };

    return (
        <UserContext.Provider value={{ user, login, logout, isLoading }}>
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
