
import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ApiKeyForm from "@/components/admin/ApiKeyForm";
import CompanyRegistrationForm from "@/components/admin/CompanyRegistrationForm";
import FeeRulesForm from "@/components/admin/FeeRulesForm";
import { useAdminConnectionState } from "@/hooks/useAdminConnectionState";

const Admin = () => {
  const [activeTab, setActiveTab] = useState("api");
  const connectionState = useAdminConnectionState();
  const isConnected = connectionState.status === "connected";
  const protectedTabTitle = isConnected ? undefined : "API connection required";

  useEffect(() => {
    if (!isConnected && ["companies", "fees"].includes(activeTab)) {
      setActiveTab("api");
    }
  }, [activeTab, isConnected]);

  return (
    <div className="container max-w-4xl py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admin Console</h1>
        <p className="text-muted-foreground">
          Manage companies and API integrations
        </p>
      </div>
      
      <Tabs 
        value={activeTab} 
        onValueChange={setActiveTab}
        className="space-y-4"
      >
        <TabsList>
          <TabsTrigger value="api">API Connection</TabsTrigger>
          <TabsTrigger 
            value="companies" 
            disabled={!isConnected}
            title={protectedTabTitle}
          >
            Company Registration
          </TabsTrigger>
          <TabsTrigger
            value="fees"
            disabled={!isConnected}
            title={protectedTabTitle}
          >
            Customer Fees
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="api" className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Connect to the external API to enable company and user management.
            This is required before you can register new companies.
          </p>
          <ApiKeyForm />
        </TabsContent>
        
        <TabsContent value="companies" className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Register new companies and their users to the platform.
            Companies registered here will be available for chat.
          </p>
          <CompanyRegistrationForm />
        </TabsContent>

        <TabsContent value="fees" className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Maintain customer-specific fee matrices. Active rules are automatically surfaced during RFQ and deal discussions.
          </p>
          <FeeRulesForm />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Admin;
