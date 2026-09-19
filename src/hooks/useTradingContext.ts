import { useCallback, useEffect, useState } from "react";
import { organizationRepository } from "@/services/persistence/organizationRepository";
import { MessagingError } from "@/services/persistence/errors";
import { TradingContext } from "@/types/trading";

let cachedContext: TradingContext | null = null;
let inFlight: Promise<TradingContext> | null = null;

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
    if (cachedContext === null) {
      void load();
    }
  }, [load]);

  return { context, loading, error, refresh: load };
}
