export interface OrganizationMembership {
  organizationId: string;
  organizationName: string;
  primaryUnitId: string | null;
  jobTitle: string | null;
  status: string;
}

export interface TradingContext {
  userId: string | null;
  membership: OrganizationMembership | null;
  capabilities: string[];
  entitlements: string[];
  flags: Record<string, boolean>;
}

export interface TradingParticipant {
  userId: string;
  displayName: string;
  organizationId: string;
  organizationName: string;
  jobTitle: string | null;
  capabilities: string[];
}

export interface OrganizationCapabilityRecord {
  code: string;
  status: string;
}

export interface OrganizationRecord {
  id: string;
  legalName: string;
  displayName: string;
  status: string;
  jurisdictionCountryCode: string | null;
  capabilities: OrganizationCapabilityRecord[];
  memberCount: number;
}
