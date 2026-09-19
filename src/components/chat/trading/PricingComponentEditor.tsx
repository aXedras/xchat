import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface PricingComponentDraft {
  componentType: string;
  label: string;
  calculationMethod: string;
  numericValue: string;
  formulaText: string;
  currencyCode: string;
  unitCode: string;
  chargeDirection: string;
  taxTreatment: string;
  minimumAmount: string;
  maximumAmount: string;
  notes: string;
}

export const COMPONENT_TYPES = [
  "METAL_PRICE",
  "PREMIUM",
  "DISCOUNT",
  "REFINING_CHARGE",
  "TREATMENT_CHARGE",
  "ASSAY_FEE",
  "FABRICATION_FEE",
  "LOGISTICS_FEE",
  "INSURANCE_FEE",
  "MINIMUM_CHARGE",
  "TAX",
  "BYPRODUCT_CREDIT",
  "OTHER",
];

export const CALCULATION_METHODS = [
  "FIXED_AMOUNT",
  "PER_UNIT",
  "PERCENTAGE",
  "BASIS_POINTS",
  "FORMULA",
  "INCLUDED",
];

export const CHARGE_DIRECTIONS = [
  "PAYABLE_BY_REQUESTER",
  "PAYABLE_BY_RESPONDER",
  "CREDIT_TO_REQUESTER",
  "CREDIT_TO_RESPONDER",
];

export const TAX_TREATMENTS = [
  "EXCLUSIVE",
  "INCLUSIVE",
  "EXEMPT",
  "REVERSE_CHARGE",
  "TO_BE_DETERMINED",
];

const NUMERIC_METHODS = ["FIXED_AMOUNT", "PER_UNIT", "PERCENTAGE", "BASIS_POINTS"];

export function emptyComponent(): PricingComponentDraft {
  return {
    componentType: "PREMIUM",
    label: "",
    calculationMethod: "FIXED_AMOUNT",
    numericValue: "",
    formulaText: "",
    currencyCode: "",
    unitCode: "",
    chargeDirection: "PAYABLE_BY_REQUESTER",
    taxTreatment: "",
    minimumAmount: "",
    maximumAmount: "",
    notes: "",
  };
}

interface PricingComponentEditorProps {
  components: PricingComponentDraft[];
  onChange: (components: PricingComponentDraft[]) => void;
}

const PricingComponentEditor = ({
  components,
  onChange,
}: PricingComponentEditorProps) => {
  const { t } = useTranslation();

  const update = (index: number, patch: Partial<PricingComponentDraft>) => {
    onChange(components.map((component, i) => (i === index ? { ...component, ...patch } : component)));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>{t("quotation.pricingComponents")}</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...components, emptyComponent()])}
        >
          {t("quotation.addComponent")}
        </Button>
      </div>

      {components.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("quotation.noComponents")}</p>
      ) : (
        components.map((component, index) => {
          const needsNumeric = NUMERIC_METHODS.includes(component.calculationMethod);
          const needsFormula = component.calculationMethod === "FORMULA";
          const needsCurrency = component.calculationMethod === "FIXED_AMOUNT";
          const needsUnit = component.calculationMethod === "PER_UNIT";

          return (
            <div key={index} className="rounded-md border border-border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{component.label || t("quotation.component")}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onChange(components.filter((_, i) => i !== index))}
                >
                  ×
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">{t("quotation.componentType")}</Label>
                  <Select value={component.componentType} onValueChange={(value) => update(index, { componentType: value })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {COMPONENT_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t("quotation.calculationMethod")}</Label>
                  <Select value={component.calculationMethod} onValueChange={(value) => update(index, { calculationMethod: value })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CALCULATION_METHODS.map((method) => (
                        <SelectItem key={method} value={method}>{method}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">{t("quotation.label")}</Label>
                <Input value={component.label} onChange={(e) => update(index, { label: e.target.value })} />
              </div>

              <div className={cn("grid gap-2", needsNumeric && needsFormula ? "grid-cols-2" : "grid-cols-2")}>
                {needsNumeric && (
                  <div className="space-y-1">
                    <Label className="text-xs">{t("quotation.numericValue")}</Label>
                    <Input inputMode="decimal" value={component.numericValue} onChange={(e) => update(index, { numericValue: e.target.value })} />
                  </div>
                )}
                {needsFormula && (
                  <div className="space-y-1">
                    <Label className="text-xs">{t("quotation.formulaText")}</Label>
                    <Input value={component.formulaText} onChange={(e) => update(index, { formulaText: e.target.value })} />
                  </div>
                )}
              </div>

              {(needsCurrency || needsUnit) && (
                <div className="grid grid-cols-2 gap-2">
                  {needsCurrency && (
                    <div className="space-y-1">
                      <Label className="text-xs">{t("quotation.currencyCode")}</Label>
                      <Input maxLength={3} value={component.currencyCode} onChange={(e) => update(index, { currencyCode: e.target.value.toUpperCase() })} />
                    </div>
                  )}
                  {needsUnit && (
                    <div className="space-y-1">
                      <Label className="text-xs">{t("quotation.unitCode")}</Label>
                      <Input value={component.unitCode} onChange={(e) => update(index, { unitCode: e.target.value })} />
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-xs">{t("quotation.chargeDirection")}</Label>
                <Select value={component.chargeDirection} onValueChange={(value) => update(index, { chargeDirection: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CHARGE_DIRECTIONS.map((direction) => (
                      <SelectItem key={direction} value={direction}>{direction}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};

export default PricingComponentEditor;
