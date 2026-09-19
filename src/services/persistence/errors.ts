export class MessagingError extends Error {
  code: string;
  retryable: boolean;
  correlationId: string | null;

  constructor(code: string, retryable = false, correlationId: string | null = null) {
    super(code);
    this.name = "MessagingError";
    this.code = code;
    this.retryable = retryable;
    this.correlationId = correlationId;
  }
}

export function toMessagingError(error: unknown): MessagingError {
  if (error instanceof MessagingError) {
    return error;
  }

  const record = error as { message?: string; details?: string; code?: string };
  if (record?.details) {
    try {
      const details = JSON.parse(record.details) as {
        code?: string;
        correlationId?: string;
      };
      if (details?.code) {
        return new MessagingError(details.code, false, details.correlationId ?? null);
      }
    } catch {
      // fall through
    }
  }

  if (record?.code) {
    return new MessagingError(record.code, false);
  }

  // No structured server error: the outcome is ambiguous (transport/timeout).
  return new MessagingError("unknown", true);
}
