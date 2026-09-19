import {
  ComplianceProvider,
  ComplianceSnapshot,
  ComplianceStatus,
  CounterpartyCheckInput,
  ProviderHealth,
} from "./types";

/**
 * Deterministic mock compliance provider. Status is derived from a stable hash
 * of the subject organization id so results are reproducible, and never
 * defaults to `approved`.
 */
const STATUSES: ComplianceStatus[] = [
  "approved",
  "review_required",
  "blocked",
  "expired",
];

function hashCode(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function deterministicStatus(subjectOrganizationId: string): ComplianceStatus {
  return STATUSES[hashCode(subjectOrganizationId) % STATUSES.length];
}

const now = () => new Date().toISOString();

export class MockComplianceProvider implements ComplianceProvider {
  constructor(private readonly latencyMs = 5) {}

  async getCounterpartySnapshot(
    input: CounterpartyCheckInput,
  ): Promise<ComplianceSnapshot> {
    await new Promise((resolve) => setTimeout(resolve, this.latencyMs));
    const status = deterministicStatus(input.subjectOrganizationId);
    const eligible = status === "approved";
    return {
      subjectOrganizationId: input.subjectOrganizationId,
      viewerOrganizationId: input.viewerOrganizationId,
      provider: "mock",
      externalReference: `mock-${input.subjectOrganizationId}`,
      kycStatus: status,
      kysStatus: status,
      tradingEligibility: eligible,
      status,
      reasonCodes: eligible ? [] : [status],
      checkedAt: now(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      sourceHash: "mock",
    };
  }

  async health(): Promise<ProviderHealth> {
    return { ok: true, provider: "mock-compliance", latencyMs: this.latencyMs };
  }
}
