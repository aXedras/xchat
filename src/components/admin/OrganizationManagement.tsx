import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useOrganizationAdmin } from "@/hooks/useOrganizationAdmin";

const CAPABILITY_CODES = [
  "MINE_OPERATOR",
  "CPP",
  "REFINER",
  "TRADER",
  "DEALER",
  "BANK",
  "VAULT",
  "FABRICATOR",
  "MINT",
  "LOGISTICS_PROVIDER",
  "INVESTOR",
  "AUDITOR",
  "OTHER",
];

const EMPTY_FORM = {
  legalName: "",
  displayName: "",
  jurisdiction: "",
  status: "active",
};

const OrganizationManagement = () => {
  const { t } = useTranslation();
  const {
    organizations,
    loading,
    canManage,
    refresh,
    createOrganization,
    addCapability,
  } = useOrganizationAdmin();
  const [form, setForm] = useState(EMPTY_FORM);
  const [capabilitySelections, setCapabilitySelections] = useState<
    Record<string, string>
  >({});

  const handleCreate = async () => {
    const result = await createOrganization({
      legalName: form.legalName.trim(),
      displayName: form.displayName.trim(),
      registrationNumber: null,
      lei: null,
      jurisdictionCountryCode: form.jurisdiction.trim() || null,
      status: form.status,
    });
    if (result.ok) {
      toast.success(t("adminOrg.created"));
      setForm(EMPTY_FORM);
      await refresh();
    } else {
      toast.error(result.code ?? t("adminOrg.createFailed"));
    }
  };

  const handleAddCapability = async (organizationId: string) => {
    const code = capabilitySelections[organizationId];
    if (!code) {
      return;
    }
    const result = await addCapability(organizationId, code);
    if (result.ok) {
      toast.success(t("adminOrg.capabilityAdded"));
      setCapabilitySelections((previous) => ({
        ...previous,
        [organizationId]: "",
      }));
      await refresh();
    } else {
      toast.error(result.code ?? t("adminOrg.capabilityFailed"));
    }
  };

  const canSubmit =
    form.legalName.trim().length > 0 && form.displayName.trim().length > 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("adminOrg.createTitle")}</CardTitle>
          <CardDescription>{t("adminOrg.createDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="legalName">{t("adminOrg.legalName")}</Label>
              <Input
                id="legalName"
                value={form.legalName}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    legalName: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="displayName">{t("adminOrg.displayName")}</Label>
              <Input
                id="displayName"
                value={form.displayName}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    displayName: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jurisdiction">
                {t("adminOrg.jurisdiction")}
              </Label>
              <Input
                id="jurisdiction"
                maxLength={2}
                placeholder="CH"
                value={form.jurisdiction}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    jurisdiction: event.target.value.toUpperCase(),
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">{t("adminOrg.status")}</Label>
              <Select
                value={form.status}
                onValueChange={(value) =>
                  setForm((current) => ({ ...current, status: value }))
                }
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{t("adminOrg.statusActive")}</SelectItem>
                  <SelectItem value="pending">{t("adminOrg.statusPending")}</SelectItem>
                  <SelectItem value="suspended">{t("adminOrg.statusSuspended")}</SelectItem>
                  <SelectItem value="inactive">{t("adminOrg.statusInactive")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => void handleCreate()} disabled={!canSubmit}>
              {t("adminOrg.create")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">{t("adminOrg.listTitle")}</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">
            {t("adminOrg.loading")}
          </p>
        ) : organizations.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("adminOrg.noOrganizations")}
          </p>
        ) : (
          organizations.map((organization) => {
            const activeCapabilities = new Set(
              organization.capabilities.map((capability) => capability.code),
            );
            const selectableCapabilities = CAPABILITY_CODES.filter(
              (code) => !activeCapabilities.has(code),
            );
            return (
              <Card key={organization.id}>
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle>{organization.displayName}</CardTitle>
                    <Badge variant="secondary">{organization.status}</Badge>
                  </div>
                  <CardDescription>
                    {organization.legalName} ·{" "}
                    {t("adminOrg.membersCount", {
                      count: organization.memberCount,
                    })}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-1">
                    {organization.capabilities.map((capability) => (
                      <Badge key={capability.code}>{capability.code}</Badge>
                    ))}
                    {organization.capabilities.length === 0 && (
                      <span className="text-xs text-muted-foreground">
                        {t("adminOrg.noCapabilities")}
                      </span>
                    )}
                  </div>
                  {canManage && selectableCapabilities.length > 0 && (
                    <div className="flex items-center gap-2">
                      <Select
                        value={capabilitySelections[organization.id] ?? ""}
                        onValueChange={(value) =>
                          setCapabilitySelections((previous) => ({
                            ...previous,
                            [organization.id]: value,
                          }))
                        }
                      >
                        <SelectTrigger className="max-w-xs">
                          <SelectValue
                            placeholder={t("adminOrg.addCapability")}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {selectableCapabilities.map((code) => (
                            <SelectItem key={code} value={code}>
                              {code}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline"
                        disabled={!capabilitySelections[organization.id]}
                        onClick={() => void handleAddCapability(organization.id)}
                      >
                        {t("adminOrg.addCapability")}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};

export default OrganizationManagement;
