
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ProfileSectionCard } from "@/components/profile/ProfileSectionCard";
import { logger } from "@/services/logger";

const securityFormSchema = z.object({
  currentPassword: z.string().min(8, {
    message: "Password must be at least 8 characters.",
  }),
  newPassword: z.string().min(8, {
    message: "Password must be at least 8 characters.",
  }),
  confirmPassword: z.string().min(8, {
    message: "Password must be at least 8 characters.",
  }),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type SecurityFormValues = z.infer<typeof securityFormSchema>;

export const SecurityForm = () => {
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
    toast.success("Password updated successfully");
  };

  return (
    <ProfileSectionCard
      title="Security Settings"
      description="Manage your password and security settings."
    >
        <Form {...securityForm}>
          <form onSubmit={securityForm.handleSubmit(onSecuritySubmit)} className="space-y-6">
            <FormField
              control={securityForm.control}
              name="currentPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Current Password</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Enter your current password" 
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
                  <FormLabel>New Password</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Enter your new password" 
                      type="password" 
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription>
                    Password must be at least 8 characters.
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
                  <FormLabel>Confirm Password</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Confirm your new password" 
                      type="password" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <Button type="submit">Update Password</Button>
          </form>
        </Form>
    </ProfileSectionCard>
  );
};
