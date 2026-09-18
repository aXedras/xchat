
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
import { logger } from "@/services/logger";
import { useTranslation } from "react-i18next";

export const SecurityForm = () => {
  const { t } = useTranslation();

  const securityFormSchema = z.object({
    currentPassword: z.string().min(8, {
      message: t("profile.passwordMin"),
    }),
    newPassword: z.string().min(8, {
      message: t("profile.passwordMin"),
    }),
    confirmPassword: z.string().min(8, {
      message: t("profile.passwordMin"),
    }),
  }).refine((data) => data.newPassword === data.confirmPassword, {
    message: t("profile.passwordMismatch"),
    path: ["confirmPassword"],
  });

  type SecurityFormValues = z.infer<typeof securityFormSchema>;

  const securityForm = useForm<SecurityFormValues>({
    resolver: zodResolver(securityFormSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const onSecuritySubmit = (data: SecurityFormValues) => {
    logger.info("Password updated", { hasCurrentPassword: Boolean(data.currentPassword) });
    securityForm.reset({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
    toast.success(t("profile.passwordUpdated"));
  };

  return (
    <ProfileSectionCard
      title={t("profile.securitySettings")}
      description={t("profile.securitySettingsDesc")}
    >
        <Form {...securityForm}>
          <form onSubmit={securityForm.handleSubmit(onSecuritySubmit)} className="space-y-6">
            <FormField
              control={securityForm.control}
              name="currentPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("profile.currentPassword")}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t("profile.currentPasswordPlaceholder")}
                      type="password"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={securityForm.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("profile.newPassword")}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t("profile.newPasswordPlaceholder")}
                      type="password"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {t("profile.passwordMin")}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={securityForm.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("profile.confirmPassword")}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t("profile.confirmPasswordPlaceholder")}
                      type="password"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit">{t("profile.updatePassword")}</Button>
          </form>
        </Form>
    </ProfileSectionCard>
  );
};
