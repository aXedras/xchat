export type ComplianceStatus =
  | "approved"
  | "review_required"
  | "blocked"
  | "expired"
  | "unavailable";

export interface ProviderHealth {
  ok: boolean;
  provider: string;
  latencyMs: number;
  message?: string;
}

export interface CounterpartyCheckInput {
  subjectOrganizationId: string;
  viewerOrganizationId: string;
}

export interface ComplianceSnapshot {
  subjectOrganizationId: string;
  viewerOrganizationId: string;
  provider: string;
  externalReference: string;
  kycStatus: string;
  kysStatus: string;
  tradingEligibility: boolean;
  status: ComplianceStatus;
  reasonCodes: string[];
  checkedAt: string;
  expiresAt: string;
  sourceHash: string;
}

/**
 * Compliance port (bauplan section 12.1). The mock and any future
 * xComplianceFlow adapter implement the identical contract.
 */
export interface ComplianceProvider {
  getCounterpartySnapshot(
    input: CounterpartyCheckInput,
  ): Promise<ComplianceSnapshot>;
  health(): Promise<ProviderHealth>;
}
