
export interface Chat {
  id: string;
  name: string;
  type?: "direct" | "group" | "broadcast";
  lastMessage: string;
  timestamp: string;
  unread: number;
  avatar?: string;
  companyName?: string;
  counterpartyUserId?: string;
  createdAt?: string;
  isGroup?: boolean;
  isCompany?: boolean;
  members?: string[];
  participantEmails?: string[];
  isTyping?: boolean;
}

export interface ConversationMember {
  chatId: string;
  displayName?: string;
  email: string;
  role: "owner" | "member";
}

export interface Message {
  id: string;
  content: string;
  sender: string;
  senderEmail?: string;
  timestamp: string;
  createdAt?: string;
  quoteRequestId?: string;
  status: "sent" | "delivered" | "read";
  isMine: boolean;
  type?: MessageType;
}

export type UpdateChatListEntry = (
  chatId: string,
  content: string,
  timestamp: string,
  createdAt?: string,
) => void;

export type AddMessageBase = (
  chatId: string,
  content: string,
  isArchived: boolean,
  restoreChat?: (chatId: string) => void,
  updateChatList?: UpdateChatListEntry,
  messageOverrides?: Partial<Message>,
) => void;

export type ProductClass = "gold" | "silver" | "platinum" | "palladium" | "other";
export type FeeRuleType = "percent" | "bps" | "fixed";

export interface ComplianceFlag {
  label: string;
  severity: "positive" | "warning" | "critical";
}

export interface FeeRule {
  id: string;
  label: string;
  type: FeeRuleType;
  value: number;
  priority: number;
  currency?: string;
  productClass: ProductClass | "all";
  minimumQuantity?: number;
  validFrom?: string;
  validTo?: string;
  active: boolean;
}

export interface CustomerFeeProfile {
  company: string;
  rules: FeeRule[];
}

export interface User {
  id: string;
  name: string;
  role: string;
}

export interface Company {
  id: string;
  name: string;
  location: string;
  type: string;
  users: User[];
  source?: "seed" | "admin";
  registrationStatus?: "active";
  createdAt?: string;
}

export interface ParticipantRecord {
  userId: string;
  displayName: string;
  organization: string | null;
}

export interface ConversationRecord {
  id: string;
  participantLowUserId: string;
  participantHighUserId: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string | null;
}

export type MessageType = "standard" | "rfq";

export interface RfqTerms {
  quantity: string;
  product: string;
  productCode: string;
  productClass: ProductClass;
  quality: string;
  location: string;
  priceBasis: string;
  premium: string;
  fees: string | null;
  vat: string | null;
  notes: string | null;
  rawTerms: string;
  responseTtlSeconds: number | null;
}

export interface MessageRecord {
  id: string;
  conversationId: string;
  senderUserId: string;
  recipientUserId: string;
  type: MessageType;
  content: string;
  createdAt: string;
  quoteRequestId?: string | null;
}

export type DispatchStatus = "completed" | "partial" | "failed";

export interface MessageDispatchRecord {
  id: string;
  senderUserId: string;
  messageType: MessageType;
  content: string;
  status: DispatchStatus;
  createdAt: string;
  quoteRequestId?: string | null;
}

export type DispatchRecipientStatus = "accepted" | "rejected";
export type DispatchRecipientErrorCode = "recipient_not_found" | "self_recipient";

export interface DispatchRecipientRecord {
  dispatchId: string;
  requestedRecipientUserId: string;
  recipientUserId: string | null;
  status: DispatchRecipientStatus;
  errorCode: DispatchRecipientErrorCode | null;
  messageId: string | null;
}

export interface SendMessagesResult {
  ok: boolean;
  dispatch: {
    id: string;
    status: DispatchStatus;
    messages: Array<{ recipientUserId: string; message: MessageRecord }>;
    recipients: DispatchRecipientRecord[];
  };
}

export interface MessagesPage {
  messages: MessageRecord[];
  nextCursor: { createdAt: string; id: string } | null;
}

export type QuoteRequestStatus = "open" | "converted";
export type EffectiveQuoteStatus = "open" | "expired" | "converted";
export type QuoteResponseStatus = "submitted" | "countered";
export type QuoteResponseDecision = "accepted" | "rejected" | null;

export interface QuoteRequestRecord {
  id: string;
  ownerUserId: string;
  terms: Record<string, unknown>;
  status: QuoteRequestStatus;
  responseDeadline: string | null;
  createdAt: string;
}

export interface QuoteInvitationRecord {
  id: string;
  requestId: string;
  recipientUserId: string;
  ownerUserId: string;
  conversationId: string;
  messageId: string;
  createdAt: string;
  effectiveStatus: EffectiveQuoteStatus;
  terms: Record<string, unknown>;
}

export interface QuoteResponseRecord {
  id: string;
  invitationId: string;
  parentResponseId: string | null;
  responderUserId: string;
  createdAt: string;
  status: QuoteResponseStatus;
  decision: QuoteResponseDecision;
  quotedPremium: string;
  notes: string | null;
  allowedActions: Array<"counter" | "reject" | "book">;
}

export interface TradeDealRecord {
  id: string;
  requestId: string;
  responseId: string;
  counterpartyUserId: string;
  bookedByUserId: string;
  product: string;
  volume: string;
  createdAt: string;
  status: "booked";
  commercialTermsSnapshot: Record<string, unknown>;
}
