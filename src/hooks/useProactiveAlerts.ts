import { useState, useEffect } from "react";
import { proactiveAlertService, ProactiveAlert } from "@/services/proactiveAlertService";

export function useProactiveAlerts(branchName?: string | null) {
  const [alert, setAlert] = useState<ProactiveAlert | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!branchName) return;

    // Check if an alert was already triggered in this session
    const hasTriggered = sessionStorage.getItem("proactive_alert_triggered");
    if (hasTriggered) return;

    const fetchAlerts = async () => {
      setIsLoading(true);
      try {
        const detectedAlert = await proactiveAlertService.checkAlerts(branchName);
        if (detectedAlert) {
          setAlert(detectedAlert);
          // Mark as triggered so we don't fetch or display it again in this session
          sessionStorage.setItem("proactive_alert_triggered", "true");
        }
      } catch (err) {
        console.error("Error fetching proactive alerts:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAlerts();
  }, [branchName]);

  const dismissAlert = () => {
    setAlert(null);
  };

  return {
    alert,
    isLoading,
    dismissAlert
  };
}
