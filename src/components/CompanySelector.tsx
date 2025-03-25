
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import CompanyList from "./company/CompanyList";
import CompanyDetail from "./company/CompanyDetail";
import { Company, User as UserType } from "@/types/chat";

// Mock data - this would typically come from an API
const companies: Company[] = [
  {
    id: "1",
    name: "Argor-Heraeus",
    location: "Switzerland",
    type: "Refiner",
    users: [
      { id: "1-1", name: "Jane Smith", role: "Sales Manager" },
      { id: "1-2", name: "Robert Chen", role: "Operations Director" },
      { id: "1-3", name: "Elena Müller", role: "Compliance Officer" }
    ]
  },
  {
    id: "2",
    name: "PAMP",
    location: "Switzerland",
    type: "Refiner",
    users: [
      { id: "2-1", name: "Michael Thompson", role: "CEO" },
      { id: "2-2", name: "Sarah Miller", role: "Head of Trading" }
    ]
  },
  {
    id: "3",
    name: "Valcambi",
    location: "Switzerland",
    type: "Refiner",
    users: [
      { id: "3-1", name: "Thomas Weber", role: "Chief Technology Officer" },
      { id: "3-2", name: "Lisa Johnson", role: "Supply Chain Manager" }
    ]
  },
  {
    id: "4",
    name: "Royal Canadian Mint",
    location: "Canada",
    type: "Mint",
    users: [
      { id: "4-1", name: "David Wilson", role: "Product Manager" },
      { id: "4-2", name: "Emily Brown", role: "Head of Security" }
    ]
  },
  {
    id: "5",
    name: "Brinks Global Services",
    location: "United States",
    type: "Logistics",
    users: [
      { id: "5-1", name: "James Clark", role: "Operations Manager" },
      { id: "5-2", name: "Patricia Martinez", role: "Client Relations" }
    ]
  }
];

interface CompanySelectorProps {
  onClose: () => void;
  onCreateChat: (chatData: {
    chatType: 'direct' | 'group' | 'broadcast';
    company: Company;
    selectedUsers: UserType[];
    groupName?: string;
  }) => void;
}

const CompanySelector = ({ onClose, onCreateChat }: CompanySelectorProps) => {
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  
  const handleSelectCompany = (company: Company) => {
    setSelectedCompany(company);
  };
  
  const handleBack = () => {
    setSelectedCompany(null);
  };
  
  const handleCreateChat = (chatData: {
    chatType: 'direct' | 'group' | 'broadcast';
    company: Company;
    selectedUsers: UserType[];
    groupName?: string;
  }) => {
    onCreateChat(chatData);
    
    const chatTypeLabel = chatData.chatType === "direct" ? "direct message" : 
                          chatData.chatType === "group" ? "group chat" : "broadcast";
    toast.success(`Created ${chatTypeLabel} successfully`);
  };
  
  return (
    <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
      <DialogHeader>
        <DialogTitle>Start New Conversation</DialogTitle>
        <DialogDescription>
          {selectedCompany 
            ? `Select recipients from ${selectedCompany.name}` 
            : "Select a company to start a conversation"}
        </DialogDescription>
      </DialogHeader>
      
      {!selectedCompany ? (
        <CompanyList 
          companies={companies}
          onSelectCompany={handleSelectCompany}
        />
      ) : (
        <CompanyDetail
          company={selectedCompany}
          onBack={handleBack}
          onCreateChat={handleCreateChat}
        />
      )}
      
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        
        {selectedCompany && (
          <Button 
            onClick={() => {
              if (selectedCompany.users.length === 0) {
                toast.error("This company has no users to message");
                return;
              }
              handleCreateChat({
                chatType: "broadcast",
                company: selectedCompany,
                selectedUsers: []
              });
            }}
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Quick Broadcast
          </Button>
        )}
      </DialogFooter>
    </DialogContent>
  );
};

export default CompanySelector;
