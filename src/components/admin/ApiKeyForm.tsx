
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAdminConnectionState } from "@/hooks/useAdminConnectionState";
import { adminConnectionService, getAdminConnectionErrorMessage } from "@/services/adminConnectionService";
import { logger } from "@/services/logger";
import { adminUtils } from "@/utils/adminUtils";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const ApiKeyForm = () => {
  const connectionState = useAdminConnectionState();
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const isLoading = connectionState.status === "connecting";

  let badgeVariant: "default" | "destructive" | "secondary" = "secondary";
  if (connectionState.status === "connected") {
    badgeVariant = "default";
  } else if (connectionState.status === "error") {
    badgeVariant = "destructive";
  }

  const statusLabel = connectionState.status.charAt(0).toUpperCase() + connectionState.status.slice(1);
  const submitLabel = connectionState.status === "connected" ? "Reconnect to API" : "Connect to API";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await adminUtils.initializeApiAccess(apiKey, apiSecret);
      toast.success("API connection established successfully");
      setApiKey("");
      setApiSecret("");
    } catch (error) {
      const message = getAdminConnectionErrorMessage(error);
      toast.error(message);
      logger.error("API connection error", { error });
    }
  };

  const handleReset = () => {
    adminConnectionService.disconnect();
    setApiKey("");
    setApiSecret("");
    toast.success("API connection cleared");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-lg bg-card">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-medium">API Connection</h3>
        <Badge variant={badgeVariant}>Status: {statusLabel}</Badge>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Connect to the external API using your credentials. Current mode: {connectionState.mode === "mock" ? "Mock API" : "Real API"}.
      </p>

      {connectionState.status === "connected" && (
        <Alert>
          <AlertTitle>Active admin API session</AlertTitle>
          <AlertDescription>
            The admin connection is active and protected tabs are unlocked.
          </AlertDescription>
        </Alert>
      )}

      {connectionState.errorMessage && (
        <Alert variant="destructive">
          <AlertTitle>Connection failed</AlertTitle>
          <AlertDescription>{connectionState.errorMessage}</AlertDescription>
        </Alert>
      )}
      
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
      
      <div className="flex gap-2 pt-2">
        <Button 
          type="submit" 
          className="flex-1"
          disabled={isLoading || !apiKey || !apiSecret}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Connecting...
            </>
          ) : (
            submitLabel
          )}
        </Button>

        {connectionState.status !== "disconnected" && (
          <Button type="button" variant="outline" onClick={handleReset} disabled={isLoading}>
            Reset
          </Button>
        )}
      </div>
      
      <div className="text-xs text-muted-foreground pt-2">
        {connectionState.mode === "mock" ? (
          <>
            <p>Demo credentials (for testing):</p>
            <p><span className="font-medium">API Key:</span> demo_key</p>
            <p><span className="font-medium">API Secret:</span> demo_secret</p>
          </>
        ) : (
          <p>Use credentials issued by the target admin API environment.</p>
        )}
      </div>
    </form>
  );
};

export default ApiKeyForm;
