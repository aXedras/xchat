import { useCallback, useEffect, useState } from "react";
import { organizationRepository } from "@/services/persistence/organizationRepository";
import { authService } from "@/services/authService";
import { MessagingError } from "@/services/persistence/errors";
import { TradingContext } from "@/types/trading";

let cachedContext: TradingContext | null = null;
let cachedUserId: string | null = null;
let inFlight: Promise<TradingContext> | null = null;

export function invalidateTradingContext() {
  cachedContext = null;
  cachedUserId = null;
  inFlight = null;
}

export function useTradingContext() {
  const [context, setContext] = useState<TradingContext | null>(cachedContext);
  const [loading, setLoading] = useState(cachedContext === null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (!inFlight) {
        inFlight = organizationRepository.getMyTradingContext();
      }
      const result = await inFlight;
      cachedContext = result;
      cachedUserId = result.userId;
      inFlight = null;
      setContext(result);
      setError(null);
    } catch (e) {
      inFlight = null;
      setError(e instanceof MessagingError ? e.code : "unknown");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = authService.subscribeAppAuth((identity) => {
      const userId = identity?.userId ?? null;
      if (cachedUserId !== userId) {
        invalidateTradingContext();
        setContext(null);
        void load();
      }
    });
    if (cachedContext === null) {
      void load();
    }
    return unsubscribe;
  }, [load]);

  return { context, loading, error, refresh: load };
}
