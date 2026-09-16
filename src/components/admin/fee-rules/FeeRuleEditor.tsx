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
import { Switch } from "@/components/ui/switch";
import { FeeRule } from "@/types/chat";
import { Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { feeTypeOptions, productClassOptions, RuleErrors } from "./formConfig";

interface FeeRuleEditorProps {
  rule: FeeRule;
  errors?: RuleErrors;
  onChange: (ruleId: string, updates: Partial<FeeRule>) => void;
  onDelete: (ruleId: string) => void;
}

export function FeeRuleEditor({ rule, errors, onChange, onDelete }: Readonly<FeeRuleEditorProps>) {
  const { t } = useTranslation();

  const errorText = (key?: string) => (key ? t(key) : undefined);

  return (
    <div className="grid gap-2 rounded-md border bg-background p-3 lg:grid-cols-8">
      <div className="space-y-1 lg:col-span-2">
        <Label>{t("adminFees.feeLabel")}</Label>
        <Input
          value={rule.label}
          onChange={(event) => onChange(rule.id, { label: event.target.value })}
          placeholder={t("adminFees.handlingFee")}
          aria-invalid={!!errors?.label}
          className={errors?.label ? "border-destructive" : ""}
        />
        {errors?.label && <p role="alert" className="text-xs text-destructive">{errorText(errors.label)}</p>}
      </div>

      <div className="space-y-1">
        <Label>{t("adminFees.type")}</Label>
        <Select value={rule.type} onValueChange={(value: FeeRule["type"]) => onChange(rule.id, { type: value })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {feeTypeOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {t(option.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label>{t("adminFees.value")}</Label>
        <Input
          type="number"
          step="0.01"
          min="0"
          value={Number.isFinite(rule.value) ? rule.value : 0}
          onChange={(event) => onChange(rule.id, { value: Number(event.target.value) })}
          aria-invalid={!!errors?.value}
          className={errors?.value ? "border-destructive" : ""}
        />
        {errors?.value && <p role="alert" className="text-xs text-destructive">{errorText(errors.value)}</p>}
      </div>

      <div className="space-y-1">
        <Label>{t("adminFees.product")}</Label>
        <Select value={rule.productClass} onValueChange={(value: FeeRule["productClass"]) => onChange(rule.id, { productClass: value })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {productClassOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {t(option.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label>{t("adminFees.priority")}</Label>
        <Input
          type="number"
          step="1"
          value={Number.isFinite(rule.priority) ? rule.priority : 100}
          onChange={(event) => onChange(rule.id, { priority: Number(event.target.value) })}
          aria-invalid={!!errors?.priority}
          className={errors?.priority ? "border-destructive" : ""}
        />
        {errors?.priority && <p role="alert" className="text-xs text-destructive">{errorText(errors.priority)}</p>}
      </div>

      <div className="space-y-1">
        <Label>{t("adminFees.minQty")}</Label>
        <Input
          type="number"
          step="0.01"
          min="0"
          value={rule.minimumQuantity ?? 0}
          onChange={(event) => onChange(rule.id, { minimumQuantity: Number(event.target.value) })}
          aria-invalid={!!errors?.minimumQuantity}
          className={errors?.minimumQuantity ? "border-destructive" : ""}
        />
        {errors?.minimumQuantity && <p role="alert" className="text-xs text-destructive">{errorText(errors.minimumQuantity)}</p>}
      </div>

      <div className="space-y-1">
        <Label>{t("adminFees.validFrom")}</Label>
        <Input
          type="date"
          value={rule.validFrom ?? ""}
          onChange={(event) => onChange(rule.id, { validFrom: event.target.value || undefined })}
          aria-invalid={!!errors?.validRange}
          className={errors?.validRange ? "border-destructive" : ""}
        />
      </div>

      <div className="space-y-1">
        <Label>{t("adminFees.validTo")}</Label>
        <Input
          type="date"
          value={rule.validTo ?? ""}
          onChange={(event) => onChange(rule.id, { validTo: event.target.value || undefined })}
          aria-invalid={!!errors?.validRange}
          className={errors?.validRange ? "border-destructive" : ""}
        />
        {errors?.validRange && <p role="alert" className="text-xs text-destructive lg:col-span-2">{errorText(errors.validRange)}</p>}
      </div>

      <div className="flex items-end justify-between gap-3 lg:col-span-8">
        <div className="flex items-center gap-2 pb-2">
          <Switch checked={rule.active} onCheckedChange={(checked) => onChange(rule.id, { active: checked })} />
          <span className="text-sm text-muted-foreground">{t("common.active")}</span>
        </div>
        <Button type="button" variant="ghost" size="icon" onClick={() => onDelete(rule.id)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
