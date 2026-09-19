import { useCallback, useRef, useState } from "react";
import { rfqRepositoryV2 } from "@/services/persistence/rfqRepositoryV2";
import { MessagingError } from "@/services/persistence/errors";
import { QuotationTermsV2 } from "@/schemas";

export function useQuoteResponseV2() {
  const [sending, setSending] = useState(false);
  const submitIdRef = useRef<string | null>(null);
  const counterIdRef = useRef<string | null>(null);

  const submit = useCallback(
    async (invitationId: string, terms: QuotationTermsV2): Promise<unknown> => {
      setSending(true);
      try {
        if (!submitIdRef.current) {
          submitIdRef.current = crypto.randomUUID();
        }
        const result = await rfqRepositoryV2.submitQuoteResponseV2({
          invitationId,
          clientResponseId: submitIdRef.current,
          responseTerms: terms as unknown as Record<string, unknown>,
        });
        submitIdRef.current = null;
        return result;
      } catch (error) {
        if (!(error instanceof MessagingError && error.retryable)) {
          submitIdRef.current = null;
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
        if (!counterIdRef.current) {
          counterIdRef.current = crypto.randomUUID();
        }
        const result = await rfqRepositoryV2.counterQuoteResponseV2({
          parentResponseId,
          clientResponseId: counterIdRef.current,
          responseTerms: terms as unknown as Record<string, unknown>,
        });
        counterIdRef.current = null;
        return result;
      } catch (error) {
        if (!(error instanceof MessagingError && error.retryable)) {
          counterIdRef.current = null;
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
