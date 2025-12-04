import { useEffect } from 'react';
import { driver } from 'driver.js';
import "driver.js/dist/driver.css";
import { Button } from '@/components/ui/button';
import { HelpCircle } from 'lucide-react';

export function Onboarding() {
    const startTour = () => {
        const driverObj = driver({
            showProgress: true,
            steps: [
                {
                    element: '#diff-mode',
                    popover: {
                        title: 'Solo Diferencias',
                        description: 'Activa este interruptor para ver solo los productos que tienen diferencias entre el stock físico y el del sistema.',
                        side: "bottom",
                        align: 'start'
                    }
                },
                {
                    element: '[role="tablist"]',
                    popover: {
                        title: 'Pestañas de Estado',
                        description: 'Navega entre "Pendientes" y "Controlados" para organizar tu trabajo.',
                        side: "bottom",
                        align: 'start'
                    }
                },
                {
                    element: '.bg-card.relative', // Targeting the first card if possible, or generic selector
                    popover: {
                        title: 'Acciones Rápidas',
                        description: 'Desliza a la derecha para Confirmar/Editar o a la izquierda para reportar Diferencia/Revertir.',
                        side: "top",
                        align: 'start'
                    }
                },
                {
                    element: 'button:has(.lucide-save)',
                    popover: {
                        title: 'Finalizar Inventario',
                        description: 'Cuando termines, guarda el estado del inventario aquí.',
                        side: "left",
                        align: 'start'
                    }
                }
            ]
        });

        driverObj.drive();
    };

    // Check if first time
    useEffect(() => {
        const hasSeenTour = localStorage.getItem('has_seen_inventory_tour');
        if (!hasSeenTour) {
            // Small delay to ensure elements are rendered
            setTimeout(() => {
                startTour();
                localStorage.setItem('has_seen_inventory_tour', 'true');
            }, 1000);
        }
    }, []);

    return (
        <Button variant="ghost" size="icon" onClick={startTour} title="Ver Tutorial">
            <HelpCircle className="w-5 h-5" />
        </Button>
    );
}
