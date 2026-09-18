
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ProfileSectionCard } from "@/components/profile/ProfileSectionCard";
import { logger } from "@/services/logger";
import { useTranslation } from "react-i18next";

const notificationsFormSchema = z.object({
  emailNotifications: z.boolean().default(true),
  pushNotifications: z.boolean().default(false),
});

type NotificationsFormValues = z.infer<typeof notificationsFormSchema>;

export const NotificationsForm = () => {
  const { t } = useTranslation();

  const notificationFieldConfig: Array<{
    name: keyof NotificationsFormValues;
    label: string;
    description: string;
  }> = [
    {
      name: "emailNotifications",
      label: t("profile.emailNotifications"),
      description: t("profile.emailNotificationsDesc"),
    },
    {
      name: "pushNotifications",
      label: t("profile.pushNotifications"),
      description: t("profile.pushNotificationsDesc"),
    },
  ];

  const notificationsForm = useForm<NotificationsFormValues>({
    resolver: zodResolver(notificationsFormSchema),
    defaultValues: {
      emailNotifications: true,
      pushNotifications: false,
    },
  });

  const onNotificationsSubmit = (data: NotificationsFormValues) => {
    logger.info("Notification settings updated", data);
    toast.success(t("profile.notificationUpdated"));
  };

  return (
    <ProfileSectionCard
      title={t("profile.notificationSettings")}
      description={t("profile.notificationSettingsDesc")}
    >
        <Form {...notificationsForm}>
          <form onSubmit={notificationsForm.handleSubmit(onNotificationsSubmit)} className="space-y-6">
            <div className="space-y-4">
              {notificationFieldConfig.map((fieldConfig) => (
                <FormField
                  key={fieldConfig.name}
                  control={notificationsForm.control}
                  name={fieldConfig.name}
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">{fieldConfig.label}</FormLabel>
                        <FormDescription>{fieldConfig.description}</FormDescription>
                      </div>
                      <FormControl>
                        <div className="flex items-center gap-3">
                          <span className={field.value ? "text-primary" : "text-muted-foreground"}>
                            {field.value ? t("common.on") : t("common.off")}
                          </span>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </div>
                      </FormControl>
                    </FormItem>
                  )}
                />
              ))}
            </div>
            
            <Button type="submit">{t("profile.savePreferences")}</Button>
          </form>
        </Form>
    </ProfileSectionCard>
  );
};
