import { FeeRule } from "@/types/chat";

export interface FeeTypeOption {
  value: FeeRule["type"];
  labelKey: string;
}

export interface ProductClassOption {
  value: FeeRule["productClass"];
  labelKey: string;
}

export interface RuleErrors {
  label?: string;
  value?: string;
  priority?: string;
  minimumQuantity?: string;
  validRange?: string;
}

export const feeTypeOptions: FeeTypeOption[] = [
  { value: "percent", labelKey: "adminFees.percent" },
  { value: "bps", labelKey: "adminFees.bps" },
  { value: "fixed", labelKey: "adminFees.fixed" },
];

export const productClassOptions: ProductClassOption[] = [
  { value: "all", labelKey: "adminFees.allProducts" },
  { value: "gold", labelKey: "rfq.productClassGold" },
  { value: "silver", labelKey: "rfq.productClassSilver" },
  { value: "platinum", labelKey: "rfq.productClassPlatinum" },
  { value: "palladium", labelKey: "rfq.productClassPalladium" },
  { value: "other", labelKey: "rfq.productClassOther" },
];

export function buildNewRule(): FeeRule {
  return {
    id: `fee-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    label: "New Fee",
    type: "percent",
    value: 0,
    priority: 100,
    productClass: "all",
    minimumQuantity: 0,
    active: true,
    currency: "CHF",
  };
}

export function validateRule(rule: FeeRule): RuleErrors {
  const errors: RuleErrors = {};

  if (!rule.label.trim()) {
    errors.label = "adminFees.labelRequired";
  }

  if (!Number.isFinite(rule.value) || rule.value < 0) {
    errors.value = "adminFees.valueNonNegative";
  }

  if (!Number.isFinite(rule.priority) || rule.priority < 0) {
    errors.priority = "adminFees.priorityNonNegative";
  }

  if (rule.minimumQuantity !== undefined && (!Number.isFinite(rule.minimumQuantity) || rule.minimumQuantity < 0)) {
    errors.minimumQuantity = "adminFees.minQtyNonNegative";
  }

  if (rule.validFrom && rule.validTo && rule.validFrom > rule.validTo) {
    errors.validRange = "adminFees.validRange";
  }

  return errors;
}

export function downloadTextFile(fileName: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
