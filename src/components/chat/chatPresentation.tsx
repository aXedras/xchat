import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/utils/format";
import { Chat } from "@/types/chat";
import { Building, Users } from "lucide-react";

export interface DirectChatDetails {
  person: string;
  company: string;
}

export function getDirectChatDetails(chat: Chat): DirectChatDetails | null {
  if (chat.isGroup) {
    return null;
  }

  const parts = chat.name.split(" - ");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return null;
  }

  return {
    person: parts[0],
    company: parts[1],
  };
}

export function ChatAvatar({ chat }: Readonly<{ chat: Chat }>) {
  if (chat.avatar) {
    return (
      <Avatar>
        <AvatarImage src={chat.avatar} alt={chat.name} />
        <AvatarFallback>{getInitials(chat.name)}</AvatarFallback>
      </Avatar>
    );
  }

  if (chat.isGroup) {
    return (
      <Avatar className="bg-purple-100">
        <Users className="h-5 w-5 text-purple-500" />
        <AvatarFallback>{getInitials(chat.name)}</AvatarFallback>
      </Avatar>
    );
  }

  if (chat.isCompany) {
    return (
      <Avatar className="bg-blue-100">
        <Building className="h-5 w-5 text-blue-500" />
        <AvatarFallback>{getInitials(chat.name)}</AvatarFallback>
      </Avatar>
    );
  }

  return (
    <Avatar>
      <AvatarFallback>{getInitials(chat.name)}</AvatarFallback>
    </Avatar>
  );
}