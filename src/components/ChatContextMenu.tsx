
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Archive, Trash2, CornerUpLeft } from "lucide-react";
import { Chat } from "@/types/chat";
import { useTranslation } from "react-i18next";

interface ChatContextMenuProps {
  chat: Chat;
  children: React.ReactNode;
  onDelete: (chatId: string) => void;
  onArchive?: (chatId: string) => void;
  onRestore?: (chatId: string) => void;
  isArchived?: boolean;
}

const ChatContextMenu = ({ 
  chat, 
  children, 
  onDelete, 
  onArchive, 
  onRestore, 
  isArchived = false 
}: ChatContextMenuProps) => {
  const { t } = useTranslation();

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        {!isArchived && onArchive && (
          <ContextMenuItem
            className="flex items-center cursor-pointer text-muted-foreground"
            onClick={() => onArchive(chat.id)}
          >
            <Archive className="mr-2 h-4 w-4" />
            <span>{t("chat.archiveChat")}</span>
          </ContextMenuItem>
        )}
        
        {isArchived && onRestore && (
          <ContextMenuItem
            className="flex items-center cursor-pointer text-muted-foreground"
            onClick={() => onRestore(chat.id)}
          >
            <CornerUpLeft className="mr-2 h-4 w-4" />
            <span>{t("chat.restoreChat")}</span>
          </ContextMenuItem>
        )}
        
        <ContextMenuSeparator />
        <ContextMenuItem
          className="flex items-center cursor-pointer text-destructive"
          onClick={() => onDelete(chat.id)}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          <span>{t("chat.deleteChat")}</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};

export default ChatContextMenu;
