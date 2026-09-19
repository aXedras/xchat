import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { quotationMacroSchemas, QuotationTermsV2 } from "@/schemas";
import PricingComponentEditor, {
  PricingComponentDraft,
} from "./PricingComponentEditor";

interface QuotationComposerProps {
  transactionType: string;
  disabled?: boolean;
  onSubmit: (terms: QuotationTermsV2) => void;
}

const QuotationComposer = ({
  transactionType,
  disabled,
  onSubmit,
}: QuotationComposerProps) => {
  const { t } = useTranslation();
  const [validUntil, setValidUntil] = useState(
    new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
  );
  const [notes, setNotes] = useState("");
  const [material, setMaterial] = useState<Record<string, string>>({});
  const [assay, setAssay] = useState<Record<string, string>>({});
  const [logistics, setLogistics] = useState<Record<string, string>>({});
  const [components, setComponents] = useState<PricingComponentDraft[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  const buildTerms = (): QuotationTermsV2 => {
    const pricingComponents = components
      .filter((component) => component.label.trim())
      .map((component) => {
        const entry: Record<string, unknown> = {
          componentType: component.componentType,
          label: component.label.trim(),
          calculationMethod: component.calculationMethod,
          chargeDirection: component.chargeDirection,
        };
        if (component.numericValue) entry.numericValue = component.numericValue.trim();
        if (component.formulaText) entry.formulaText = component.formulaText.trim();
        if (component.currencyCode) entry.currencyCode = component.currencyCode;
        if (component.unitCode) entry.unitCode = component.unitCode;
        if (component.taxTreatment) entry.taxTreatment = component.taxTreatment;
        if (component.minimumAmount) entry.minimumAmount = component.minimumAmount.trim();
        if (component.maximumAmount) entry.maximumAmount = component.maximumAmount.trim();
        if (component.notes) entry.notes = component.notes.trim();
        return entry;
      });

    return {
      schemaVersion: 1,
      commercial: { validUntil, notes: notes.trim() || undefined },
      material,
      assay,
      logistics,
      pricingComponents,
    } as QuotationTermsV2;
  };

  const handleSubmit = () => {
    const terms = buildTerms();
    const schema =
      quotationMacroSchemas[transactionType as keyof typeof quotationMacroSchemas];
    const parsed = schema.safeParse(terms);
    if (!parsed.success) {
      setErrors(parsed.error.issues.map((issue) => issue.message));
      return;
    }
    setErrors([]);
    onSubmit(parsed.data);
  };

  const renderTextArea = (
    value: string,
    onChange: (value: string) => void,
    maxLength?: number,
  ) => (
    <textarea
      className="w-full chat-input min-h-[60px] p-3 resize-y"
      value={value}
      maxLength={maxLength}
      onChange={(e) => onChange(e.target.value)}
    />
  );

  return (
    <div className="space-y-4 p-4">
      <Tabs defaultValue="commercial">
        <TabsList className="w-full">
          <TabsTrigger value="commercial" className="flex-1">{t("quotation.commercial")}</TabsTrigger>
          <TabsTrigger value="material" className="flex-1">{t("quotation.material")}</TabsTrigger>
          <TabsTrigger value="assay" className="flex-1">{t("quotation.assay")}</TabsTrigger>
          <TabsTrigger value="logistics" className="flex-1">{t("quotation.logistics")}</TabsTrigger>
        </TabsList>

        <TabsContent value="commercial" className="space-y-4">
          <div className="space-y-1">
            <Label>{t("quotation.validUntil")}</Label>
            <Input
              type="datetime-local"
              value={validUntil.replace("Z", "")}
              onChange={(e) => setValidUntil(new Date(e.target.value).toISOString())}
            />
          </div>
          <div className="space-y-1">
            <Label>{t("quotation.notes")}</Label>
            {renderTextArea(notes, setNotes, 4000)}
          </div>
        </TabsContent>

        <TabsContent value="material" className="space-y-4">
          {["acceptedSpecification", "toleranceNotes", "deviations"].map((key) => (
            <div key={key} className="space-y-1">
              <Label>{t(`quotation.${key}`, { defaultValue: key })}</Label>
              {renderTextArea(material[key] ?? "", (value) =>
                setMaterial((previous) => ({ ...previous, [key]: value })),
              )}
            </div>
          ))}
        </TabsContent>

        <TabsContent value="assay" className="space-y-4">
          {["acceptedAssayProcedure", "payability", "deductions", "umpireTerms"].map((key) => (
            <div key={key} className="space-y-1">
              <Label>{t(`quotation.${key}`, { defaultValue: key })}</Label>
              {renderTextArea(assay[key] ?? "", (value) =>
                setAssay((previous) => ({ ...previous, [key]: value })),
              )}
            </div>
          ))}
        </TabsContent>

        <TabsContent value="logistics" className="space-y-4">
          {["route", "leadTime", "responsibilityNotes"].map((key) => (
            <div key={key} className="space-y-1">
              <Label>{t(`quotation.${key}`, { defaultValue: key })}</Label>
              {renderTextArea(logistics[key] ?? "", (value) =>
                setLogistics((previous) => ({ ...previous, [key]: value })),
              )}
            </div>
          ))}
        </TabsContent>
      </Tabs>

      <PricingComponentEditor components={components} onChange={setComponents} />

      {errors.length > 0 && (
        <div className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {errors.slice(0, 3).join(", ")}
        </div>
      )}

      <div className="flex justify-end">
        <Button disabled={disabled} onClick={handleSubmit}>
          {t("quotation.submit")}
        </Button>
      </div>
    </div>
  );
};

export default QuotationComposer;
