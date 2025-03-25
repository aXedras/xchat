
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const notificationsFormSchema = z.object({
  emailNotifications: z.boolean().default(true),
  pushNotifications: z.boolean().default(false),
});

type NotificationsFormValues = z.infer<typeof notificationsFormSchema>;

export const NotificationsForm = () => {
  const notificationsForm = useForm<NotificationsFormValues>({
    resolver: zodResolver(notificationsFormSchema),
    defaultValues: {
      emailNotifications: true,
      pushNotifications: false,
    },
  });

  const onNotificationsSubmit = (data: NotificationsFormValues) => {
    console.log("Notification settings updated:", data);
    toast.success("Notification preferences updated");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification Settings</CardTitle>
        <CardDescription>
          Manage how you receive notifications.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...notificationsForm}>
          <form onSubmit={notificationsForm.handleSubmit(onNotificationsSubmit)} className="space-y-6">
            <div className="space-y-4">
              <FormField
                control={notificationsForm.control}
                name="emailNotifications"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        Email Notifications
                      </FormLabel>
                      <FormDescription>
                        Receive notifications via email.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <div className="flex items-center space-x-2">
                        <Label
                          htmlFor="emailNotifications"
                          className={field.value ? "text-primary" : "text-muted-foreground"}
                        >
                          {field.value ? "On" : "Off"}
                        </Label>
                        <input
                          type="checkbox"
                          id="emailNotifications"
                          checked={field.value}
                          onChange={field.onChange}
                          className="sr-only"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => field.onChange(!field.value)}
                          className={`relative h-8 w-14 rounded-full ${
                            field.value ? "bg-primary" : "bg-input"
                          }`}
                        >
                          <span
                            className={`absolute inset-0 m-1 h-6 w-6 rounded-full bg-background transition-transform ${
                              field.value ? "translate-x-6" : "translate-x-0"
                            }`}
                          />
                        </Button>
                      </div>
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <FormField
                control={notificationsForm.control}
                name="pushNotifications"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        Push Notifications
                      </FormLabel>
                      <FormDescription>
                        Receive notifications on your device.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <div className="flex items-center space-x-2">
                        <Label
                          htmlFor="pushNotifications"
                          className={field.value ? "text-primary" : "text-muted-foreground"}
                        >
                          {field.value ? "On" : "Off"}
                        </Label>
                        <input
                          type="checkbox"
                          id="pushNotifications"
                          checked={field.value}
                          onChange={field.onChange}
                          className="sr-only"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => field.onChange(!field.value)}
                          className={`relative h-8 w-14 rounded-full ${
                            field.value ? "bg-primary" : "bg-input"
                          }`}
                        >
                          <span
                            className={`absolute inset-0 m-1 h-6 w-6 rounded-full bg-background transition-transform ${
                              field.value ? "translate-x-6" : "translate-x-0"
                            }`}
                          />
                        </Button>
                      </div>
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            
            <Button type="submit">Save Preferences</Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};
