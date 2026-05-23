import { useEffect, useState } from "react";
import { useSettingsStore, resolveSurface } from "@/stores/settings-store";

/**
 * Returns 'mobile' | 'desktop'. Respects the user's device-mode setting
 * (auto / phone / computer) and falls back to a matchMedia query.
 */
export function useSurface(): "mobile" | "desktop" {
  const mode = useSettingsStore((s) => s.device.mode);
  const [surface, setSurface] = useState<"mobile" | "desktop">(() => resolveSurface(mode));

  useEffect(() => {
    setSurface(resolveSurface(mode));
    if (mode !== "auto" || typeof window === "undefined") return;
    const mql = window.matchMedia("(max-width: 768px)");
    const onChange = () => setSurface(mql.matches ? "mobile" : "desktop");
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [mode]);

  return surface;
}

export function useIsPhone() {
  return useSurface() === "mobile";
}
