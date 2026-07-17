import { sileo } from "@/components/ui/sileo";

interface NotifyOptions {
    duration?: number;
    id?: string | number;
    description?: string;
    action?: {
        label: string;
        onClick: () => void;
    };
}

export const notify = {
    success: (title: string, message?: string, options?: NotifyOptions) => {
        return sileo.success({
            id: options?.id?.toString(),
            title,
            description: message || options?.description,
            duration: options?.duration,
            button: options?.action ? {
                title: options.action.label,
                onClick: options.action.onClick,
            } : undefined,
        });
    },
    error: (title: string, message?: string, options?: NotifyOptions) => {
        return sileo.error({
            id: options?.id?.toString(),
            title,
            description: message || options?.description,
            duration: options?.duration,
            button: options?.action ? {
                title: options.action.label,
                onClick: options.action.onClick,
            } : undefined,
        });
    },
    warning: (title: string, message?: string, options?: NotifyOptions) => {
        return sileo.warning({
            id: options?.id?.toString(),
            title,
            description: message || options?.description,
            duration: options?.duration,
            button: options?.action ? {
                title: options.action.label,
                onClick: options.action.onClick,
            } : undefined,
        });
    },
    info: (title: string, message?: string, options?: NotifyOptions) => {
        return sileo.info({
            id: options?.id?.toString(),
            title,
            description: message || options?.description,
            duration: options?.duration,
            button: options?.action ? {
                title: options.action.label,
                onClick: options.action.onClick,
            } : undefined,
        });
    },
    dismiss: (id?: string | number) => {
        if (id !== undefined) {
            sileo.dismiss(id.toString());
        } else {
            sileo.clear();
        }
    },
};
