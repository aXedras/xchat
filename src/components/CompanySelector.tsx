
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
import { companies } from "@/data/mockCompanies";

interface CompanySelectorProps {
  onClose: () => void;
  onCreateChat: (chatData: {
    chatType: 'direct' | 'group' | 'broadcast';
    company: Company;
    participantEmails: string[];
    selectedUsers: UserType[];
    groupName?: string;
  }) => void | Promise<void>;
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
    participantEmails: string[];
    selectedUsers: UserType[];
    groupName?: string;
  }) => {
    void onCreateChat(chatData);
    
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
                participantEmails: [],
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
