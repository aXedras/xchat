import { useCallback, useRef, useState } from "react";
import { rfqRepositoryV2 } from "@/services/persistence/rfqRepositoryV2";
import { MessagingError } from "@/services/persistence/errors";
import { QuotationTermsV2 } from "@/schemas";

export function useQuoteResponseV2() {
  const [sending, setSending] = useState(false);
  const clientResponseIdRef = useRef<string | null>(null);

  const submit = useCallback(
    async (invitationId: string, terms: QuotationTermsV2): Promise<unknown> => {
      setSending(true);
      try {
        if (!clientResponseIdRef.current) {
          clientResponseIdRef.current = crypto.randomUUID();
        }
        const result = await rfqRepositoryV2.submitQuoteResponseV2({
          invitationId,
          clientResponseId: clientResponseIdRef.current,
          responseTerms: terms as unknown as Record<string, unknown>,
        });
        clientResponseIdRef.current = null;
        return result;
      } catch (error) {
        if (!(error instanceof MessagingError && error.retryable)) {
          clientResponseIdRef.current = null;
        }
        throw error;
      } finally {
        setSending(false);
      }
    },
    [],
  );

  const counter = useCallback(
    async (parentResponseId: string, terms: QuotationTermsV2): Promise<unknown> => {
      setSending(true);
      try {
        if (!clientResponseIdRef.current) {
          clientResponseIdRef.current = crypto.randomUUID();
        }
        const result = await rfqRepositoryV2.counterQuoteResponseV2({
          parentResponseId,
          clientResponseId: clientResponseIdRef.current,
          responseTerms: terms as unknown as Record<string, unknown>,
        });
        clientResponseIdRef.current = null;
        return result;
      } catch (error) {
        if (!(error instanceof MessagingError && error.retryable)) {
          clientResponseIdRef.current = null;
        }
        throw error;
      } finally {
        setSending(false);
      }
    },
    [],
  );

  return { sending, submit, counter };
}
