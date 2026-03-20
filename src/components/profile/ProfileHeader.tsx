
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Edit, Upload } from "lucide-react";
import { getInitials } from "@/utils/format";
import { fileToBase64, validateImageFile } from "@/utils/fileUtils";
import { toast } from "sonner";
import { ProfileUserData } from "@/types/profile";

interface ProfileHeaderProps {
  userData: ProfileUserData;
  setUserData: React.Dispatch<React.SetStateAction<ProfileUserData>>;
  isEditing: boolean;
  setIsEditing: (isEditing: boolean) => void;
}

const ProfileHeader = ({ userData, setUserData, isEditing, setIsEditing }: ProfileHeaderProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validation = validateImageFile(file);
    if (!validation.valid) {
      toast.error(validation.message);
      return;
    }

    try {
      const base64 = await fileToBase64(file);
      setUserData({
        ...userData,
        avatarUrl: base64,
      });
      toast.success("Avatar updated successfully");
    } catch (error) {
      console.error("Error converting file:", error);
      toast.error("Failed to update avatar");
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="flex flex-col md:flex-row gap-6 mb-8">
      <div className="flex-shrink-0 flex flex-col items-center">
        <Avatar className="h-32 w-32 md:h-40 md:w-40 cursor-pointer" onClick={handleAvatarClick}>
          <AvatarImage src={userData.avatarUrl} alt={userData.name} />
          <AvatarFallback className="text-2xl">{getInitials(userData.name)}</AvatarFallback>
        </Avatar>
        
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
        
        <Button 
          variant="outline" 
          size="sm" 
          className="mt-4 gap-2"
          onClick={handleAvatarClick}
        >
          <Upload className="h-4 w-4" />
          Change Avatar
        </Button>
      </div>
      
      <div className="flex-1 space-y-2">
        <h1 className="text-3xl font-bold">{userData.name}</h1>
        <p className="text-muted-foreground">{userData.role}</p>
        <p className="text-muted-foreground">{userData.email}</p>
        <div className="flex gap-2 mt-4">
          <Button 
            onClick={() => setIsEditing(!isEditing)}
            variant={isEditing ? "outline" : "default"}
          >
            {isEditing ? "Cancel" : "Edit Profile"}
            {!isEditing && <Edit className="ml-2 h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ProfileHeader;
