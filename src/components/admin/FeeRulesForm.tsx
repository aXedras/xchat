import { ChangeEvent, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { companies } from "@/data/mockCompanies";
import { feeService } from "@/services/feeService";
import { logger } from "@/services/logger";
import { FeeRule } from "@/types/chat";
import { Download, Plus, Save, Upload } from "lucide-react";
import { toast } from "sonner";
import { FeeRuleEditor } from "@/components/admin/fee-rules/FeeRuleEditor";
import { buildNewRule, downloadTextFile, validateRule } from "@/components/admin/fee-rules/formConfig";

const FeeRulesForm = () => {
  const [profiles, setProfiles] = useState(() => feeService.listProfiles());
  const importInputRef = useRef<HTMLInputElement>(null);

  const companyOptions = useMemo(() => {
    const fromProfiles = profiles.map((profile) => profile.company);
    const fromCompanies = companies.map((company) => company.name);
    const unique = new Set([...fromCompanies, ...fromProfiles]);
    return Array.from(unique).sort((left, right) => left.localeCompare(right));
  }, [profiles]);

  const [selectedCompany, setSelectedCompany] = useState(companyOptions[0] ?? "Argor-Heraeus");

  const selectedRules = useMemo(() => {
    return profiles.find((profile) => profile.company === selectedCompany)?.rules ?? [];
  }, [profiles, selectedCompany]);

  const ruleErrors = useMemo(() => {
    return Object.fromEntries(selectedRules.map((rule) => [rule.id, validateRule(rule)]));
  }, [selectedRules]);

  const hasValidationErrors = selectedRules.some((rule) => Object.keys(ruleErrors[rule.id] ?? {}).length > 0);

  const updateRules = (nextRules: FeeRule[]) => {
    setProfiles((previous) => {
      const found = previous.some((profile) => profile.company === selectedCompany);
      if (!found) {
        return [...previous, { company: selectedCompany, rules: nextRules }];
      }

      return previous.map((profile) => {
        if (profile.company !== selectedCompany) {
          return profile;
        }

        return {
          ...profile,
          rules: nextRules,
        };
      });
    });
  };

  const handleRuleChange = (ruleId: string, updates: Partial<FeeRule>) => {
    const nextRules = selectedRules.map((rule) => (rule.id === ruleId ? { ...rule, ...updates } : rule));
    updateRules(nextRules);
  };

  const handleAddRule = () => {
    updateRules([...selectedRules, buildNewRule()]);
  };

  const handleDeleteRule = (ruleId: string) => {
    updateRules(selectedRules.filter((rule) => rule.id !== ruleId));
  };

  const handleSave = () => {
    if (hasValidationErrors) {
      toast.error("Please fix all validation errors before saving");
      return;
    }
    feeService.saveProfile(selectedCompany, selectedRules);
    toast.success(`Fee rules for ${selectedCompany} saved`);
  };

  const handleExportJson = () => {
    downloadTextFile("xchat-fee-profiles.json", feeService.exportProfilesAsJson(), "application/json");
  };

  const handleExportCsv = () => {
    downloadTextFile("xchat-fee-profiles.csv", feeService.exportProfilesAsCsv(), "text/csv;charset=utf-8");
  };

  const handleImportJsonClick = () => {
    importInputRef.current?.click();
  };

  const handleImportJsonChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const content = await file.text();
      const nextProfiles = feeService.importProfilesFromJson(content);
      setProfiles(nextProfiles);
      if (nextProfiles.length > 0) {
        setSelectedCompany(nextProfiles[0].company);
      }
      toast.success("Fee profiles imported successfully");
    } catch (error) {
      toast.error("Unable to import fee profile JSON");
      logger.error("Fee profile import failed", { error });
    } finally {
      event.target.value = "";
    }
  };

  return (
    <div className="space-y-6 rounded-lg border bg-card p-4">
      <div className="space-y-2">
        <h3 className="text-lg font-medium">Customer Fee Matrix</h3>
        <p className="text-sm text-muted-foreground">
          Define per-customer fees (percent, bps, fixed) with priority, validity window, and minimum quantity.
          Active rules are automatically included in quote discussions and deal conversion.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={handleExportJson}>
          <Download className="mr-2 h-4 w-4" />
          Export JSON
        </Button>
        <Button type="button" variant="outline" onClick={handleExportCsv}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
        <Button type="button" variant="outline" onClick={handleImportJsonClick}>
          <Upload className="mr-2 h-4 w-4" />
          Import JSON
        </Button>
        <input
          ref={importInputRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={handleImportJsonChange}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
        <div className="space-y-2">
          <Label htmlFor="fee-company">Customer / Company</Label>
          <Select value={selectedCompany} onValueChange={setSelectedCompany}>
            <SelectTrigger id="fee-company">
              <SelectValue placeholder="Select customer" />
            </SelectTrigger>
            <SelectContent>
              {companyOptions.map((companyName) => (
                <SelectItem key={companyName} value={companyName}>
                  {companyName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <Button type="button" variant="outline" className="w-full" onClick={handleAddRule}>
            <Plus className="mr-2 h-4 w-4" />
            Add Fee Rule
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {selectedRules.length === 0 ? (
          <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            No fee rules configured for {selectedCompany}. Add a rule to start automatic fee application.
          </p>
        ) : (
          selectedRules.map((rule) => (
            <FeeRuleEditor key={rule.id} rule={rule} errors={ruleErrors[rule.id]} onChange={handleRuleChange} onDelete={handleDeleteRule} />
          ))
        )}
      </div>

      <Button type="button" className="w-full" onClick={handleSave} disabled={hasValidationErrors}>
        <Save className="mr-2 h-4 w-4" />
        Save Fee Rules
      </Button>
    </div>
  );
};

export default FeeRulesForm;
