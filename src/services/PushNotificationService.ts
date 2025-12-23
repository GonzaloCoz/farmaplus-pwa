/**
 * Servicio centralizado para gestionar notificaciones push
 */

export interface NotificationOptions {
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    tag?: string;
    data?: any;
}

class NotificationService {
    private static instance: NotificationService;

    private constructor() { }

    static getInstance(): NotificationService {
        if (!NotificationService.instance) {
            NotificationService.instance = new NotificationService();
        }
        return NotificationService.instance;
    }

    /**
     * Verifica si las notificaciones están soportadas
     */
    isSupported(): boolean {
        return 'Notification' in window && 'serviceWorker' in navigator;
    }

    /**
     * Obtiene el estado actual de los permisos
     */
    getPermissionStatus(): NotificationPermission {
        if (!this.isSupported()) return 'denied';
        return Notification.permission;
    }

    /**
     * Solicita permisos para mostrar notificaciones
     */
    async requestPermission(): Promise<NotificationPermission> {
        if (!this.isSupported()) {
            console.warn('Notificaciones no soportadas en este navegador');
            return 'denied';
        }

        if (Notification.permission === 'granted') {
            return 'granted';
        }

        if (Notification.permission !== 'denied') {
            const permission = await Notification.requestPermission();
            return permission;
        }

        return Notification.permission;
    }

    /**
     * Muestra una notificación local
     */
    async showNotification(options: NotificationOptions): Promise<void> {
        const permission = await this.requestPermission();

        if (permission !== 'granted') {
            console.warn('Permiso de notificaciones denegado');
            return;
        }

        const defaultOptions = {
            icon: '/logo.png',
            badge: '/logo.png',
            vibrate: [200, 100, 200],
            ...options,
        };

        // Si hay service worker registrado, usar showNotification
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            const registration = await navigator.serviceWorker.ready;
            await registration.showNotification(options.title, defaultOptions);
        } else {
            // Fallback a Notification API básica
            new Notification(options.title, defaultOptions);
        }
    }

    /**
     * Programa una notificación para un evento del calendario
     */
    scheduleEventNotification(eventDate: Date, eventTitle: string, eventId: string): void {
        const now = new Date();
        const daysUntilEvent = Math.floor((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        // Notificar 3 días antes
        if (daysUntilEvent === 3) {
            this.showNotification({
                title: '📅 Evento próximo',
                body: `${eventTitle} - En 3 días`,
                tag: `event-${eventId}-3days`,
                data: { eventId, type: 'event-reminder' },
            });
        }

        // Notificar 1 día antes
        if (daysUntilEvent === 1) {
            this.showNotification({
                title: '⚠️ Evento mañana',
                body: `${eventTitle} - Mañana`,
                tag: `event-${eventId}-1day`,
                data: { eventId, type: 'event-reminder' },
            });
        }

        // Notificar el mismo día
        if (daysUntilEvent === 0) {
            this.showNotification({
                title: '🔔 Evento hoy',
                body: `${eventTitle} - Hoy`,
                tag: `event-${eventId}-today`,
                data: { eventId, type: 'event-reminder' },
            });
        }
    }

    /**
     * Notificación de discrepancia importante en inventario
     */
    async notifyDiscrepancy(productName: string, difference: number): Promise<void> {
        await this.showNotification({
            title: '⚠️ Discrepancia importante',
            body: `${productName}: Diferencia de ${difference} unidades`,
            tag: 'inventory-discrepancy',
            data: { type: 'discrepancy', productName, difference },
        });
    }

    /**
     * Notificación de inventario próximo
     */
    async notifyUpcomingInventory(branch: string, sector: string, date: Date): Promise<void> {
        const dateStr = date.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' });
        await this.showNotification({
            title: '📋 Inventario programado',
            body: `${branch} - ${sector} el ${dateStr}`,
            tag: 'upcoming-inventory',
            data: { type: 'inventory-reminder', branch, sector, date: date.toISOString() },
        });
    }
}

export const notificationService = NotificationService.getInstance();
