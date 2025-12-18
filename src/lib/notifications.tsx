import { toast } from "sonner";
import { NotificationToast, NotificationType } from "@/components/ui/NotificationToast";

interface NotifyOptions {
    duration?: number;
    id?: string | number;
    description?: string;
    action?: {
        label: string;
        onClick: () => void;
    };
}

const DEFAULT_DURATION = 5000;

const createNotify = (type: NotificationType) => (title: string, message?: string, options?: NotifyOptions) => {
    const duration = options?.duration || DEFAULT_DURATION;
    const finalMessage = [message, options?.description].filter(Boolean).join('\n\n');

    toast.custom((id) => (
        <NotificationToast
            id={id}
            type={type}
            title={title}
            message={finalMessage}
            onDismiss={(id) => toast.dismiss(id)}
            duration={duration}
            action={options?.action}
        />
    ), {
        duration: Infinity, // Component handles dismissal
        id: options?.id,
    });
};

export const notify = {
    success: createNotify("success"),
    error: createNotify("error"),
    warning: createNotify("warning"),
    info: createNotify("info"),
    dismiss: toast.dismiss,
};
