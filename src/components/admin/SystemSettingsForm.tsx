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
import { useTranslation } from "react-i18next";

const SystemSettingsForm = () => {
  const { t } = useTranslation();
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
            error instanceof Error ? error.message : t("adminSettings.unableLoad"),
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
  }, [t]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);

    try {
      const nextSettings = await systemSettingsService.saveSettings(settings);
      setSettings(nextSettings);
      setErrorMessage(null);
      toast.success(
        nextSettings.storageMode === "supabase-shared"
          ? t("adminSettings.sharedSaved")
          : t("adminSettings.saved"),
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("adminSettings.unableSave");
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
          ? t("adminSettings.sharedResetDone")
          : t("adminSettings.resetDone"),
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("adminSettings.unableReset");
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const isSharedMode = settings.storageMode === "supabase-shared";
  const hasSupabaseConfigured = authService.isSupabaseAuthConfigured();

  const storageMessage = isSharedMode
    ? t("adminSettings.storageShared")
    : hasSupabaseConfigured
      ? t("adminSettings.storageFallback")
      : t("adminSettings.storageNoSupabase");

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-lg border bg-card p-4"
    >
      <div className="space-y-1">
        <h3 className="text-lg font-medium">{t("adminSettings.title")}</h3>
        <p className="text-sm text-muted-foreground">
          {t("adminSettings.desc")}
        </p>
      </div>

      <Alert>
        <AlertTitle>
          {isSharedMode ? t("adminSettings.sharedActive") : t("adminSettings.fallbackActive")}
        </AlertTitle>
        <AlertDescription>{storageMessage}</AlertDescription>
      </Alert>

      {errorMessage && (
        <Alert variant="destructive">
          <AlertTitle>{t("adminSettings.unavailable")}</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 rounded-md border px-3 py-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{t("adminSettings.loadingSettings")}</span>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <div>
              <Label htmlFor="bil-enabled">{t("adminSettings.enableBil")}</Label>
              <p className="text-xs text-muted-foreground">
                {t("adminSettings.enableBilDesc")}
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
              <Label htmlFor="bil-base-url">{t("adminSettings.bilBaseUrl")}</Label>
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
              <Label htmlFor="bil-api-key">{t("adminSettings.bilApiKey")}</Label>
              <Input
                id="bil-api-key"
                type="password"
                placeholder={t("adminSettings.bilApiKeyPlaceholder")}
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
              <Label htmlFor="bil-network">{t("adminSettings.network")}</Label>
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
              <Label htmlFor="bil-ledger-id">{t("adminSettings.ledgerId")}</Label>
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
              <Label htmlFor="bil-participant-id">{t("adminSettings.participantId")}</Label>
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
          {t("adminSettings.lastUpdated")}{" "}
          {settings.updatedAt
            ? new Date(settings.updatedAt).toLocaleString()
            : t("adminSettings.unknown")}
          {settings.updatedBy ? ` ${t("adminSettings.by")} ${settings.updatedBy}` : ""}.
        </p>
      )}

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={isLoading || isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t("common.saving")}
            </>
          ) : isSharedMode ? (
            t("adminSettings.saveShared")
          ) : (
            t("adminSettings.saveSettings")
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => void handleReset()}
          disabled={isLoading || isSaving}
        >
          {t("adminSettings.resetDefaults")}
        </Button>
      </div>
    </form>
  );
};

export default SystemSettingsForm;
