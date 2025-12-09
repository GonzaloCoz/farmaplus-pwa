import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { ClipboardList, Upload, ArrowRight, Clock } from 'lucide-react';

export default function Stock() {
    const navigate = useNavigate();

    const options = [
        {
            title: 'Pre-Conteo Sucursal',
            description: 'Realiza el conteo previo de productos antes de la auditoría. Funciona sin conexión.',
            icon: ClipboardList,
            path: '/stock/pre-count',
            color: 'primary',
            gradient: 'from-primary/20 to-primary/5',
        },
        {
            title: 'Control de Vencimientos',
            description: 'Registra lotes y fechas de vencimiento de productos para gestión de ofertas.',
            icon: Clock,
            path: '/stock/expiration-control',
            color: 'primary',
            gradient: 'from-primary/20 to-primary/5',
        },
        {
            title: 'Importar Inventario',
            description: 'Importa y analiza archivos Excel de inventario físico para detectar discrepancias.',
            icon: Upload,
            path: '/stock/import',
            color: 'primary',
            gradient: 'from-primary/20 to-primary/5',
        },
    ];

    return (
        <motion.div
            className="p-6 space-y-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
        >
            {/* Opciones */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {options.map((option, index) => (
                    <motion.div
                        key={option.path}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1, duration: 0.4 }}
                        className="h-full"
                    >
                        <Card
                            className="h-full group relative overflow-hidden cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
                            onClick={() => navigate(option.path)}
                        >
                            {/* Gradiente de fondo */}
                            <div className={`absolute inset-0 bg-gradient-to-br ${option.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />

                            <div className="relative p-8 flex flex-col h-full">
                                {/* Icono */}
                                <div className="mb-6">
                                    <div className="inline-flex p-4 bg-primary/10 rounded-2xl group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300">
                                        <option.icon className="w-8 h-8" />
                                    </div>
                                </div>

                                {/* Contenido */}
                                <div className="space-y-3 flex-grow">
                                    <h2 className="text-2xl font-semibold text-foreground group-hover:text-primary transition-colors">
                                        {option.title}
                                    </h2>
                                    <p className="text-muted-foreground leading-relaxed">
                                        {option.description}
                                    </p>
                                </div>

                                {/* Flecha */}
                                <div className="mt-6 flex items-center gap-2 text-primary font-medium">
                                    <span>Comenzar</span>
                                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                </div>
                            </div>
                        </Card>
                    </motion.div>
                ))}
            </div>

            {/* Info adicional */}
            <Card className="p-6 bg-muted/30">
                <div className="flex items-start gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <ClipboardList className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h3 className="font-medium text-foreground mb-2">¿Qué es el Pre-Conteo?</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            El Pre-Conteo permite a los empleados de las sucursales realizar un conteo previo de productos
                            antes de que llegue el equipo de auditoría. Esta herramienta funciona completamente sin conexión
                            a internet, ideal para depósitos con señal limitada. Los datos se sincronizan automáticamente
                            cuando se restaura la conexión.
                        </p>
                    </div>
                </div>
            </Card>
        </motion.div>
    );
}
