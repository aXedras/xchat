import { useCallback, useEffect, useState } from "react";
import { rfqRepositoryV2 } from "@/services/persistence/rfqRepositoryV2";
import { MessagingError } from "@/services/persistence/errors";
import { TransactionTypeAvailability } from "@/types/rfq";

export function useAvailableTransactionTypes() {
  const [types, setTypes] = useState<TransactionTypeAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setTypes(await rfqRepositoryV2.listAvailableTransactionTypes());
      setError(null);
    } catch (e) {
      setError(e instanceof MessagingError ? e.code : "unknown");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { types, loading, error, refresh };
}
