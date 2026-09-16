import {
  Button,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  ProfileSectionCard,
  toast,
  useForm,
  z,
  zodResolver,
} from "@/components/profile/profileFormKit";
import { ProfileUserData } from "@/types/profile";
import { useTranslation } from "react-i18next";

interface ProfileFormProps {
  userData: ProfileUserData;
  setUserData: React.Dispatch<React.SetStateAction<ProfileUserData>>;
  isEditing: boolean;
  setIsEditing: (isEditing: boolean) => void;
}

export const ProfileForm = ({ userData, setUserData, isEditing, setIsEditing }: ProfileFormProps) => {
  const { t } = useTranslation();

  const profileFormSchema = z.object({
    username: z.string().min(2, {
      message: t("profile.usernameMin"),
    }),
    email: z.string().email({
      message: t("profile.invalidEmail"),
    }),
    name: z.string().min(2, {
      message: t("profile.nameMin"),
    }),
    role: z.string().optional(),
  });

  type ProfileFormValues = z.infer<typeof profileFormSchema>;

  const profileFieldConfig: Array<{
    name: keyof ProfileFormValues;
    label: string;
    placeholder: string;
    type?: "email";
    description?: string;
  }> = [
    {
      name: "name",
      label: t("common.name"),
      placeholder: t("profile.namePlaceholder"),
    },
    {
      name: "username",
      label: t("profile.username"),
      placeholder: t("profile.usernamePlaceholder"),
    },
    {
      name: "email",
      label: t("common.email"),
      placeholder: t("profile.emailPlaceholder"),
      type: "email",
    },
    {
      name: "role",
      label: t("common.role"),
      placeholder: t("profile.rolePlaceholder"),
      description: t("profile.roleDesc"),
    },
  ];

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: userData.name,
      email: userData.email,
      username: userData.username,
      role: userData.role,
    },
  });

  const onProfileSubmit = (data: ProfileFormValues) => {
    setUserData({
      ...userData,
      name: data.name,
      email: data.email,
      username: data.username,
      role: data.role || "",
    });
    toast.success(t("profile.profileUpdated"));
    setIsEditing(false);
  };

  return (
    <ProfileSectionCard
      title={t("profile.profileInfo")}
      description={t("profile.profileInfoDesc")}
    >
        <Form {...profileForm}>
          <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-6">
            {profileFieldConfig.map((fieldConfig) => (
              <FormField
                key={fieldConfig.name}
                control={profileForm.control}
                name={fieldConfig.name}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{fieldConfig.label}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={fieldConfig.placeholder}
                        type={fieldConfig.type}
                        {...field}
                        disabled={!isEditing}
                      />
                    </FormControl>
                    {fieldConfig.description ? (
                      <FormDescription>{fieldConfig.description}</FormDescription>
                    ) : null}
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
            
            {isEditing && (
              <Button type="submit">{t("profile.saveChanges")}</Button>
            )}
          </form>
        </Form>
    </ProfileSectionCard>
  );
};
