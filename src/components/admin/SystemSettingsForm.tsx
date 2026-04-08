import { useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { authService } from "@/services/authService";
import { systemSettingsService } from "@/services/systemSettingsService";
import { SystemSettings } from "@/types/systemSettings";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const SystemSettingsForm = () => {
  const [settings, setSettings] = useState<SystemSettings>(() =>
    systemSettingsService.getSettings(),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    const loadSettings = async () => {
      try {
        const nextSettings = await systemSettingsService.loadSettings();
        if (!isCancelled) {
          setSettings(nextSettings);
          setErrorMessage(null);
        }
      } catch (error) {
        if (!isCancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Unable to load system settings",
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadSettings();

    return () => {
      isCancelled = true;
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);

    try {
      const nextSettings = await systemSettingsService.saveSettings(settings);
      setSettings(nextSettings);
      setErrorMessage(null);
      toast.success(
        nextSettings.storageMode === "supabase-shared"
          ? "Shared system settings saved"
          : "System settings saved",
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to save system settings";
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    setIsSaving(true);

    try {
      const nextSettings = await systemSettingsService.reset();
      setSettings(nextSettings);
      setErrorMessage(null);
      toast.success(
        nextSettings.storageMode === "supabase-shared"
          ? "Shared system settings reset to deployment defaults"
          : "System settings reset to deployment defaults",
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to reset system settings";
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const isSharedMode = settings.storageMode === "supabase-shared";
  const hasSupabaseConfigured = authService.isSupabaseAuthConfigured();

  const storageMessage = isSharedMode
    ? "These settings are stored in Supabase and shared across authenticated users in the same environment."
    : hasSupabaseConfigured
      ? "This session is using browser-local fallback. Shared settings require a Supabase-authenticated admin session."
      : "This deployment is running without Supabase configuration, so settings are stored only in browser local storage.";

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-lg border bg-card p-4"
    >
      <div className="space-y-1">
        <h3 className="text-lg font-medium">Bullion Integrity Ledger</h3>
        <p className="text-sm text-muted-foreground">
          Seed deployment-specific connectivity from container environment
          variables and refine the values here for demo and test use.
        </p>
      </div>

      <Alert>
        <AlertTitle>
          {isSharedMode ? "Shared settings active" : "Fallback storage active"}
        </AlertTitle>
        <AlertDescription>{storageMessage}</AlertDescription>
      </Alert>

      {errorMessage && (
        <Alert variant="destructive">
          <AlertTitle>System settings unavailable</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 rounded-md border px-3 py-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading system settings...</span>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <div>
              <Label htmlFor="bil-enabled">Enable BIL connectivity</Label>
              <p className="text-xs text-muted-foreground">
                Switch on when the deployment should use configured BIL access
                details.
              </p>
            </div>
            <Switch
              id="bil-enabled"
              checked={settings.bil.enabled}
              onCheckedChange={(checked) =>
                setSettings((current) => ({
                  ...current,
                  bil: { ...current.bil, enabled: checked },
                }))
              }
              disabled={isSaving}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="bil-base-url">BIL Base URL</Label>
              <Input
                id="bil-base-url"
                placeholder="https://bil.example.com/api"
                value={settings.bil.baseUrl}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    bil: { ...current.bil, baseUrl: event.target.value },
                  }))
                }
                disabled={isSaving}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="bil-api-key">BIL API Key</Label>
              <Input
                id="bil-api-key"
                type="password"
                placeholder="Enter BIL API key"
                value={settings.bil.apiKey}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    bil: { ...current.bil, apiKey: event.target.value },
                  }))
                }
                disabled={isSaving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bil-network">Network</Label>
              <Input
                id="bil-network"
                placeholder="production"
                value={settings.bil.network}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    bil: { ...current.bil, network: event.target.value },
                  }))
                }
                disabled={isSaving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bil-ledger-id">Ledger ID</Label>
              <Input
                id="bil-ledger-id"
                placeholder="primary-ledger"
                value={settings.bil.ledgerId}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    bil: { ...current.bil, ledgerId: event.target.value },
                  }))
                }
                disabled={isSaving}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="bil-participant-id">Participant ID</Label>
              <Input
                id="bil-participant-id"
                placeholder="vendor-desk-001"
                value={settings.bil.participantId}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    bil: { ...current.bil, participantId: event.target.value },
                  }))
                }
                disabled={isSaving}
              />
            </div>
          </div>
        </>
      )}

      {(settings.updatedAt || settings.updatedBy) && (
        <p className="text-xs text-muted-foreground">
          Last updated{" "}
          {settings.updatedAt
            ? new Date(settings.updatedAt).toLocaleString()
            : "unknown"}
          {settings.updatedBy ? ` by ${settings.updatedBy}` : ""}.
        </p>
      )}

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={isLoading || isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : isSharedMode ? (
            "Save shared settings"
          ) : (
            "Save settings"
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => void handleReset()}
          disabled={isLoading || isSaving}
        >
          Reset to defaults
        </Button>
      </div>
    </form>
  );
};

export default SystemSettingsForm;
