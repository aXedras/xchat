
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminUtils } from "@/utils/adminUtils";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const ApiKeyForm = () => {
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const success = await adminUtils.initializeApiAccess(apiKey, apiSecret);
      
      if (success) {
        toast.success("API connection established successfully");
        setApiKey("");
        setApiSecret("");
      } else {
        toast.error("Failed to connect to API");
      }
    } catch (error) {
      toast.error("An error occurred while connecting to the API");
      console.error("API connection error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-lg bg-card">
      <h3 className="text-lg font-medium">API Connection</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Connect to the external API using your credentials
      </p>
      
      <div className="space-y-2">
        <Label htmlFor="apiKey">API Key</Label>
        <Input
          id="apiKey"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Enter your API key"
          required
          disabled={isLoading}
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="apiSecret">API Secret</Label>
        <Input
          id="apiSecret"
          type="password"
          value={apiSecret}
          onChange={(e) => setApiSecret(e.target.value)}
          placeholder="Enter your API secret"
          required
          disabled={isLoading}
        />
      </div>
      
      <div className="pt-2">
        <Button 
          type="submit" 
          className="w-full"
          disabled={isLoading || !apiKey || !apiSecret}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Connecting...
            </>
          ) : (
            "Connect to API"
          )}
        </Button>
      </div>
      
      <div className="text-xs text-muted-foreground pt-2">
        <p>Demo credentials (for testing):</p>
        <p><span className="font-medium">API Key:</span> demo_key</p>
        <p><span className="font-medium">API Secret:</span> demo_secret</p>
      </div>
    </form>
  );
};

export default ApiKeyForm;
