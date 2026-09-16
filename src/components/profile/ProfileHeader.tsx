import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Edit, Upload } from "lucide-react";
import { getInitials } from "@/utils/format";
import { fileToBase64, validateImageFile } from "@/utils/fileUtils";
import { toast } from "sonner";
import { ProfileUserData } from "@/types/profile";
import { useTranslation } from "react-i18next";
import { authService } from "@/services/authService";
import { updateMyAvatar } from "@/services/profileService";
import { logger } from "@/services/logger";

interface ProfileHeaderProps {
  userData: ProfileUserData;
  setUserData: React.Dispatch<React.SetStateAction<ProfileUserData>>;
  isEditing: boolean;
  setIsEditing: (isEditing: boolean) => void;
}

const ProfileHeader = ({
  userData,
  setUserData,
  isEditing,
  setIsEditing,
}: ProfileHeaderProps) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validation = validateImageFile(file);
    if (!validation.valid) {
      toast.error(validation.message);
      return;
    }

    try {
      const base64 = await fileToBase64(file);

      await updateMyAvatar(base64);
      authService.setAvatarUrl(base64);

      setUserData({
        ...userData,
        avatarUrl: base64,
      });
      toast.success(t("profile.avatarUpdated"));
    } catch (error) {
      logger.error("Profile: failed to update avatar", { error });
      toast.error(t("profile.avatarFailed"));
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="flex flex-col md:flex-row gap-6 mb-8">
      <div className="flex-shrink-0 flex flex-col items-center">
        <Avatar
          className="h-32 w-32 md:h-40 md:w-40 cursor-pointer"
          onClick={handleAvatarClick}
        >
          <AvatarImage src={userData.avatarUrl} alt={userData.name} />
          <AvatarFallback className="text-2xl">
            {getInitials(userData.name)}
          </AvatarFallback>
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
          {t("profile.changeAvatar")}
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
            {isEditing ? t("common.cancel") : t("profile.editProfile")}
            {!isEditing && <Edit className="ml-2 h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ProfileHeader;
