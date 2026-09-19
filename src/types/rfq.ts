export interface TransactionTypeAvailability {
  code: string;
  available: boolean;
}

export interface RfqDispatchRecipient {
  requestedRecipientUserId: string;
  recipientUserId: string | null;
  status: "accepted" | "rejected";
  errorCode: string | null;
  messageId: string | null;
}

export interface RfqDispatchResult {
  ok: boolean;
  quoteRequestId: string;
  dispatch: {
    id: string;
    status: "completed" | "partial" | "failed";
    messages: Array<{ recipientUserId: string; message: Record<string, unknown> }>;
    recipients: RfqDispatchRecipient[];
  };
}

export interface RequesterInvitationEntry {
  invitationId: string;
  recipientUserId: string;
  recipientOrganizationId: string | null;
  status: string;
  deliveredAt: string | null;
  firstViewedAt: string | null;
  respondedAt: string | null;
  closedAt: string | null;
}

export interface RequesterRfqProjection {
  id: string;
  publicReference: string | null;
  transactionType: string | null;
  schemaVersion: number;
  status: string;
  effectiveStatus: string;
  responseDeadline: string | null;
  terms: Record<string, unknown>;
  createdAt: string;
  closedAt: string | null;
  closeReason: string | null;
  invitations: RequesterInvitationEntry[];
}

export interface RecipientInvitationProjection {
  invitationId: string;
  requestId: string;
  publicReference: string | null;
  transactionType: string | null;
  status: string;
  effectiveStatus: string;
  responseDeadline: string | null;
  terms: Record<string, unknown>;
  createdAt: string;
  deliveredAt: string | null;
  firstViewedAt: string | null;
  respondedAt: string | null;
}

export interface QuoteRequestValidationResult {
  ok: boolean;
  transactionType: string;
}
