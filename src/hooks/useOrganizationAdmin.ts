import { useCallback, useEffect, useState } from "react";
import { organizationRepository } from "@/services/persistence/organizationRepository";
import { MessagingError } from "@/services/persistence/errors";
import { OrganizationRecord } from "@/types/trading";
import { useTradingContext } from "./useTradingContext";

export interface CreateOrganizationInput {
  legalName: string;
  displayName: string;
  registrationNumber: string | null;
  lei: string | null;
  jurisdictionCountryCode: string | null;
  status: string;
}

export type MutationResult = { ok: boolean; code?: string };

export function useOrganizationAdmin() {
  const { context } = useTradingContext();
  const [organizations, setOrganizations] = useState<OrganizationRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const canManage =
    context?.entitlements.includes("ORG_CAPABILITIES_MANAGE") ?? false;

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setOrganizations(await organizationRepository.adminListOrganizations());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createOrganization = useCallback(
    async (input: CreateOrganizationInput): Promise<MutationResult> => {
      try {
        await organizationRepository.adminCreateOrganization(input);
        return { ok: true };
      } catch (error) {
        return {
          ok: false,
          code: error instanceof MessagingError ? error.code : "unknown",
        };
      }
    },
    [],
  );

  const addCapability = useCallback(
    async (
      organizationId: string,
      capabilityCode: string,
    ): Promise<MutationResult> => {
      try {
        await organizationRepository.adminSetOrganizationCapability({
          organizationId,
          capabilityCode,
          status: "active",
        });
        return { ok: true };
      } catch (error) {
        return {
          ok: false,
          code: error instanceof MessagingError ? error.code : "unknown",
        };
      }
    },
    [],
  );

  return {
    organizations,
    loading,
    canManage,
    refresh,
    createOrganization,
    addCapability,
  };
}
