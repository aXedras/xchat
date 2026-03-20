
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

interface UserSelectorProps {
  users: { id: string; name: string; role: string }[];
  selectedUsers: string[];
  onToggleUser: (userId: string) => void;
  selectionMode: "single" | "multiple";
}

const UserSelector = ({ 
  users, 
  selectedUsers, 
  onToggleUser,
  selectionMode
}: UserSelectorProps) => {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <div className="flex-1 overflow-y-auto pr-2 -mr-2 space-y-2">
      {users.map((user) => (
        <div
          key={user.id}
          className={cn(
            "flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-accent/30 transition-colors cursor-pointer",
            selectedUsers.includes(user.id) && "border-primary bg-accent/40"
          )}
          onClick={() => onToggleUser(user.id)}
        >
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
            </Avatar>
            
            <div>
              <h3 className="font-medium">{user.name}</h3>
              <p className="text-sm text-muted-foreground">{user.role}</p>
            </div>
          </div>
          
          {selectionMode === "single" ? (
            <div className={cn(
              "h-4 w-4 rounded-full border border-primary transition-colors",
              selectedUsers.includes(user.id) && "bg-primary"
            )} />
          ) : (
            <Checkbox
              checked={selectedUsers.includes(user.id)}
              onCheckedChange={() => onToggleUser(user.id)}
            />
          )}
        </div>
      ))}
    </div>
  );
};

export default UserSelector;
