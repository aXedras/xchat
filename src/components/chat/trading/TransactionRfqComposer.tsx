import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { rfqMacroSchemas, RfqTermsV2 } from "@/schemas";
import {
  CompositionElement,
  FieldDefinition,
  fieldsForTab,
  LocationValue,
} from "./fieldDefinitions";
import { useTradingParticipants } from "@/hooks/useTradingParticipants";

type TabKey = "commercial" | "material" | "assay" | "logistics";
type TabValue = Record<string, unknown>;

const TAB_KEYS: TabKey[] = ["commercial", "material", "assay", "logistics"];

const DEADLINE_PRESETS = [
  { key: "15m", label: "15 min", minutes: 15 },
  { key: "1h", label: "1 h", minutes: 60 },
  { key: "eod", label: "End of day", minutes: null },
  { key: "24h", label: "24 h", minutes: 1440 },
] as const;

function isoInMinutes(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

function endOfBusinessDay(): string {
  const now = new Date();
  now.setHours(18, 0, 0, 0);
  if (now.getTime() <= Date.now()) {
    now.setDate(now.getDate() + 1);
  }
  return now.toISOString();
}

interface TransactionRfqComposerProps {
  transactionType: string;
  disabled?: boolean;
  onSubmit: (terms: RfqTermsV2, recipientIds: string[], message: string) => void;
}

const TransactionRfqComposer = ({
  transactionType,
  disabled,
  onSubmit,
}: TransactionRfqComposerProps) => {
  const { t } = useTranslation();
  const { participants } = useTradingParticipants();
  const [values, setValues] = useState<Record<TabKey, TabValue>>({
    commercial: {
      transactionType,
      partialFulfilmentAllowed: false,
      responseDeadline: isoInMinutes(60),
    },
    material: {},
    assay: {},
    logistics: {},
  });
  const [activeTab, setActiveTab] = useState<TabKey>("commercial");
  const [preview, setPreview] = useState(false);
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [recipientQuery, setRecipientQuery] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<string[]>([]);

  const updateField = (tab: TabKey, key: string, value: unknown) => {
    setValues((previous) => ({ ...previous, [tab]: { ...previous[tab], [key]: value } }));
  };

  const toggleRecipient = (userId: string) => {
    setSelectedRecipients((previous) =>
      previous.includes(userId)
        ? previous.filter((id) => id !== userId)
        : [...previous, userId],
    );
  };

  const groupedParticipants = useMemo(() => {
    const normalizedQuery = recipientQuery.trim().toLowerCase();
    const filtered = normalizedQuery
      ? participants.filter(
          (participant) =>
            participant.displayName.toLowerCase().includes(normalizedQuery) ||
            (participant.organization ?? "")
              .toLowerCase()
              .includes(normalizedQuery),
        )
      : participants;
    const groups = new Map<string, typeof participants>();
    for (const participant of filtered) {
      const key = participant.organization ?? "";
      groups.set(key, [...(groups.get(key) ?? []), participant]);
    }
    return [...groups.entries()];
  }, [participants, recipientQuery]);

  const missingRequired = useMemo(() => {
    const missing: string[] = [];
    for (const tab of TAB_KEYS) {
      for (const field of fieldsForTab(transactionType as never, tab)) {
        if (!field.required) continue;
        const value = values[tab][field.key];
        const empty =
          value === undefined || value === "" || value === null;
        if (empty) {
          missing.push(`${tab}.${field.key}`);
        }
      }
    }
    return missing;
  }, [values, transactionType]);

  const tabErrorCount = (tab: TabKey) =>
    missingRequired.filter((key) => key.startsWith(`${tab}.`)).length;

  const buildTerms = (): RfqTermsV2 => {
    const tabs: Record<TabKey, Record<string, unknown>> = {
      commercial: {},
      material: {},
      assay: {},
      logistics: {},
    };
    for (const tab of TAB_KEYS) {
      for (const field of fieldsForTab(transactionType as never, tab)) {
        const value = values[tab][field.key];
        if (value === undefined || value === "" || value === null) continue;
        if (field.kind === "location") {
          const loc = value as LocationValue;
          const cleaned: Record<string, unknown> = { countryCode: loc.countryCode, locality: loc.locality };
          if (loc.postalCode) cleaned.postalCode = loc.postalCode;
          if (loc.address) cleaned.address = loc.address;
          tabs[tab][field.key] = cleaned;
        } else if (field.kind === "composition") {
          tabs[tab][field.key] = value;
        } else {
          tabs[tab][field.key] = value;
        }
      }
    }
    tabs.commercial.transactionType = transactionType;
    tabs.commercial.partialFulfilmentAllowed = false;
    return {
      schemaVersion: 1,
      commercial: tabs.commercial,
      material: tabs.material,
      assay: tabs.assay,
      logistics: tabs.logistics,
    } as RfqTermsV2;
  };

  const handleSend = () => {
    const terms = buildTerms();
    const schema = rfqMacroSchemas[transactionType as keyof typeof rfqMacroSchemas];
    const parsed = schema.safeParse(terms);
    if (!parsed.success) {
      setErrors(parsed.error.issues.map((issue) => issue.message));
      const firstPath = parsed.error.issues[0]?.path[0];
      if (typeof firstPath === "string" && TAB_KEYS.includes(firstPath as TabKey)) {
        setActiveTab(firstPath as TabKey);
      }
      return;
    }
    setErrors([]);
    onSubmit(parsed.data, selectedRecipients, message.trim());
  };

  const renderField = (field: FieldDefinition) => {
    const tab = activeTab;
    const value = values[tab][field.key];
    const label = t(`rfqV2.${tab}.${field.key}`, { defaultValue: field.key });

    if (field.kind === "location") {
      const loc = (value as LocationValue | undefined) ?? { countryCode: "", locality: "" };
      return (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label>{t("rfqV2.countryCode")}</Label>
            <Input
              value={loc.countryCode}
              maxLength={2}
              onChange={(e) =>
                updateField(tab, field.key, { ...loc, countryCode: e.target.value.toUpperCase() })
              }
            />
          </div>
          <div className="space-y-1">
            <Label>{t("rfqV2.locality")}</Label>
            <Input
              value={loc.locality}
              onChange={(e) => updateField(tab, field.key, { ...loc, locality: e.target.value })}
            />
          </div>
        </div>
      );
    }

    if (field.kind === "composition") {
      const elements = (value as CompositionElement[] | undefined) ?? [];
      return (
        <div className="space-y-2">
          {elements.map((element, index) => (
            <div key={index} className="flex gap-2">
              <Input
                placeholder={t("rfqV2.elementCode")}
                value={element.elementCode}
                onChange={(e) =>
                  updateField(tab, field.key, elements.map((el, i) => (i === index ? { ...el, elementCode: e.target.value } : el)))
                }
              />
              <Input
                placeholder={t("rfqV2.proportion")}
                value={element.proportion}
                onChange={(e) =>
                  updateField(tab, field.key, elements.map((el, i) => (i === index ? { ...el, proportion: e.target.value } : el)))
                }
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  updateField(tab, field.key, elements.filter((_, i) => i !== index))
                }
              >
                ×
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              updateField(tab, field.key, [...elements, { elementCode: "", proportion: "", unit: "PCT" }])
            }
          >
            {t("rfqV2.addElement")}
          </Button>
        </div>
      );
    }

    if (field.kind === "select") {
      return (
        <Select
          value={typeof value === "string" ? value : ""}
          onValueChange={(next) => updateField(tab, field.key, next)}
        >
          <SelectTrigger>
            <SelectValue placeholder={t("rfqV2.selectPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {field.options?.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (field.kind === "textarea") {
      return (
        <textarea
          className="w-full chat-input min-h-[70px] p-3 resize-y"
          value={typeof value === "string" ? value : ""}
          maxLength={field.maxLength}
          onChange={(e) => updateField(tab, field.key, e.target.value)}
        />
      );
    }

    return (
      <Input
        type={
          field.kind === "decimal" || field.kind === "number"
            ? "text"
            : field.kind === "date"
              ? "date"
              : field.kind === "datetime"
                ? "datetime-local"
                : "text"
        }
        inputMode={field.kind === "decimal" || field.kind === "number" ? "decimal" : undefined}
        value={typeof value === "string" ? value : ""}
        maxLength={field.maxLength}
        onChange={(e) => updateField(tab, field.key, e.target.value)}
      />
    );
  };

  const tabContent = (tab: TabKey) => (
    <div className="space-y-4">
      {fieldsForTab(transactionType as never, tab).map((field) => (
        <div key={field.key} className="space-y-1">
          <Label>
            {t(`rfqV2.${tab}.${field.key}`, { defaultValue: field.key })}
            {field.required && <span className="text-destructive"> *</span>}
          </Label>
          {renderField(field)}
        </div>
      ))}
    </div>
  );

  if (preview) {
    return (
      <div className="space-y-4 p-4">
        <div className="text-sm font-medium">{t("rfqV2.previewTitle")}</div>
        <pre className="text-xs whitespace-pre-wrap rounded-md border bg-muted p-3">
          {JSON.stringify(buildTerms(), null, 2)}
        </pre>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setPreview(false)}>
            {t("common.back")}
          </Button>
          <Button disabled={disabled || selectedRecipients.length === 0} onClick={handleSend}>
            {t("rfqV2.sendRfq")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Badge variant="secondary">{transactionType}</Badge>
          <span className="text-xs text-muted-foreground">
            {t("rfqV2.recipients", { count: selectedRecipients.length })}
          </span>
        </div>

        <div className="space-y-1">
          <Input
            placeholder={t("rfqV2.searchRecipients")}
            value={recipientQuery}
            onChange={(e) => setRecipientQuery(e.target.value)}
          />
          {groupedParticipants.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("composer.noParticipants")}</p>
          ) : (
            groupedParticipants.map(([organization, members]) => (
              <div key={organization || "unaffiliated"}>
                {organization && (
                  <div className="text-xs font-medium text-muted-foreground">{organization}</div>
                )}
                <div className="flex flex-wrap gap-1">
                  {members.map((participant) => {
                    const selected = selectedRecipients.includes(participant.userId);
                    return (
                      <button
                        key={participant.userId}
                        type="button"
                        onClick={() => toggleRecipient(participant.userId)}
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-xs transition-colors",
                          selected
                            ? "border-primary bg-primary/10"
                            : "border-border hover:bg-accent/40",
                        )}
                      >
                        {participant.displayName}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabKey)}>
        <TabsList className="w-full">
          {TAB_KEYS.map((tab) => (
            <TabsTrigger key={tab} value={tab} className="flex-1">
              {t(`rfqV2.${tab}.title`)}
              {tabErrorCount(tab) > 0 && (
                <Badge variant="destructive" className="ml-1 h-4 min-w-4 px-1 text-[10px]">
                  {tabErrorCount(tab)}
                </Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
        {TAB_KEYS.map((tab) => (
          <TabsContent key={tab} value={tab} className="max-h-[50vh] overflow-y-auto pr-1">
            {tab === "commercial" && (
              <div className="mb-3 space-y-1">
                <Label>{t("rfqV2.responseDeadlinePresets")}</Label>
                <div className="flex flex-wrap gap-1">
                  {DEADLINE_PRESETS.map((preset) => (
                    <Button
                      key={preset.key}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        updateField(
                          "commercial",
                          "responseDeadline",
                          preset.minutes === null ? endOfBusinessDay() : isoInMinutes(preset.minutes),
                        )
                      }
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            {tabContent(tab)}
          </TabsContent>
        ))}
      </Tabs>

      {errors.length > 0 && (
        <div className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {errors.slice(0, 3).join(", ")}
        </div>
      )}

      <div className="space-y-2">
        <Input
          placeholder={t("rfqV2.messagePlaceholder")}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setPreview(true)}>
            {t("rfqV2.preview")}
          </Button>
          <Button
            disabled={disabled || selectedRecipients.length === 0 || missingRequired.length > 0}
            onClick={handleSend}
          >
            {t("rfqV2.sendRfq")}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TransactionRfqComposer;
