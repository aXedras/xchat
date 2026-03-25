
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useAdminConnectionState } from "@/hooks/useAdminConnectionState";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { logger } from "@/services/logger";
import { adminUtils } from "@/utils/adminUtils";
import { Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CompanyRegistrationForm = () => {
  const connectionState = useAdminConnectionState();
  const isConnected = connectionState.status === "connected";
  const [isLoading, setIsLoading] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [companyLocation, setCompanyLocation] = useState("");
  const [companyType, setCompanyType] = useState("");
  const [users, setUsers] = useState([
    { name: "", role: "" }
  ]);

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
      toast.error("API connection required. Please connect your API key first.");
      return;
    }
    
    setIsLoading(true);
    
    try {
      const filteredUsers = users.filter(user => user.name.trim() !== "" && user.role.trim() !== "");
      
      if (filteredUsers.length === 0) {
        toast.error("At least one user with name and role is required");
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

      toast.success(`Company "${companyName}" registered with ${company.users.length} users`);
      setCompanyName("");
      setCompanyLocation("");
      setCompanyType("");
      setUsers([{ name: "", role: "" }]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "An error occurred during company registration";
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

  return (
    <form onSubmit={handleSubmit} className="space-y-6 p-4 border rounded-lg bg-card">
      <h3 className="text-lg font-medium">Register New Company</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Add a new company and its users to the platform
      </p>

      {!isConnected && (
        <Alert>
          <AlertTitle>API connection required</AlertTitle>
          <AlertDescription>
            Establish an admin API connection before registering companies and users.
          </AlertDescription>
        </Alert>
      )}
      
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="companyName">Company Name</Label>
          <Input
            id="companyName"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Enter company name"
            required
            disabled={isLoading || !isConnected}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="companyLocation">Location</Label>
          <Input
            id="companyLocation"
            value={companyLocation}
            onChange={(e) => setCompanyLocation(e.target.value)}
            placeholder="Country or city"
            required
            disabled={isLoading || !isConnected}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="companyType">Company Type</Label>
          <Select
            value={companyType}
            onValueChange={setCompanyType}
            disabled={isLoading || !isConnected}
          >
            <SelectTrigger id="companyType">
              <SelectValue placeholder="Select company type" />
            </SelectTrigger>
            <SelectContent>
              {companyTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-md font-medium">Users</h4>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddUser}
            disabled={isLoading || !isConnected}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add User
          </Button>
        </div>
        
        {users.map((user, index) => (
          <div key={index} className="flex items-start space-x-2 p-3 border rounded bg-background">
            <div className="flex-1 space-y-2">
              <div>
                <Label htmlFor={`userName-${index}`}>Name</Label>
                <Input
                  id={`userName-${index}`}
                  value={user.name}
                  onChange={(e) => handleUserChange(index, 'name', e.target.value)}
                  placeholder="User name"
                  disabled={isLoading || !isConnected}
                />
              </div>
              
              <div>
                <Label htmlFor={`userRole-${index}`}>Role</Label>
                <Select 
                  value={user.role}
                  onValueChange={(value) => handleUserChange(index, 'role', value)}
                  disabled={isLoading || !isConnected}
                >
                  <SelectTrigger id={`userRole-${index}`}>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {userRoles.map((role) => (
                      <SelectItem key={role} value={role}>
                        {role}
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
          disabled={isLoading || !isConnected || !companyName || !companyLocation || !companyType}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Registering...
            </>
          ) : (
            "Register Company"
          )}
        </Button>
      </div>
    </form>
  );
};

export default CompanyRegistrationForm;
