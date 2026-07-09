"use client";

import { Wifi, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";

export function ConnectionIndicator() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = (): void => {
      setOnline(navigator.onLine);
    };

    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);

    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return (
    <span aria-label={online ? "En ligne" : "Hors ligne"} role="status">
      {online ? (
        <Wifi className="size-5 text-emerald-500" />
      ) : (
        <WifiOff className="size-5 text-muted" />
      )}
    </span>
  );
}
