import { Badge } from "@/components/ui/badge";
import {
  ComplianceFlag,
  CounterpartyDeal,
  GoldSilverTradeDealTerms,
  PlatinumPalladiumTradeDealTerms,
  TradeDealTerms,
} from "@/types/chat";
import { AlertTriangle } from "lucide-react";

interface TermField {
  label: string;
  value: string;
}

interface DealTermsDetailsProps {
  commonTerms: TermField[];
  productTerms: TermField[];
  accountSettlement: string;
  documentation: string[];
  complianceFlags: ComplianceFlag[];
}

export const termFieldClassName = "rounded-md border border-border/60 bg-muted/30 p-2";

const complianceBadgeConfig: Record<ComplianceFlag["severity"], string> = {
  positive: "border-emerald-200 bg-emerald-100 text-emerald-800",
  warning: "border-amber-200 bg-amber-100 text-amber-800",
  critical: "border-rose-200 bg-rose-100 text-rose-800",
};

function TermFieldsGrid({ fields }: { fields: TermField[] }) {
  if (!fields.length) {
    return null;
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {fields.map((field) => (
        <div key={field.label} className={termFieldClassName}>
          <p className="text-[11px] uppercase tracking-wide">{field.label}</p>
          <p className="mt-1 text-foreground">{field.value}</p>
        </div>
      ))}
    </div>
  );
}

function getProductTermFields(
  terms: CounterpartyDeal["terms"] | TradeDealTerms | GoldSilverTradeDealTerms | PlatinumPalladiumTradeDealTerms,
) {
  if ("goodDeliveryStandard" in terms) {
    return [
      { label: "Delivery standard", value: terms.goodDeliveryStandard },
      { label: "Bar form", value: terms.barForm },
      { label: "Vault location", value: terms.vaultLocation },
      { label: "Chain of custody", value: terms.chainOfCustody },
    ];
  }

  if ("lppmStatus" in terms) {
    return [
      { label: "LPPM status", value: terms.lppmStatus },
      { label: "Form factor", value: terms.formFactor },
      { label: "Assay certificate", value: terms.assayCertificate },
      { label: "Origin disclosure", value: terms.originDisclosure },
    ];
  }

  return [];
}

export function getDealTermsDetails(
  terms: CounterpartyDeal["terms"] | TradeDealTerms | GoldSilverTradeDealTerms | PlatinumPalladiumTradeDealTerms,
): DealTermsDetailsProps {
  return {
    commonTerms: [
      { label: "Price reference", value: terms.priceReference },
      { label: "Premium", value: terms.premium },
      { label: "Incoterm", value: terms.incoterm },
      { label: "Delivery window", value: terms.deliveryWindow },
      { label: "Payment terms", value: terms.paymentTerms },
      { label: "Settlement type", value: terms.settlementType },
    ],
    productTerms: getProductTermFields(terms),
    accountSettlement: terms.accountSettlement,
    documentation: terms.documentation,
    complianceFlags: terms.complianceFlags,
  };
}

export function DealTermsDetails({ commonTerms, productTerms, accountSettlement, documentation, complianceFlags }: DealTermsDetailsProps) {
  return (
    <div className="space-y-2 text-sm text-muted-foreground">
      <TermFieldsGrid fields={commonTerms} />
      <TermFieldsGrid fields={productTerms} />
      <div className={termFieldClassName}>
        <p className="text-[11px] uppercase tracking-wide">Account settlement</p>
        <p className="mt-1 text-foreground">{accountSettlement}</p>
      </div>
      <div className={termFieldClassName}>
        <p className="text-[11px] uppercase tracking-wide">Documentation</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {documentation.map((document) => (
            <Badge key={document} variant="outline" className="bg-background">
              {document}
            </Badge>
          ))}
        </div>
      </div>
      <div className={termFieldClassName}>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
          <p className="text-[11px] uppercase tracking-wide">Compliance flags</p>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {complianceFlags.map((flag) => (
            <Badge key={flag.label} variant="outline" className={complianceBadgeConfig[flag.severity]}>
              {flag.label}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}