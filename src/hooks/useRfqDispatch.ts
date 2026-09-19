import { useCallback, useRef, useState } from "react";
import { rfqRepositoryV2 } from "@/services/persistence/rfqRepositoryV2";
import { MessagingError } from "@/services/persistence/errors";
import { RfqTermsV2 } from "@/schemas";
import { RfqDispatchResult } from "@/types/rfq";

export function useRfqDispatch() {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<RfqDispatchResult | null>(null);
  const clientOperationIdRef = useRef<string | null>(null);

  const send = useCallback(
    async (
      terms: RfqTermsV2,
      recipientIds: string[],
      message: string,
    ): Promise<RfqDispatchResult | undefined> => {
      setSending(true);
      try {
        if (!clientOperationIdRef.current) {
          clientOperationIdRef.current = crypto.randomUUID();
        }
        const dispatchResult = await rfqRepositoryV2.createAndDispatch({
          clientOperationId: clientOperationIdRef.current,
          transactionType: terms.commercial.transactionType,
          terms,
          recipientIds,
          message,
        });
        clientOperationIdRef.current = null;
        setResult(dispatchResult);
        return dispatchResult;
      } catch (error) {
        // On an ambiguous (retryable) outcome the same clientOperationId is
        // reused so a retry replays idempotently without duplicates.
        if (!(error instanceof MessagingError && error.retryable)) {
          clientOperationIdRef.current = null;
        }
        throw error;
      } finally {
        setSending(false);
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setResult(null);
    clientOperationIdRef.current = null;
  }, []);

  return { sending, result, send, reset };
}
