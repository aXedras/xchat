
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ApiKeyForm from "@/components/admin/ApiKeyForm";
import CompanyRegistrationForm from "@/components/admin/CompanyRegistrationForm";
import { authService } from "@/services/authService";

const Admin = () => {
  const [activeTab, setActiveTab] = useState("api");
  const isAuthenticated = authService.isAuthenticated();
  
  // If not authenticated and trying to access companies tab, switch back to API tab
  if (!isAuthenticated && activeTab === "companies") {
    setActiveTab("api");
  }

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
            disabled={!isAuthenticated}
            title={!isAuthenticated ? "API connection required" : ""}
          >
            Company Registration
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
      </Tabs>
    </div>
  );
};

export default Admin;
