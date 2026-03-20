import { CustomerFeeProfile, FeeRule, ProductClass } from "@/types/chat";

export interface FeeEvaluationContext {
  quantity?: string;
  asOf?: Date;
}

export const FEE_PROFILE_STORAGE_KEY = "xchat.feeProfiles";

export const defaultFeeProfiles: CustomerFeeProfile[] = [
  {
    company: "Argor-Heraeus",
    rules: [
      {
        id: "argor-handling",
        label: "Handling Fee",
        type: "percent",
        value: 2,
        priority: 100,
        productClass: "all",
        active: true,
      },
      {
        id: "argor-compliance",
        label: "Compliance Fee",
        type: "bps",
        value: 10,
        priority: 90,
        productClass: "gold",
        active: true,
      },
    ],
  },
  {
    company: "Firma B Metals",
    rules: [
      {
        id: "firmab-service",
        label: "Strategic Service Fee",
        type: "bps",
        value: 20,
        priority: 100,
        productClass: "all",
        active: true,
      },
    ],
  },
];

export function cloneProfiles(profiles: CustomerFeeProfile[]): CustomerFeeProfile[] {
  return structuredClone(profiles);
}

export function parsePremiumValue(premium?: string) {
  if (!premium) {
    return undefined;
  }

  const match = /([+-]?\d+(?:\.\d+)?)(%?)/.exec(premium);
  if (!match) {
    return undefined;
  }

  const value = Number(match[1]);
  if (Number.isNaN(value)) {
    return undefined;
  }

  return {
    value,
    hasPercent: match[2] === "%",
  };
}

export function parseQuantityValue(quantity?: string) {
  if (!quantity) {
    return undefined;
  }

  const match = /(\d+(?:\.\d+)?)/.exec(quantity);
  if (!match) {
    return undefined;
  }

  const value = Number(match[1]);
  return Number.isNaN(value) ? undefined : value;
}

export function formatFeeRule(rule: FeeRule) {
  if (rule.type === "bps") {
    return `${rule.value} bps ${rule.label}`;
  }

  if (rule.type === "fixed") {
    return `${rule.currency ?? "CHF"} ${rule.value.toFixed(2)} ${rule.label}`;
  }

  return `${rule.value}% ${rule.label}`;
}

export function getSurchargePercent(rule: FeeRule) {
  if (rule.type === "percent") {
    return rule.value;
  }

  if (rule.type === "bps") {
    return rule.value / 100;
  }

  return 0;
}

export function readProfilesFromStorage(): CustomerFeeProfile[] | undefined {
  if (globalThis.window === undefined) {
    return undefined;
  }

  const raw = globalThis.localStorage.getItem(FEE_PROFILE_STORAGE_KEY);
  if (!raw) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(raw) as CustomerFeeProfile[];
    return Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export function writeProfilesToStorage(profiles: CustomerFeeProfile[]) {
  if (globalThis.window === undefined) {
    return;
  }

  globalThis.localStorage.setItem(FEE_PROFILE_STORAGE_KEY, JSON.stringify(profiles));
}

export function isWithinValidity(rule: FeeRule, referenceDate: Date) {
  if (rule.validFrom) {
    const validFromDate = new Date(rule.validFrom);
    if (!Number.isNaN(validFromDate.getTime()) && referenceDate < validFromDate) {
      return false;
    }
  }

  if (rule.validTo) {
    const validToDate = new Date(rule.validTo);
    if (!Number.isNaN(validToDate.getTime()) && referenceDate > validToDate) {
      return false;
    }
  }

  return true;
}

export function deduplicateByPriority(rules: FeeRule[]) {
  const byLabel = new Map<string, FeeRule>();
  const sortedRules = [...rules].sort(
    (left, right) => right.priority - left.priority || left.label.localeCompare(right.label),
  );

  sortedRules.forEach((rule) => {
    if (!byLabel.has(rule.label.toLowerCase())) {
      byLabel.set(rule.label.toLowerCase(), rule);
    }
  });

  return Array.from(byLabel.values()).sort(
    (left, right) => right.priority - left.priority || left.label.localeCompare(right.label),
  );
}

export function findMatchingRules(
  profiles: CustomerFeeProfile[],
  company: string,
  productClass: ProductClass,
  context: FeeEvaluationContext = {},
) {
  const profile = profiles.find((entry) => entry.company.trim().toLowerCase() === company.trim().toLowerCase());
  if (!profile) {
    return [];
  }

  const asOf = context.asOf ?? new Date();
  const quantityValue = parseQuantityValue(context.quantity);

  return deduplicateByPriority(
    profile.rules.filter((rule) => {
      if (!rule.active) {
        return false;
      }

      if (!(rule.productClass === "all" || rule.productClass === productClass)) {
        return false;
      }

      if (!isWithinValidity(rule, asOf)) {
        return false;
      }

      if (rule.minimumQuantity !== undefined && (quantityValue === undefined || quantityValue < rule.minimumQuantity)) {
        return false;
      }

      return true;
    }),
  );
}

export function escapeCsv(value: string | number | undefined) {
  if (value === undefined || value === null) {
    return "";
  }

  const asString = String(value);
  if (asString.includes(",") || asString.includes("\"") || asString.includes("\n")) {
    return `"${asString.split("\"").join("\"\"")}"`;
  }

  return asString;
}