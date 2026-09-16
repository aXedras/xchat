import { useEffect, useState } from "react";
import Header from "@/components/Header";
import ProfileHeader from "@/components/profile/ProfileHeader";
import ProfileTabContent from "@/components/profile/ProfileTabContent";
import { ProfileUserData } from "@/types/profile";
import { authService } from "@/services/authService";
import { getMyProfile } from "@/services/profileService";
import { logger } from "@/services/logger";

const Profile = () => {
  const [isEditing, setIsEditing] = useState(false);

  const [userData, setUserData] = useState<ProfileUserData>({
    name: "Jane Doe",
    email: "jane.doe@example.com",
    username: "janedoe",
    role: "Product Manager",
    avatarUrl: authService.getAppIdentity()?.avatarUrl ?? "",
  });

  useEffect(() => {
    let active = true;

    const loadProfile = async () => {
      try {
        const profile = await getMyProfile();
        if (!active || !profile) {
          return;
        }

        setUserData((current) => ({
          ...current,
          name: profile.fullName || current.name,
          avatarUrl: profile.avatarUrl || current.avatarUrl,
        }));
      } catch (error) {
        logger.error("Profile: failed to load profile data", { error });
      }
    };

    void loadProfile();

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="h-screen flex flex-col bg-background">
      <Header />

      <div className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
        <div className="max-w-5xl mx-auto">
          <ProfileHeader
            userData={userData}
            setUserData={setUserData}
            isEditing={isEditing}
            setIsEditing={setIsEditing}
          />

          <ProfileTabContent
            userData={userData}
            setUserData={setUserData}
            isEditing={isEditing}
            setIsEditing={setIsEditing}
          />
        </div>
      </div>
    </div>
  );
};

export default Profile;
