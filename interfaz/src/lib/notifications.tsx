import type { ReactNode } from "react";
import { sileo } from "@/components/ui/sileo";
import type { SileoPosition } from "@/components/ui/sileo/types";

interface NotifyOptions {
    duration?: number;
    id?: string | number;
    description?: string;
    position?: SileoPosition;
    icon?: ReactNode;
    action?: {
        label: string;
        onClick: () => void;
    };
}

function parseArgs(message?: string | NotifyOptions, options?: NotifyOptions): { description?: string; opts?: NotifyOptions } {
    if (typeof message === 'object' && message !== null) {
        return {
            description: (message as any).description,
            opts: message as NotifyOptions
        };
    }
    return {
        description: typeof message === 'string' ? message : undefined,
        opts: options
    };
}

export const notify = {
    success: (title: string, message?: string | NotifyOptions, options?: NotifyOptions) => {
        const { description, opts } = parseArgs(message, options);
        return sileo.success({
            id: opts?.id?.toString(),
            title,
            description: description || opts?.description,
            duration: opts?.duration,
            position: opts?.position,
            icon: opts?.icon,
            button: opts?.action ? {
                title: opts.action.label,
                onClick: opts.action.onClick,
            } : undefined,
        });
    },
    error: (title: string, message?: string | NotifyOptions, options?: NotifyOptions) => {
        const { description, opts } = parseArgs(message, options);
        return sileo.error({
            id: opts?.id?.toString(),
            title,
            description: description || opts?.description,
            duration: opts?.duration,
            position: opts?.position,
            icon: opts?.icon,
            button: opts?.action ? {
                title: opts.action.label,
                onClick: opts.action.onClick,
            } : undefined,
        });
    },
    warning: (title: string, message?: string | NotifyOptions, options?: NotifyOptions) => {
        const { description, opts } = parseArgs(message, options);
        return sileo.warning({
            id: opts?.id?.toString(),
            title,
            description: description || opts?.description,
            duration: opts?.duration,
            position: opts?.position,
            icon: opts?.icon,
            button: opts?.action ? {
                title: opts.action.label,
                onClick: opts.action.onClick,
            } : undefined,
        });
    },
    info: (title: string, message?: string | NotifyOptions, options?: NotifyOptions) => {
        const { description, opts } = parseArgs(message, options);
        return sileo.info({
            id: opts?.id?.toString(),
            title,
            description: description || opts?.description,
            duration: opts?.duration,
            position: opts?.position,
            icon: opts?.icon,
            button: opts?.action ? {
                title: opts.action.label,
                onClick: opts.action.onClick,
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

export const toast = notify;
export { sileo };
