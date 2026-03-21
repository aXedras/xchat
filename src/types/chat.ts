
export interface Chat {
  id: string;
  name: string;
  type?: "direct" | "group" | "broadcast";
  lastMessage: string;
  timestamp: string;
  unread: number;
  avatar?: string;
  companyName?: string;
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
  isMacro?: boolean;
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
export type QuoteRequestType = "ASK" | "RFQ";
export type QuoteRequestStatus = "draft" | "sent" | "open" | "expiring" | "expired" | "quoted" | "withdrawn" | "converted";
export type QuoteResponseStatus = "submitted" | "countered" | "accepted" | "rejected" | "withdrawn" | "expired";
export type TradeDealStatus = "draft" | "booked" | "settled" | "cancelled";

export interface AskMacroDetails {
  macroType: QuoteRequestType;
  quantity: string;
  product: string;
  productCode: string;
  productClass: ProductClass;
  quality: string;
  location: string;
  priceBasis: string;
  premium: string;
  ttl?: string;
  ttlSeconds?: number;
  fees?: string;
  vat?: string;
  notes?: string;
  terms: string;
}

export interface QuoteRequestTerms {
  quantity: string;
  product: string;
  productCode: string;
  productClass: ProductClass;
  quality: string;
  location: string;
  priceBasis: string;
  premium: string;
  fees?: string;
  vat?: string;
  notes?: string;
  rawTerms: string;
}

export interface QuoteRequest {
  id: string;
  chatId: string;
  sourceMessageId: string;
  type: QuoteRequestType;
  status: QuoteRequestStatus;
  requestedBy: string;
  requestedByEmail?: string;
  requestedFrom: string;
  createdAt: string;
  responseDeadline?: string;
  terms: QuoteRequestTerms;
}

export interface QuoteResponse {
  id: string;
  requestId: string;
  parentResponseId?: string;
  version: number;
  responder: string;
  responderEmail?: string;
  createdAt: string;
  status: QuoteResponseStatus;
  quotedPremium?: string;
  notes?: string;
}

export interface TradeDealTerms {
  priceReference: string;
  premium: string;
  incoterm: string;
  deliveryWindow: string;
  paymentTerms: string;
  settlementType: string;
  accountSettlement: string;
  documentation: string[];
  complianceFlags: ComplianceFlag[];
}

export interface GoldSilverTradeDealTerms extends TradeDealTerms {
  goodDeliveryStandard: string;
  barForm: string;
  vaultLocation: string;
  chainOfCustody: string;
}

export interface PlatinumPalladiumTradeDealTerms extends TradeDealTerms {
  lppmStatus: string;
  formFactor: string;
  assayCertificate: string;
  originDisclosure: string;
}

export interface TradeDeal {
  id: string;
  requestId: string;
  responseId?: string;
  responseVersion?: number;
  counterparty: string;
  bookedByEmail?: string;
  product: string;
  volume: string;
  createdAt: string;
  status: TradeDealStatus;
  terms: GoldSilverTradeDealTerms | PlatinumPalladiumTradeDealTerms | TradeDealTerms;
}

export interface CounterpartyRequest {
  id: string;
  date: string;
  summary: string;
  status: "open" | "quoted" | "won" | "lost";
  linkedDealId?: string;
}

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

export interface CounterpartyDealTerms {
  priceReference: string;
  premium: string;
  incoterm: string;
  deliveryWindow: string;
  paymentTerms: string;
  settlementType: string;
  accountSettlement: string;
  documentation: string[];
  complianceFlags: ComplianceFlag[];
}

export interface GoldSilverDealTerms extends CounterpartyDealTerms {
  goodDeliveryStandard: string;
  barForm: string;
  vaultLocation: string;
  chainOfCustody: string;
}

export interface PlatinumPalladiumDealTerms extends CounterpartyDealTerms {
  lppmStatus: string;
  formFactor: string;
  assayCertificate: string;
  originDisclosure: string;
}

export interface CounterpartyDeal {
  id: string;
  requestId: string;
  date: string;
  product: string;
  productClass: ProductClass;
  volume: string;
  outcome: string;
  terms: GoldSilverDealTerms | PlatinumPalladiumDealTerms | CounterpartyDealTerms;
}

export interface CounterpartyInsight {
  chatId: string;
  counterparty: string;
  company: string;
  kycStatus: "onboarded" | "in-review" | "not-onboarded";
  onboardingNote: string;
  requestHistory: CounterpartyRequest[];
  dealHistory: CounterpartyDeal[];
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
}
