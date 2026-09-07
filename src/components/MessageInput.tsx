import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";

interface MessageInputProps {
  disabled?: boolean;
  onSendMessage?: (content: string) => Promise<boolean> | boolean;
}

const MessageInput = ({ disabled, onSendMessage }: MessageInputProps) => {
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleSendMessage = async () => {
    if (!message.trim() || isSending) return;
    setIsSending(true);
    try {
      const sent = await onSendMessage?.(message.trim());
      if (sent === true) {
        setMessage("");
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSendMessage();
    }
  };

  return (
    <div className="p-4 border-t border-border">
      <div className="flex items-end gap-2">
        <div className="flex-1 relative">
          <textarea
            className={cn("chat-input min-h-[52px] max-h-32 py-3 resize-none")}
            placeholder="Type a message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyPress}
            rows={1}
          />
        </div>

        <Button
          type="button"
          size="icon"
          aria-label="Send message"
          className={cn(
            "rounded-full transition-all duration-200",
            (!message.trim() || isSending || disabled) && "opacity-50 cursor-not-allowed",
          )}
          disabled={!message.trim() || isSending || disabled}
          onClick={() => void handleSendMessage()}
        >
          <Send className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
};

export default MessageInput;
