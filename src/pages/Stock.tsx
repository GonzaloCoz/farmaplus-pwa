import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { ChevronRight as ArrowRight, Clock, Laptop01 as Laptop, Phone as Smartphone, Zap } from '@untitledui/icons';
import { ZebraIcon } from '@/components/icons/ZebraIcon';
import { PageLayout } from '@/components/layout/PageLayout';
import { useIsMobile } from '@/hooks/use-mobile';

export default function Stock() {
    const navigate = useNavigate();
    const isMobile = useIsMobile();

    const allOptions = [
        {
            title: 'Colector de Datos',
            badge: null,
            description: 'Una forma simple de contar productos, incluso sin internet. Escaneá rápido y sincronizá todo al final.',
            icon: ZebraIcon,
            path: '/stock/colector',
            color: 'primary',
            gradient: 'from-primary/20 to-primary/5',
            badgeClass: '',
            showOnMobile: true,
            showOnDesktop: true
        },
        {
            title: 'Colector de Datos',
            badge: 'ALPHA PREVIEW',
            badgeDesc: 'Plex Direct Sync',
            description: 'Nueva versión con conexión directa TCP a Plex (sin Excel), sesiones instantáneas por PIN y recuento en tiempo real.',
            icon: Zap,
            path: '/stock/colector-alpha',
            color: 'blue',
            gradient: 'from-blue-600/25 via-indigo-600/15 to-purple-600/5',
            borderClass: 'border-blue-500/30 hover:border-blue-500/60 shadow-blue-500/5',
            badgeClass: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
            showOnMobile: true,
            showOnDesktop: true
        },
        {
            title: 'Conectar Zebra a Recuento',
            badge: null,
            description: 'Ingresa el PIN de acceso para contar productos en una sesión de recuento guiada por la PC.',
            icon: Smartphone,
            path: '/stock/recuento-movil',
            color: 'primary',
            gradient: 'from-success/20 to-success/5',
            badgeClass: '',
            showOnMobile: true,
            showOnDesktop: false // Oculto en PC porque la app cliente está optimizada para la Zebra
        }
    ];

    const options = allOptions.filter(opt => isMobile ? opt.showOnMobile : opt.showOnDesktop);

    return (
        <PageLayout>

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
                            className={`h-full group relative overflow-hidden cursor-pointer transition-all hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] ${option.borderClass || ''}`}
                            onClick={() => navigate(option.path)}
                        >
                            {/* Gradiente de fondo */}
                            <div className={`absolute inset-0 bg-gradient-to-br ${option.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />

                            <div className="relative p-8 flex flex-col h-full">
                                {/* Encabezado de Tarjeta con Icono y Badge */}
                                <div className="mb-6 flex items-start justify-between">
                                    <div className="inline-flex p-4 bg-primary/10 rounded-xl group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300">
                                        <option.icon className="w-8 h-8" />
                                    </div>
                                    {option.badge && (
                                        <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full ${option.badgeClass}`}>
                                            {option.badge}
                                        </span>
                                    )}
                                </div>

                                {/* Contenido */}
                                <div className="space-y-3 flex-grow">
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-2xl font-semibold text-foreground group-hover:text-primary transition-colors">
                                            {option.title}
                                        </h2>
                                    </div>
                                    <p className="text-muted-foreground leading-relaxed text-sm">
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
            <Card className="p-6 bg-muted/30 border-border">
                <div className="flex items-start gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <ZebraIcon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h3 className="font-medium text-foreground mb-1">¿Qué es el Colector de Datos?</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Es una herramienta alternativa muy fácil de usar para contar mercadería en el depósito o salón.
                            Podés trabajar tranquilo aunque no tengas señal, y al terminar se guarda todo
                            automáticamente para que no pierdas ningún dato.
                        </p>
                    </div>
                </div>
            </Card>
        </PageLayout>
    );
}
