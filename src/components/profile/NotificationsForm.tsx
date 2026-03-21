
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ProfileSectionCard } from "@/components/profile/ProfileSectionCard";
import { logger } from "@/services/logger";

const notificationsFormSchema = z.object({
  emailNotifications: z.boolean().default(true),
  pushNotifications: z.boolean().default(false),
});

type NotificationsFormValues = z.infer<typeof notificationsFormSchema>;

const notificationFieldConfig: Array<{
  name: keyof NotificationsFormValues;
  label: string;
  description: string;
}> = [
  {
    name: "emailNotifications",
    label: "Email Notifications",
    description: "Receive notifications via email.",
  },
  {
    name: "pushNotifications",
    label: "Push Notifications",
    description: "Receive notifications on your device.",
  },
];

export const NotificationsForm = () => {
  const notificationsForm = useForm<NotificationsFormValues>({
    resolver: zodResolver(notificationsFormSchema),
    defaultValues: {
      emailNotifications: true,
      pushNotifications: false,
    },
  });

  const onNotificationsSubmit = (data: NotificationsFormValues) => {
    logger.info("Notification settings updated", data);
    toast.success("Notification preferences updated");
  };

  return (
    <ProfileSectionCard
      title="Notification Settings"
      description="Manage how you receive notifications."
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
                            {field.value ? "On" : "Off"}
                          </span>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </div>
                      </FormControl>
                    </FormItem>
                  )}
                />
              ))}
            </div>
            
            <Button type="submit">Save Preferences</Button>
          </form>
        </Form>
    </ProfileSectionCard>
  );
};
