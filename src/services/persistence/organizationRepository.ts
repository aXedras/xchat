import { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/services/supabase/client";
import { MessagingError, toMessagingError } from "./errors";
import {
  OrganizationRecord,
  TradingContext,
  TradingParticipant,
} from "@/types/trading";

function requireClient(): SupabaseClient {
  const client = getSupabaseBrowserClient();
  if (!client) {
    throw new MessagingError("unauthenticated");
  }
  return client;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function asFlags(value: unknown): Record<string, boolean> {
  if (typeof value !== "object" || value === null) {
    return {};
  }
  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(record).map(([key, enabled]) => [key, enabled === true]),
  );
}

function parseTradingContext(value: unknown): TradingContext {
  const record = (value ?? {}) as Record<string, unknown>;
  const membership = record.membership as Record<string, unknown> | null;
  return {
    userId: typeof record.userId === "string" ? record.userId : null,
    membership: membership
      ? {
          organizationId: String(membership.organizationId ?? ""),
          organizationName: String(membership.organizationName ?? ""),
          primaryUnitId:
            typeof membership.primaryUnitId === "string"
              ? membership.primaryUnitId
              : null,
          jobTitle:
            typeof membership.jobTitle === "string" ? membership.jobTitle : null,
          status: String(membership.status ?? ""),
        }
      : null,
    capabilities: asStringArray(record.capabilities),
    entitlements: asStringArray(record.entitlements),
    flags: asFlags(record.flags),
  };
}

function parseTradingParticipant(value: unknown): TradingParticipant {
  const record = value as Record<string, unknown>;
  return {
    userId: String(record.userId),
    displayName: String(record.displayName ?? ""),
    organizationId: String(record.organizationId ?? ""),
    organizationName: String(record.organizationName ?? ""),
    jobTitle: typeof record.jobTitle === "string" ? record.jobTitle : null,
    capabilities: asStringArray(record.capabilities),
  };
}

function parseOrganization(value: unknown): OrganizationRecord {
  const record = value as Record<string, unknown>;
  const capabilities = Array.isArray(record.capabilities)
    ? record.capabilities.map((c) => {
        const cap = c as Record<string, unknown>;
        return { code: String(cap.code), status: String(cap.status) };
      })
    : [];
  return {
    id: String(record.id),
    legalName: String(record.legalName ?? ""),
    displayName: String(record.displayName ?? ""),
    status: String(record.status ?? ""),
    jurisdictionCountryCode:
      typeof record.jurisdictionCountryCode === "string"
        ? record.jurisdictionCountryCode
        : null,
    capabilities,
    memberCount: typeof record.memberCount === "number" ? record.memberCount : 0,
  };
}

export const organizationRepository = {
  async getMyTradingContext(): Promise<TradingContext> {
    const client = requireClient();
    try {
      const { data, error } = await client.rpc("get_my_trading_context");
      if (error) {
        throw error;
      }
      return parseTradingContext(data);
    } catch (error) {
      throw toMessagingError(error);
    }
  },

  async listTradingParticipants(): Promise<TradingParticipant[]> {
    const client = requireClient();
    try {
      const { data, error } = await client.rpc("list_trading_participants");
      if (error) {
        throw error;
      }
      return Array.isArray(data) ? data.map(parseTradingParticipant) : [];
    } catch (error) {
      throw toMessagingError(error);
    }
  },

  async adminListOrganizations(): Promise<OrganizationRecord[]> {
    const client = requireClient();
    try {
      const { data, error } = await client.rpc("admin_list_organizations");
      if (error) {
        throw error;
      }
      return Array.isArray(data) ? data.map(parseOrganization) : [];
    } catch (error) {
      throw toMessagingError(error);
    }
  },

  async adminCreateOrganization(input: {
    legalName: string;
    displayName: string;
    registrationNumber: string | null;
    lei: string | null;
    jurisdictionCountryCode: string | null;
    status: string;
  }): Promise<void> {
    const client = requireClient();
    try {
      const { error } = await client.rpc("admin_create_organization", {
        p_legal_name: input.legalName,
        p_display_name: input.displayName,
        p_registration_number: input.registrationNumber,
        p_lei: input.lei,
        p_jurisdiction_country_code: input.jurisdictionCountryCode,
        p_status: input.status,
      });
      if (error) {
        throw error;
      }
    } catch (error) {
      throw toMessagingError(error);
    }
  },

  async adminSetOrganizationCapability(input: {
    organizationId: string;
    capabilityCode: string;
    status: string;
  }): Promise<void> {
    const client = requireClient();
    try {
      const { error } = await client.rpc("admin_set_organization_capability", {
        p_organization_id: input.organizationId,
        p_capability_code: input.capabilityCode,
        p_status: input.status,
      });
      if (error) {
        throw error;
      }
    } catch (error) {
      throw toMessagingError(error);
    }
  },
};
