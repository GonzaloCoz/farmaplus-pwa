import { useState, useEffect, useCallback } from 'react';
import {
    checkPlexSession,
    getPlexBranchOperators,
    PlexSessionStatus,
    PlexOperatorVerification
} from '@/services/mysqlTauriBridge';

export function usePlexSession(branchName: string) {
    const [session, setSession] = useState<PlexSessionStatus>({
        running: false,
        logged_in: false,
        user: null,
        screen: null,
        pid: null,
        terminal: null,
        config_path: null,
    });
    const [operators, setOperators] = useState<PlexOperatorVerification[]>([]);
    const [selectedOperator, setSelectedOperator] = useState<PlexOperatorVerification | null>(null);
    const [isLoadingOperators, setIsLoadingOperators] = useState(false);

    // 1. Polling de detección de proceso Plex 25 en la máquina
    const check = useCallback(async () => {
        try {
            const currentSession = await checkPlexSession();
            setSession(currentSession);
        } catch (err) {
            console.error('Error in checkPlexSession polling:', err);
        }
    }, []);

    useEffect(() => {
        check();
        const interval = setInterval(check, 3000);
        return () => clearInterval(interval);
    }, [check]);

    // 2. Cargar operadores autorizados de la sucursal desde MySQL
    const loadOperators = useCallback(async () => {
        if (!branchName) return;
        setIsLoadingOperators(true);
        try {
            const ops = await getPlexBranchOperators(branchName);
            setOperators(ops);

            // Intentar recuperar el operador previamente seleccionado
            const savedOpId = localStorage.getItem('miplus_selected_operator_id');
            if (savedOpId) {
                const found = ops.find(o => String(o.id_usuario) === savedOpId);
                if (found) {
                    setSelectedOperator(found);
                    return;
                }
            }

            // Si hay un usuario en Config.ini, ver si coincide
            if (session.user) {
                const cfgMatch = ops.find(o => o.user_name.toUpperCase() === session.user?.toUpperCase());
                if (cfgMatch) {
                    setSelectedOperator(cfgMatch);
                    return;
                }
            }

            // Por defecto seleccionar el primero de la lista si no hay seleccionado
            if (ops.length > 0 && !selectedOperator) {
                setSelectedOperator(ops[0]);
            }
        } catch (err) {
            console.error('Error loading branch operators:', err);
        } finally {
            setIsLoadingOperators(false);
        }
    }, [branchName, session.user]);

    useEffect(() => {
        loadOperators();
    }, [branchName]);

    const handleSelectOperator = (op: PlexOperatorVerification | null) => {
        setSelectedOperator(op);
        if (op?.id_usuario) {
            localStorage.setItem('miplus_selected_operator_id', String(op.id_usuario));
        }
    };

    return {
        session,
        operators,
        selectedOperator,
        setSelectedOperator: handleSelectOperator,
        isLoadingOperators,
        isAuthorized: !!selectedOperator?.is_authorized,
        operator: selectedOperator, // compatibilidad hacia atrás
        refresh: check,
        reloadOperators: loadOperators,
    };
}

