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

const profileFormSchema = z.object({
  username: z.string().min(2, {
    message: "Username must be at least 2 characters.",
  }),
  email: z.string().email({
    message: "Please enter a valid email address.",
  }),
  name: z.string().min(2, {
    message: "Name must be at least 2 characters.",
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
    label: "Name",
    placeholder: "Enter your full name",
  },
  {
    name: "username",
    label: "Username",
    placeholder: "Enter your username",
  },
  {
    name: "email",
    label: "Email",
    placeholder: "Enter your email",
    type: "email",
  },
  {
    name: "role",
    label: "Role",
    placeholder: "Enter your role",
    description: "Your role in the organization.",
  },
];

interface ProfileFormProps {
  userData: ProfileUserData;
  setUserData: React.Dispatch<React.SetStateAction<ProfileUserData>>;
  isEditing: boolean;
  setIsEditing: (isEditing: boolean) => void;
}

export const ProfileForm = ({ userData, setUserData, isEditing, setIsEditing }: ProfileFormProps) => {
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
    toast.success("Profile updated successfully");
    setIsEditing(false);
  };

  return (
    <ProfileSectionCard
      title="Profile Information"
      description="Update your account information and profile details."
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
              <Button type="submit">Save Changes</Button>
            )}
          </form>
        </Form>
    </ProfileSectionCard>
  );
};
