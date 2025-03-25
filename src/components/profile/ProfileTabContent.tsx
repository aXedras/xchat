
import { ProfileForm } from "./ProfileForm";
import { SecurityForm } from "./SecurityForm";
import { NotificationsForm } from "./NotificationsForm";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Shield, Bell } from "lucide-react";

interface ProfileTabContentProps {
  userData: {
    name: string;
    email: string;
    username: string;
    role: string;
    avatarUrl: string;
  };
  setUserData: (data: any) => void;
  isEditing: boolean;
}

const ProfileTabContent = ({ userData, setUserData, isEditing }: ProfileTabContentProps) => {
  return (
    <Tabs defaultValue="profile" className="w-full">
      <TabsList className="grid grid-cols-3 max-w-md mb-6">
        <TabsTrigger value="profile" className="flex items-center gap-2">
          <User className="h-4 w-4" />
          <span>Profile</span>
        </TabsTrigger>
        <TabsTrigger value="security" className="flex items-center gap-2">
          <Shield className="h-4 w-4" />
          <span>Security</span>
        </TabsTrigger>
        <TabsTrigger value="notifications" className="flex items-center gap-2">
          <Bell className="h-4 w-4" />
          <span>Notifications</span>
        </TabsTrigger>
      </TabsList>
      
      <TabsContent value="profile">
        <ProfileForm userData={userData} setUserData={setUserData} isEditing={isEditing} />
      </TabsContent>
      
      <TabsContent value="security">
        <SecurityForm />
      </TabsContent>
      
      <TabsContent value="notifications">
        <NotificationsForm />
      </TabsContent>
    </Tabs>
  );
};

export default ProfileTabContent;
