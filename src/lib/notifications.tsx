import { toast } from "sonner";
import { NotificationToast, NotificationType } from "@/components/ui/NotificationToast";

interface NotifyOptions {
    duration?: number;
    action?: {
        label: string;
        onClick: () => void;
    };
}

const DEFAULT_DURATION = 5000;

const createNotify = (type: NotificationType) => (title: string, message?: string, options?: NotifyOptions) => {
    const duration = options?.duration || DEFAULT_DURATION;

    toast.custom((id) => (
        <NotificationToast
            id={id}
            type={type}
            title={title}
            message={message}
            onDismiss={toast.dismiss}
            duration={duration}
            action={options?.action}
        />
    ), {
        duration: Infinity, // Component handles dismissal
    });
};

export const notify = {
    success: createNotify("success"),
    error: createNotify("error"),
    warning: createNotify("warning"),
    info: createNotify("info"),
    dismiss: toast.dismiss,
};
