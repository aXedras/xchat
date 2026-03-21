import { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ProfileSectionCardProps {
  title: string;
  description: string;
  children: ReactNode;
}

export function ProfileSectionCard({ title, description, children }: Readonly<ProfileSectionCardProps>) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}