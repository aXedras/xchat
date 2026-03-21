
import { useState } from "react";
import { Search, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { CompanyIdentity } from "@/components/company/CompanyIdentity";
import { Company } from "@/types/chat";

interface CompanyListProps {
  companies: Company[];
  onSelectCompany: (company: Company) => void;
}

const CompanyList = ({ companies, onSelectCompany }: CompanyListProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  
  const filteredCompanies = companies.filter(company => 
    company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    company.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
    company.type.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search companies by name, location, or type..."
          className="pl-9"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      
      <div className="flex-1 overflow-y-auto pr-2 -mr-2">
        {filteredCompanies.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No companies found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredCompanies.map((company) => (
              <div
                key={company.id}
                className="border border-border rounded-lg p-4 hover:border-primary/50 hover:bg-accent/30 transition-colors cursor-pointer"
                onClick={() => onSelectCompany(company)}
              >
                <CompanyIdentity company={company} />
                
                <div className="mt-3 flex items-center gap-1">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {company.users.length} contacts
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CompanyList;
