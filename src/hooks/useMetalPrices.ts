import { useEffect, useState } from "react";
import { fetchMetalPrices } from "@/services/marketDataService";
import { logger } from "@/services/logger";
import { MetalPrice } from "@/types/marketData";

const REFRESH_INTERVAL_MS = 15 * 60 * 1000;

export interface UseMetalPricesResult {
  prices: MetalPrice[];
  error: Error | null;
  isLoading: boolean;
}

export function useMetalPrices(): UseMetalPricesResult {
  const [prices, setPrices] = useState<MetalPrice[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let currentController: AbortController | null = null;

    const load = async () => {
      currentController?.abort();
      const controller = new AbortController();
      currentController = controller;

      setIsLoading(true);
      try {
        const result = await fetchMetalPrices(controller.signal);
        if (!active) {
          return;
        }
        setPrices(result);
        setError(null);
      } catch (err) {
        if (controller.signal.aborted) {
          return;
        }
        const normalized =
          err instanceof Error
            ? err
            : new Error("Metal price ticker: unknown error");
        logger.error("Metal price ticker: failed to load prices", {
          error: normalized,
        });
        if (active) {
          setError(normalized);
        }
      } finally {
        if (active && currentController === controller) {
          setIsLoading(false);
        }
      }
    };

    void load();

    const intervalId = window.setInterval(() => {
      void load();
    }, REFRESH_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void load();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      currentController?.abort();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return { prices, error, isLoading };
}
