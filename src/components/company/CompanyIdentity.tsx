import { Building } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Company } from "@/types/chat";
import { getInitials } from "@/utils/format";

interface CompanyIdentityProps {
  company: Company;
}

export function CompanyIdentity({ company }: Readonly<CompanyIdentityProps>) {
  return (
    <div className="flex items-center gap-3">
      <Avatar className="h-10 w-10 bg-muted">
        <Building className="h-5 w-5 text-muted-foreground" />
        <AvatarFallback>{getInitials(company.name)}</AvatarFallback>
      </Avatar>

      <div>
        <h3 className="font-medium">{company.name}</h3>
        <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
          <span>{company.location}</span>
          <span>•</span>
          <span>{company.type}</span>
        </div>
      </div>
    </div>
  );
}