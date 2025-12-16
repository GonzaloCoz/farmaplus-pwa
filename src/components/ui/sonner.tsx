import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import { useNotificationPreferences } from "@/contexts/NotificationPreferencesContext";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();
  const { preferences } = useNotificationPreferences();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position={preferences.position}
      expand={true}
      richColors={false}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: "group toast group-[.toaster]:bg-transparent group-[.toaster]:text-foreground group-[.toaster]:border-0 group-[.toaster]:shadow-none p-0",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
