import { CustomerFeeProfile, FeeRule, ProductClass } from "@/types/chat";
import {
  cloneProfiles,
  defaultFeeProfiles,
  escapeCsv,
  FeeEvaluationContext,
  findMatchingRules,
  formatFeeRule,
  getSurchargePercent,
  parsePremiumValue,
  readProfilesFromStorage,
  writeProfilesToStorage,
} from "@/services/feeServiceSupport";

export const feeService = {
  listProfiles(): CustomerFeeProfile[] {
    const fromStorage = readProfilesFromStorage();
    return cloneProfiles(fromStorage ?? defaultFeeProfiles);
  },

  getProfile(company: string): CustomerFeeProfile | undefined {
    const normalizedCompany = company.trim().toLowerCase();
    return feeService
      .listProfiles()
      .find((profile) => profile.company.trim().toLowerCase() === normalizedCompany);
  },

  saveProfile(company: string, rules: FeeRule[]) {
    const profiles = feeService.listProfiles();
    const normalizedCompany = company.trim().toLowerCase();
    const nextProfile: CustomerFeeProfile = {
      company: company.trim(),
      rules,
    };

    const existingIndex = profiles.findIndex(
      (profile) => profile.company.trim().toLowerCase() === normalizedCompany,
    );

    if (existingIndex >= 0) {
      profiles[existingIndex] = nextProfile;
    } else {
      profiles.push(nextProfile);
    }

    writeProfilesToStorage(profiles);
  },

  getApplicableRules(company: string, productClass: ProductClass, context: FeeEvaluationContext = {}) {
    return findMatchingRules(feeService.listProfiles(), company, productClass, context);
  },

  buildFeeSummary(company: string, productClass: ProductClass, context: FeeEvaluationContext = {}) {
    const rules = findMatchingRules(feeService.listProfiles(), company, productClass, context);
    if (rules.length === 0) {
      return undefined;
    }

    return rules.map((rule) => formatFeeRule(rule)).join(" + ");
  },

  applyFeesToPremium(
    premium: string | undefined,
    company: string,
    productClass: ProductClass,
    context: FeeEvaluationContext = {},
  ) {
    const parsedPremium = parsePremiumValue(premium);
    const rules = findMatchingRules(feeService.listProfiles(), company, productClass, context);

    if (rules.length === 0) {
      return {
        quotedPremium: premium,
        feeSummary: undefined,
      };
    }

    const surchargePercent = rules.reduce((accumulator, rule) => accumulator + getSurchargePercent(rule), 0);
    const feeSummary = rules.map((rule) => formatFeeRule(rule)).join(" + ");

    if (!parsedPremium) {
      return {
        quotedPremium: premium,
        feeSummary,
      };
    }

    const adjusted = parsedPremium.value + surchargePercent;
    const suffix = parsedPremium.hasPercent ? "%" : "";

    return {
      quotedPremium: `${adjusted >= 0 ? "+" : ""}${adjusted.toFixed(2)}${suffix}`,
      feeSummary,
    };
  },

  exportProfilesAsJson() {
    return JSON.stringify(feeService.listProfiles(), null, 2);
  },

  importProfilesFromJson(rawContent: string) {
    const parsed = JSON.parse(rawContent) as CustomerFeeProfile[];
    if (!Array.isArray(parsed)) {
      throw new TypeError("Invalid fee profile payload");
    }

    writeProfilesToStorage(parsed);
    return cloneProfiles(parsed);
  },

  exportProfilesAsCsv() {
    const rows = [
      [
        "company",
        "ruleId",
        "label",
        "type",
        "value",
        "priority",
        "currency",
        "productClass",
        "minimumQuantity",
        "validFrom",
        "validTo",
        "active",
      ],
    ];

    feeService.listProfiles().forEach((profile) => {
      profile.rules.forEach((rule) => {
        const minimumQuantity = rule.minimumQuantity === undefined ? "" : String(rule.minimumQuantity);
        rows.push([
          profile.company,
          rule.id,
          rule.label,
          rule.type,
          String(rule.value),
          String(rule.priority),
          rule.currency ?? "",
          rule.productClass,
          minimumQuantity,
          rule.validFrom ?? "",
          rule.validTo ?? "",
          String(rule.active),
        ]);
      });
    });

    return rows.map((row) => row.map((value) => escapeCsv(value)).join(",")).join("\n");
  },
};
