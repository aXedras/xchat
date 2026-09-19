import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ApiKeyForm from "@/components/admin/ApiKeyForm";
import CompanyRegistrationForm from "@/components/admin/CompanyRegistrationForm";
import FeeRulesForm from "@/components/admin/FeeRulesForm";
import OrganizationManagement from "@/components/admin/OrganizationManagement";
import SystemSettingsForm from "@/components/admin/SystemSettingsForm";
import { useAdminConnectionState } from "@/hooks/useAdminConnectionState";
import { useTradingContext } from "@/hooks/useTradingContext";
import { useTranslation } from "react-i18next";

const Admin = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("system");
  const connectionState = useAdminConnectionState();
  const { context } = useTradingContext();
  const isConnected = connectionState.status === "connected";
  const protectedTabTitle = isConnected ? undefined : t("admin.protectedTabTitle");
  const canManageOrganizations =
    context?.entitlements.includes("ORG_CAPABILITIES_MANAGE") ?? false;

  useEffect(() => {
    if (!isConnected && ["companies", "fees"].includes(activeTab)) {
      setActiveTab("api");
    }
  }, [activeTab, isConnected]);

  return (
    <div className="container max-w-4xl py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("admin.title")}</h1>
        <p className="text-muted-foreground">
          {t("admin.subtitle")}
        </p>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-4"
      >
        <TabsList>
          <TabsTrigger value="system">{t("admin.systemSettings")}</TabsTrigger>
          <TabsTrigger value="api">{t("admin.apiConnection")}</TabsTrigger>
          {canManageOrganizations && (
            <TabsTrigger value="organizations">
              {t("admin.organizations")}
            </TabsTrigger>
          )}
          <TabsTrigger
            value="companies"
            disabled={!isConnected}
            title={protectedTabTitle}
          >
            {t("admin.companyRegistration")}
          </TabsTrigger>
          <TabsTrigger
            value="fees"
            disabled={!isConnected}
            title={protectedTabTitle}
          >
            {t("admin.customerFees")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="system" className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("admin.systemTabDesc")}
          </p>
          <SystemSettingsForm />
        </TabsContent>

        <TabsContent value="api" className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("admin.apiTabDesc")}
          </p>
          <ApiKeyForm />
        </TabsContent>

        {canManageOrganizations && (
          <TabsContent value="organizations" className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t("admin.organizationsTabDesc")}
            </p>
            <OrganizationManagement />
          </TabsContent>
        )}

        <TabsContent value="companies" className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("admin.companiesTabDesc")}
          </p>
          <CompanyRegistrationForm />
        </TabsContent>

        <TabsContent value="fees" className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("admin.feesTabDesc")}
          </p>
          <FeeRulesForm />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Admin;
