import { useEffect, useMemo, useState } from "react";
import { QuoteRequest } from "@/types/chat";
import { formatRemainingTime, getCountdownTone } from "@/utils/askMacro";
import { deriveQuoteRequestStatus } from "@/utils/quoteRequest";

export function useQuoteRequestCountdown(quoteRequest?: QuoteRequest) {
  const expiryTime = useMemo(() => {
    if (!quoteRequest?.responseDeadline) {
      return undefined;
    }

    const timestamp = new Date(quoteRequest.responseDeadline).getTime();
    return Number.isNaN(timestamp) ? undefined : timestamp;
  }, [quoteRequest]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!expiryTime) {
      return;
    }

    const timer = globalThis.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => globalThis.clearInterval(timer);
  }, [expiryTime]);

  const remainingMs = expiryTime ? expiryTime - now : undefined;
  const requestStatus = quoteRequest ? deriveQuoteRequestStatus(quoteRequest, now) : "open";

  return {
    hasDeadline: expiryTime !== undefined,
    remainingMs,
    tone: getCountdownTone(remainingMs),
    label: expiryTime ? formatRemainingTime(expiryTime - now) : "No deadline",
    requestStatus,
    isExpired: requestStatus === "expired",
    isActionable: !["expired", "withdrawn", "converted"].includes(requestStatus),
    canRespond: ["open", "expiring", "sent"].includes(requestStatus),
    canConvert: requestStatus === "quoted",
  };
}