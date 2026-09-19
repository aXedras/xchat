import { useCallback, useEffect, useState } from "react";
import { organizationRepository } from "@/services/persistence/organizationRepository";
import { messageRepository } from "@/services/persistence/messageRepository";
import { MessagingError } from "@/services/persistence/errors";
import { ParticipantRecord } from "@/types/chat";
import { useTradingContext } from "./useTradingContext";

export function useTradingParticipants() {
  const { context } = useTradingContext();
  const [participants, setParticipants] = useState<ParticipantRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      if (context?.flags?.tradingOrganizationsV2) {
        const list = await organizationRepository.listTradingParticipants();
        setParticipants(
          list.map((participant) => ({
            userId: participant.userId,
            displayName: participant.displayName,
            organization: participant.organizationName || null,
          })),
        );
      } else {
        setParticipants(await messageRepository.listParticipants());
      }
      setError(null);
    } catch (e) {
      setError(e instanceof MessagingError ? e.code : "unknown");
    } finally {
      setLoading(false);
    }
  }, [context]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { participants, loading, error, refresh };
}
