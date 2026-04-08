import { useEffect, useState } from "react";

import { fetchJson } from "./api";


interface AiHealthStatus {
  status: string;
  provider: string;
  model: string;
  detail?: string;
}


export function useAiHealth() {
  const [health, setHealth] = useState<AiHealthStatus | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadHealth = async () => {
      try {
        const response = await fetchJson<AiHealthStatus>("/api/health/ai");
        if (!cancelled) {
          setHealth(response);
        }
      } catch {
        if (!cancelled) {
          setHealth({
            status: "offline",
            provider: "ollama",
            model: "unknown",
          });
        }
      }
    };

    void loadHealth();
    const intervalId = window.setInterval(loadHealth, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  return health;
}
