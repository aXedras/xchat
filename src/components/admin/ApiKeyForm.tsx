
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
import { useTranslation } from "react-i18next";

const ApiKeyForm = () => {
  const { t } = useTranslation();
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

  const statusLabel = (() => {
    switch (connectionState.status) {
      case "connected":
        return t("adminApi.statusConnected");
      case "connecting":
        return t("adminApi.statusConnecting");
      case "error":
        return t("adminApi.statusError");
      default:
        return t("adminApi.statusDisconnected");
    }
  })();

  const submitLabel =
    connectionState.status === "connected"
      ? t("adminApi.reconnect")
      : t("adminApi.connect");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await adminUtils.initializeApiAccess(apiKey, apiSecret);
      toast.success(t("adminApi.connectionSuccess"));
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
    toast.success(t("adminApi.connectionCleared"));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-lg bg-card">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-medium">{t("admin.apiConnection")}</h3>
        <Badge variant={badgeVariant}>{t("adminApi.status")} {statusLabel}</Badge>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        {t("adminApi.modeDescription", {
          mode: connectionState.mode === "mock" ? t("adminApi.mockApi") : t("adminApi.realApi"),
        })}
      </p>

      {connectionState.status === "connected" && (
        <Alert>
          <AlertTitle>{t("adminApi.activeSession")}</AlertTitle>
          <AlertDescription>
            {t("adminApi.activeSessionDesc")}
          </AlertDescription>
        </Alert>
      )}

      {connectionState.errorMessage && (
        <Alert variant="destructive">
          <AlertTitle>{t("adminApi.connectionFailed")}</AlertTitle>
          <AlertDescription>{connectionState.errorMessage}</AlertDescription>
        </Alert>
      )}
      
      <div className="space-y-2">
        <Label htmlFor="apiKey">{t("adminApi.apiKey")}</Label>
        <Input
          id="apiKey"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={t("adminApi.apiKeyPlaceholder")}
          required
          disabled={isLoading}
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="apiSecret">{t("adminApi.apiSecret")}</Label>
        <Input
          id="apiSecret"
          type="password"
          value={apiSecret}
          onChange={(e) => setApiSecret(e.target.value)}
          placeholder={t("adminApi.apiSecretPlaceholder")}
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
              {t("adminApi.connecting")}
            </>
          ) : (
            submitLabel
          )}
        </Button>

        {connectionState.status !== "disconnected" && (
          <Button type="button" variant="outline" onClick={handleReset} disabled={isLoading}>
            {t("common.reset")}
          </Button>
        )}
      </div>
      
      <div className="text-xs text-muted-foreground pt-2">
        {connectionState.mode === "mock" ? (
          <>
            <p>{t("adminApi.demoCredentials")}</p>
            <p><span className="font-medium">{t("adminApi.apiKey")}:</span> demo_key</p>
            <p><span className="font-medium">{t("adminApi.apiSecret")}:</span> demo_secret</p>
          </>
        ) : (
          <p>{t("adminApi.useCredentials")}</p>
        )}
      </div>
    </form>
  );
};

export default ApiKeyForm;
