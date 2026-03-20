import { FeeRule } from "@/types/chat";

export interface FeeTypeOption {
  value: FeeRule["type"];
  label: string;
}

export interface ProductClassOption {
  value: FeeRule["productClass"];
  label: string;
}

export interface RuleErrors {
  label?: string;
  value?: string;
  priority?: string;
  minimumQuantity?: string;
  validRange?: string;
}

export const feeTypeOptions: FeeTypeOption[] = [
  { value: "percent", label: "Percent (%)" },
  { value: "bps", label: "Basis Points (bps)" },
  { value: "fixed", label: "Fixed amount" },
];

export const productClassOptions: ProductClassOption[] = [
  { value: "all", label: "All products" },
  { value: "gold", label: "Gold" },
  { value: "silver", label: "Silver" },
  { value: "platinum", label: "Platinum" },
  { value: "palladium", label: "Palladium" },
  { value: "other", label: "Other" },
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
    errors.label = "Label is required";
  }

  if (!Number.isFinite(rule.value) || rule.value < 0) {
    errors.value = "Value must be >= 0";
  }

  if (!Number.isFinite(rule.priority) || rule.priority < 0) {
    errors.priority = "Priority must be >= 0";
  }

  if (rule.minimumQuantity !== undefined && (!Number.isFinite(rule.minimumQuantity) || rule.minimumQuantity < 0)) {
    errors.minimumQuantity = "Min quantity must be >= 0";
  }

  if (rule.validFrom && rule.validTo && rule.validFrom > rule.validTo) {
    errors.validRange = "Valid From must be on or before Valid To";
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