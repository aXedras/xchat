
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useAdminConnectionState } from "@/hooks/useAdminConnectionState";
import { useAvailableCompanies } from "@/hooks/useAvailableCompanies";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { logger } from "@/services/logger";
import { adminUtils } from "@/utils/adminUtils";
import { Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CompanyRegistrationForm = () => {
  const { t } = useTranslation();
  const connectionState = useAdminConnectionState();
  const availableCompanies = useAvailableCompanies();
  const isConnected = connectionState.status === "connected";
  const [isLoading, setIsLoading] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [companyLocation, setCompanyLocation] = useState("");
  const [companyType, setCompanyType] = useState("");
  const [users, setUsers] = useState([
    { name: "", role: "" }
  ]);

  const normalizedCompanyName = companyName.trim().toLowerCase();
  const duplicateCompany = availableCompanies.find((company) => company.name.trim().toLowerCase() === normalizedCompanyName);

  const handleAddUser = () => {
    setUsers([...users, { name: "", role: "" }]);
  };

  const handleRemoveUser = (index: number) => {
    setUsers(users.filter((_, i) => i !== index));
  };

  const handleUserChange = (index: number, field: 'name' | 'role', value: string) => {
    const updatedUsers = [...users];
    updatedUsers[index][field] = value;
    setUsers(updatedUsers);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isConnected) {
      toast.error(t("adminCompanies.connectionRequiredToast"));
      return;
    }

    if (duplicateCompany) {
      toast.error(t("adminCompanies.duplicateToast", { name: duplicateCompany.name }));
      return;
    }
    
    setIsLoading(true);
    
    try {
      const filteredUsers = users.filter(user => user.name.trim() !== "" && user.role.trim() !== "");
      
      if (filteredUsers.length === 0) {
        toast.error(t("adminCompanies.atLeastOneUser"));
        setIsLoading(false);
        return;
      }
      
      const company = await adminUtils.registerCompanyWithUsers(
        {
          name: companyName,
          location: companyLocation,
          type: companyType,
        },
        filteredUsers
      );

      toast.success(t("adminCompanies.registered", { name: companyName, count: company.users.length }));
      setCompanyName("");
      setCompanyLocation("");
      setCompanyType("");
      setUsers([{ name: "", role: "" }]);
    } catch (error) {
      const message = error instanceof Error ? error.message : t("adminCompanies.registrationError");
      toast.error(message);
      logger.error("Company registration error", { error, companyName });
    } finally {
      setIsLoading(false);
    }
  };

  const companyTypes = [
    "Refiner",
    "Mint",
    "Logistics",
    "Bank",
    "Dealer",
    "Vault",
    "Exchange",
    "Other"
  ];

  const companyTypeLabels: Record<string, string> = {
    Refiner: t("adminCompanies.typeRefiner"),
    Mint: t("adminCompanies.typeMint"),
    Logistics: t("adminCompanies.typeLogistics"),
    Bank: t("adminCompanies.typeBank"),
    Dealer: t("adminCompanies.typeDealer"),
    Vault: t("adminCompanies.typeVault"),
    Exchange: t("adminCompanies.typeExchange"),
    Other: t("adminCompanies.typeOther"),
  };

  const userRoles = [
    "Administrator",
    "Manager",
    "Compliance Officer",
    "Trader",
    "Sales Representative",
    "Operations",
    "Auditor",
    "Read-only"
  ];

  const userRoleLabels: Record<string, string> = {
    Administrator: t("adminCompanies.roleAdministrator"),
    Manager: t("adminCompanies.roleManager"),
    "Compliance Officer": t("adminCompanies.roleCompliance"),
    Trader: t("adminCompanies.roleTrader"),
    "Sales Representative": t("adminCompanies.roleSales"),
    Operations: t("adminCompanies.roleOperations"),
    Auditor: t("adminCompanies.roleAuditor"),
    "Read-only": t("adminCompanies.roleReadonly"),
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 p-4 border rounded-lg bg-card">
      <h3 className="text-lg font-medium">{t("adminCompanies.registerCompany")}</h3>
      <p className="text-sm text-muted-foreground mb-4">
        {t("adminCompanies.registerDesc")}
      </p>

      {!isConnected && (
        <Alert>
          <AlertTitle>{t("adminCompanies.connectionRequired")}</AlertTitle>
          <AlertDescription>
            {t("adminCompanies.connectionRequiredDesc")}
          </AlertDescription>
        </Alert>
      )}

      {duplicateCompany && (
        <Alert variant="destructive">
          <AlertTitle>{t("adminCompanies.duplicateCompany")}</AlertTitle>
          <AlertDescription>
            {t("adminCompanies.duplicateCompanyDesc", { name: duplicateCompany.name })}
          </AlertDescription>
        </Alert>
      )}
      
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="companyName">{t("adminCompanies.companyName")}</Label>
          <Input
            id="companyName"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder={t("adminCompanies.companyNamePlaceholder")}
            required
            disabled={isLoading || !isConnected}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="companyLocation">{t("adminCompanies.location")}</Label>
          <Input
            id="companyLocation"
            value={companyLocation}
            onChange={(e) => setCompanyLocation(e.target.value)}
            placeholder={t("adminCompanies.locationPlaceholder")}
            required
            disabled={isLoading || !isConnected}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="companyType">{t("adminCompanies.companyType")}</Label>
          <Select
            value={companyType}
            onValueChange={setCompanyType}
            disabled={isLoading || !isConnected}
          >
            <SelectTrigger id="companyType">
              <SelectValue placeholder={t("adminCompanies.selectType")} />
            </SelectTrigger>
            <SelectContent>
              {companyTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {companyTypeLabels[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-md font-medium">{t("adminCompanies.users")}</h4>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddUser}
            disabled={isLoading || !isConnected}
          >
            <Plus className="h-4 w-4 mr-1" />
            {t("adminCompanies.addUser")}
          </Button>
        </div>
        
        {users.map((user, index) => (
          <div key={index} className="flex items-start space-x-2 p-3 border rounded bg-background">
            <div className="flex-1 space-y-2">
              <div>
                <Label htmlFor={`userName-${index}`}>{t("common.name")}</Label>
                <Input
                  id={`userName-${index}`}
                  value={user.name}
                  onChange={(e) => handleUserChange(index, 'name', e.target.value)}
                  placeholder={t("adminCompanies.userNamePlaceholder")}
                  disabled={isLoading || !isConnected}
                />
              </div>
              
              <div>
                <Label htmlFor={`userRole-${index}`}>{t("common.role")}</Label>
                <Select 
                  value={user.role}
                  onValueChange={(value) => handleUserChange(index, 'role', value)}
                  disabled={isLoading || !isConnected}
                >
                  <SelectTrigger id={`userRole-${index}`}>
                    <SelectValue placeholder={t("adminCompanies.selectRole")} />
                  </SelectTrigger>
                  <SelectContent>
                    {userRoles.map((role) => (
                      <SelectItem key={role} value={role}>
                        {userRoleLabels[role]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {users.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handleRemoveUser(index)}
                disabled={isLoading || !isConnected}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
      </div>
      
      <div className="pt-2">
        <Button 
          type="submit" 
          className="w-full"
          disabled={isLoading || !isConnected || !companyName || !companyLocation || !companyType || !!duplicateCompany}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t("adminCompanies.registering")}
            </>
          ) : (
            t("adminCompanies.register")
          )}
        </Button>
      </div>
    </form>
  );
};

export default CompanyRegistrationForm;
