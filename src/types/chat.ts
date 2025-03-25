
export interface Chat {
  id: string;
  name: string;
  lastMessage: string;
  timestamp: string;
  unread: number;
  avatar?: string;
  isGroup?: boolean;
  isCompany?: boolean;
  members?: string[];
  isTyping?: boolean;
}

export interface Message {
  id: string;
  content: string;
  sender: string;
  timestamp: string;
  status: "sent" | "delivered" | "read";
  isMine: boolean;
  isMacro?: boolean;
}

export interface User {
  id: string;
  name: string;
  role: string;
}

export interface Company {
  id: string;
  name: string;
  location: string;
  type: string;
  users: User[];
}
