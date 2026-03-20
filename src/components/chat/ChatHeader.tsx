
import { Chat } from "@/types/chat";
import MacroHelp from "@/components/MacroHelp";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { ChatAvatar, getDirectChatDetails } from "@/components/chat/chatPresentation";

interface ChatHeaderProps {
  chat: Chat;
}

const ChatHeader = ({ chat }: ChatHeaderProps) => {
  const chatDetails = getDirectChatDetails(chat);

  return (
    <div className="h-16 border-b border-border flex items-center px-4 justify-between">
      <div className="flex items-center gap-3">
        <ChatAvatar chat={chat} />
        <div>
          <h2 className="font-semibold flex items-center gap-1">
            {chat.isGroup ? (
              chat.name
            ) : chatDetails ? (
              <>
                <span>{chatDetails.company}</span>
              </>
            ) : (
              chat.name
            )}
          </h2>
          
          {chat.isGroup && chat.members && (
            chat.members.length > 3 ? (
              <HoverCard>
                <HoverCardTrigger asChild>
                  <p className="text-xs text-muted-foreground cursor-pointer">
                    {chat.members.slice(0, 3).join(", ")}
                    {` +${chat.members.length - 3} more`}
                  </p>
                </HoverCardTrigger>
                <HoverCardContent className="w-64 text-sm p-2">
                  <h4 className="font-medium mb-1">Group Participants:</h4>
                  <div className="max-h-48 overflow-y-auto">
                    <ul className="space-y-1">
                      {chat.members.map((member, index) => (
                        <li key={index} className="text-xs py-1 px-2 rounded hover:bg-accent">
                          {member}
                        </li>
                      ))}
                    </ul>
                  </div>
                </HoverCardContent>
              </HoverCard>
            ) : (
              <p className="text-xs text-muted-foreground">
                {chat.members.join(", ")}
              </p>
            )
          )}
          
          {/* Show individual name for company chats */}
          {!chat.isGroup && chatDetails && (
            <p className="text-xs text-muted-foreground">
              {chatDetails.person}
            </p>
          )}
        </div>
      </div>
      
      <MacroHelp />
    </div>
  );
};

export default ChatHeader;
