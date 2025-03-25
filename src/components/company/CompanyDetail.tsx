
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Building, Users, UserPlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import UserSelector from "@/components/UserSelector";
import { Company, User } from "@/types/chat";
import { getInitials } from "@/utils/format";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

interface CompanyDetailProps {
  company: Company;
  onBack: () => void;
  onCreateChat: (chatData: {
    chatType: 'direct' | 'group' | 'broadcast';
    company: Company;
    selectedUsers: User[];
    groupName?: string;
  }) => void;
}

const CompanyDetail = ({ company, onBack, onCreateChat }: CompanyDetailProps) => {
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [chatType, setChatType] = useState<"direct" | "group" | "broadcast">("direct");
  const [groupName, setGroupName] = useState("");
  
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
    const selectedUserObjects = selectedUsers.map(
      userId => company.users.find(u => u.id === userId)
    ).filter(Boolean) as User[];
    
    onCreateChat({
      chatType,
      company,
      selectedUsers: selectedUserObjects,
      groupName: chatType === "group" ? groupName : undefined
    });
  };
  
  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <div className="flex items-center justify-between mb-4">
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
        
        <Button variant="outline" onClick={onBack}>
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
            users={company.users}
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
            users={company.users}
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
                  const user = company.users.find(u => u.id === userId);
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
            Send a message to everyone at {company.name}
          </p>
          
          <div className="p-6 border border-border rounded-lg bg-accent/20 text-center">
            <Building className="h-8 w-8 text-primary mx-auto mb-3" />
            <h3 className="font-medium text-lg mb-1">{company.name} Broadcast</h3>
            <p className="text-muted-foreground mb-4">
              Your message will be sent to all {company.users.length} users
            </p>
            <Button onClick={handleCreateChat}>
              Create Broadcast Channel
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CompanyDetail;
