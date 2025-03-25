import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Building, Search, User, UserPlus, Users } from "lucide-react";
import UserSelector from "@/components/UserSelector";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Company, User as UserType } from "@/types/chat";

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
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [chatType, setChatType] = useState<"direct" | "group" | "broadcast">("direct");
  const [groupName, setGroupName] = useState("");
  
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
  
  const filteredCompanies = companies.filter(company => 
    company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    company.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
    company.type.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const handleSelectCompany = (company: Company) => {
    setSelectedCompany(company);
  };
  
  const handleUserToggle = (userId: string) => {
    setSelectedUsers(prev => {
      if (prev.includes(userId)) {
        return prev.filter(id => id !== userId);
      } else {
        if (chatType === "direct" && prev.length > 0) {
          return [userId];
        }
        return [...prev, userId];
      }
    });
  };
  
  const handleCreateChat = () => {
    if (!selectedCompany) return;
    
    if (chatType === "direct" && selectedUsers.length === 0) {
      toast.error("Please select a user");
      return;
    }
    
    if (chatType === "group" && groupName.trim() === "") {
      toast.error("Please enter a group name");
      return;
    }
    
    const selectedUserObjects = selectedUsers.map(
      userId => selectedCompany.users.find(u => u.id === userId)
    ).filter(Boolean) as UserType[];
    
    onCreateChat({
      chatType,
      company: selectedCompany,
      selectedUsers: selectedUserObjects,
      groupName: chatType === "group" ? groupName : undefined
    });
    
    const chatTypeLabel = chatType === "direct" ? "direct message" : 
                          chatType === "group" ? "group chat" : "broadcast";
    toast.success(`Created ${chatTypeLabel} successfully`);
  };
  
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
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
                    onClick={() => handleSelectCompany(company)}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10 bg-muted">
                        <Building className="h-5 w-5 text-muted-foreground" />
                        <AvatarFallback>{getInitials(company.name)}</AvatarFallback>
                      </Avatar>
                      
                      <div>
                        <h3 className="font-medium">{company.name}</h3>
                        <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                          <span>{company.location}</span>
                          <span>•</span>
                          <span>{company.type}</span>
                        </div>
                      </div>
                    </div>
                    
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
      ) : (
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 bg-muted">
                <Building className="h-5 w-5 text-muted-foreground" />
                <AvatarFallback>{getInitials(selectedCompany.name)}</AvatarFallback>
              </Avatar>
              
              <div>
                <h3 className="font-medium">{selectedCompany.name}</h3>
                <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                  <span>{selectedCompany.location}</span>
                  <span>•</span>
                  <span>{selectedCompany.type}</span>
                </div>
              </div>
            </div>
            
            <Button variant="outline" onClick={() => setSelectedCompany(null)}>
              Change Company
            </Button>
          </div>
          
          <Tabs defaultValue="direct" onValueChange={(v) => setChatType(v as any)}>
            <TabsList className="grid grid-cols-3 mb-4">
              <TabsTrigger value="direct">Direct Message</TabsTrigger>
              <TabsTrigger value="group">Group Chat</TabsTrigger>
              <TabsTrigger value="broadcast">Broadcast</TabsTrigger>
            </TabsList>
            
            <TabsContent value="direct" className="flex-1 overflow-hidden flex flex-col">
              <p className="text-sm text-muted-foreground mb-4">
                Select a single user to start a direct conversation
              </p>
              
              <UserSelector
                users={selectedCompany.users}
                selectedUsers={selectedUsers}
                onToggleUser={handleUserToggle}
                selectionMode="single"
              />
            </TabsContent>
            
            <TabsContent value="group" className="flex-1 overflow-hidden flex flex-col">
              <div className="mb-4">
                <label className="text-sm font-medium mb-1 block">Group Name</label>
                <Input
                  placeholder="Enter group name..."
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                />
              </div>
              
              <p className="text-sm text-muted-foreground mb-4">
                Select multiple users to create a group
              </p>
              
              <UserSelector
                users={selectedCompany.users}
                selectedUsers={selectedUsers}
                onToggleUser={handleUserToggle}
                selectionMode="multiple"
              />
              
              {selectedUsers.length > 0 && (
                <div className="mt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Selected Users</span>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {selectedUsers.map(userId => {
                      const user = selectedCompany.users.find(u => u.id === userId);
                      if (!user) return null;
                      
                      return (
                        <Badge key={userId} variant="secondary" className="py-1 px-2">
                          {user.name}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="broadcast" className="flex-1 overflow-hidden flex flex-col">
              <p className="text-sm text-muted-foreground mb-4">
                Send a message to everyone at {selectedCompany.name}
              </p>
              
              <div className="p-6 border border-border rounded-lg bg-accent/20 text-center">
                <Building className="h-8 w-8 text-primary mx-auto mb-3" />
                <h3 className="font-medium text-lg mb-1">{selectedCompany.name} Broadcast</h3>
                <p className="text-muted-foreground mb-4">
                  Your message will be sent to all {selectedCompany.users.length} users
                </p>
                <Button onClick={handleCreateChat}>
                  Create Broadcast Channel
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}
      
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        
        {selectedCompany && chatType !== "broadcast" && (
          <Button 
            onClick={handleCreateChat} 
            disabled={(chatType === "direct" && selectedUsers.length === 0) || 
                      (chatType === "group" && (groupName.trim() === "" || selectedUsers.length === 0))}
          >
            <UserPlus className="mr-2 h-4 w-4" />
            {chatType === "direct" ? "Start Conversation" : "Create Group"}
          </Button>
        )}
        
        {selectedCompany && chatType === "broadcast" && (
          <Button onClick={handleCreateChat}>
            <UserPlus className="mr-2 h-4 w-4" />
            Create Broadcast
          </Button>
        )}
      </DialogFooter>
    </DialogContent>
  );
};

export default CompanySelector;
