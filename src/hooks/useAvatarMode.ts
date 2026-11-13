import { useCallback, useEffect, useState } from "react";
import { useUser, type User } from "@/contexts/UserContext";
import { supabase } from "@/integrations/supabase/client";

export type AvatarDisplayMode = "initials" | "photo";

const AVATAR_MODE_STORAGE_KEY = "app-avatar-mode";
const AVATAR_IMAGE_STORAGE_KEY = "app-avatar-image";
const AVATARS_BUCKET = "avatars";

function getModeKey(userId: string) {
  return `${AVATAR_MODE_STORAGE_KEY}:${userId}`;
}

function getImageKey(userId: string) {
  return `${AVATAR_IMAGE_STORAGE_KEY}:${userId}`;
}

export function getUserInitials(user: User | null | undefined): string {
  if (!user) return "??";
  if (user.role === "branch" && user.branchName) {
    const branchName = user.branchName.replace(/^farmacia\s+/i, "");
    return `F${branchName.charAt(0).toUpperCase()}`;
  }
  const names = (user.name || "").trim().split(/\s+/).filter(Boolean);
  if (names.length >= 2) {
    return (
      names[0].charAt(0) + names[names.length - 1].charAt(0)
    ).toUpperCase();
  }
  return (user.name || "U").charAt(0).toUpperCase();
}

export function useAvatarMode() {
  const { user, updateUser } = useUser();
  const userId = user?.id ?? null;

  const readStoredMode = useCallback((): AvatarDisplayMode => {
    if (!userId) return "initials";
    if (user?.avatarMode === "photo" || user?.avatarMode === "initials") {
      return user.avatarMode;
    }
    if (user?.avatarUrl) return "photo";
    if (user?.avatarUrl === null) return "initials";
    const scoped = localStorage.getItem(getModeKey(userId));
    if (scoped === "photo" || scoped === "initials") return scoped;
    return "initials";
  }, [userId, user?.avatarMode, user?.avatarUrl]);

  const readStoredImage = useCallback((): string | null => {
    if (!userId) return null;
    if (user?.avatarUrl) return user.avatarUrl;
    if (user?.avatarUrl === null) return null;
    const scoped = localStorage.getItem(getImageKey(userId));
    if (scoped && scoped.startsWith("http") && !scoped.includes(userId)) {
      return null;
    }
    return scoped || null;
  }, [userId, user?.avatarUrl]);

  const [avatarMode, setAvatarModeState] = useState<AvatarDisplayMode>(readStoredMode);
  const [avatarImage, setAvatarImageState] = useState<string | null>(readStoredImage);
  const [isUploading, setIsUploading] = useState(false);

  // Limpiar claves globales heredadas para que nunca se mezclen entre cuentas en la misma PC
  useEffect(() => {
    localStorage.removeItem(AVATAR_MODE_STORAGE_KEY);
    localStorage.removeItem(AVATAR_IMAGE_STORAGE_KEY);
  }, []);

  // Sincronizar cuando cambia el usuario logueado
  useEffect(() => {
    if (userId) {
      const modeKey = getModeKey(userId);
      const imageKey = getImageKey(userId);

      if (user?.avatarUrl) {
        localStorage.setItem(imageKey, user.avatarUrl);
      } else if (user?.avatarUrl === null) {
        localStorage.removeItem(imageKey);
      }

      if (user?.avatarMode === "photo" || user?.avatarMode === "initials") {
        localStorage.setItem(modeKey, user.avatarMode);
      } else if (!localStorage.getItem(modeKey)) {
        localStorage.setItem(modeKey, user?.avatarUrl ? "photo" : "initials");
      }
    }

    setAvatarImageState(readStoredImage());
    setAvatarModeState(readStoredMode());
  }, [userId, user?.avatarUrl, user?.avatarMode, readStoredImage, readStoredMode]);

  const setAvatarMode = useCallback(
    (mode: AvatarDisplayMode) => {
      setAvatarModeState(mode);
      if (userId) {
        localStorage.setItem(getModeKey(userId), mode);
      }
      updateUser({ avatarMode: mode });
      if (userId) {
        supabase
          .from("profiles")
          .update({ avatar_mode: mode })
          .eq("id", userId)
          .then(({ error }) => {
            if (error) {
              console.warn("[useAvatarMode] No se pudo guardar avatar_mode en Supabase:", error.message);
            }
          });
      }
      window.dispatchEvent(new Event("avatar-mode-change"));
    },
    [userId, updateUser]
  );

  const setAvatarImage = useCallback(
    (urlOrDataUrl: string | null) => {
      setAvatarImageState(urlOrDataUrl);
      if (userId) {
        const key = getImageKey(userId);
        if (urlOrDataUrl) {
          localStorage.setItem(key, urlOrDataUrl);
        } else {
          localStorage.removeItem(key);
        }
      }
      updateUser({ avatarUrl: urlOrDataUrl });
      window.dispatchEvent(new Event("avatar-mode-change"));
    },
    [userId, updateUser]
  );

  const uploadAvatar = useCallback(
    async (file: File): Promise<{ ok: boolean; syncedToCloud: boolean }> => {
      setIsUploading(true);
      try {
        if (userId) {
          const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
          const filePath = `${userId}/avatar.${ext}`;

          const { error: uploadError } = await supabase.storage
            .from(AVATARS_BUCKET)
            .upload(filePath, file, {
              upsert: true,
              contentType: file.type,
              cacheControl: "3600",
            });

          if (!uploadError) {
            const { data: pubData } = supabase.storage
              .from(AVATARS_BUCKET)
              .getPublicUrl(filePath);

            const publicUrl = `${pubData.publicUrl}?t=${Date.now()}`;

            const { error: profileError } = await supabase
              .from("profiles")
              .update({ avatar_url: publicUrl, avatar_mode: "photo" })
              .eq("id", userId);

            if (profileError) {
              console.warn("[useAvatarMode] Error guardando avatar_url en profiles:", profileError.message);
            }

            setAvatarImage(publicUrl);
            setAvatarMode("photo");
            return { ok: true, syncedToCloud: !profileError };
          } else {
            console.warn("[useAvatarMode] Falló subida a Storage, usando fallback local:", uploadError.message);
          }
        }

        // Fallback local (Data URL) aislado únicamente al userId actual
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (ev) => resolve((ev.target?.result as string) || "");
          reader.onerror = () => reject(new Error("Error leyendo archivo"));
          reader.readAsDataURL(file);
        });

        if (dataUrl) {
          setAvatarImage(dataUrl);
          setAvatarMode("photo");
          return { ok: true, syncedToCloud: false };
        }
        return { ok: false, syncedToCloud: false };
      } catch (err) {
        console.error("[useAvatarMode] Error al subir avatar:", err);
        return { ok: false, syncedToCloud: false };
      } finally {
        setIsUploading(false);
      }
    },
    [userId, setAvatarImage, setAvatarMode]
  );

  const removeAvatar = useCallback(async (): Promise<boolean> => {
    setIsUploading(true);
    try {
      setAvatarImage(null);
      if (userId) {
        const { data: files } = await supabase.storage
          .from(AVATARS_BUCKET)
          .list(userId);

        if (files && files.length > 0) {
          const paths = files.map((f) => `${userId}/${f.name}`);
          await supabase.storage.from(AVATARS_BUCKET).remove(paths);
        }

        await supabase
          .from("profiles")
          .update({ avatar_url: null })
          .eq("id", userId);
      }
      return true;
    } catch (err) {
      console.warn("[useAvatarMode] Error eliminando avatar en Supabase:", err);
      return false;
    } finally {
      setIsUploading(false);
    }
  }, [userId, setAvatarImage]);

  useEffect(() => {
    const handleSync = () => {
      setAvatarModeState(readStoredMode());
      setAvatarImageState(readStoredImage());
    };

    window.addEventListener("avatar-mode-change", handleSync);
    window.addEventListener("storage", handleSync);

    return () => {
      window.removeEventListener("avatar-mode-change", handleSync);
      window.removeEventListener("storage", handleSync);
    };
  }, [readStoredMode, readStoredImage]);

  return {
    avatarMode,
    setAvatarMode,
    avatarImage,
    setAvatarImage,
    uploadAvatar,
    removeAvatar,
    isUploading,
  };
}
