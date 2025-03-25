
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Paperclip, Send, Smile } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface MessageInputProps {
  chatId: string;
  onSendMessage?: (content: string) => void;
}

const MessageInput = ({ chatId, onSendMessage }: MessageInputProps) => {
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  
  const handleSendMessage = () => {
    if (!message.trim()) return;
    
    setIsSending(true);
    
    // Call the onSendMessage callback if provided
    if (onSendMessage) {
      onSendMessage(message.trim());
    }
    
    // Simulate sending a message
    setTimeout(() => {
      setMessage("");
      setIsSending(false);
      toast.success("Message sent");
    }, 500);
  };
  
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };
  
  const checkForMacros = (text: string) => {
    // More comprehensive macro detection
    if (text.startsWith("ASK ") || 
        text.startsWith("BID ") || 
        text.startsWith("OFFER ") ||
        text.includes("Airwaybill") ||
        text.includes("CoO for") ||
        text.includes("Analysis for")) {
      return true;
    }
    return false;
  };
  
  const hasMacro = checkForMacros(message);

  return (
    <div className="p-4 border-t border-border">
      {hasMacro && (
        <div className="mb-2 p-2 bg-amber-50 text-amber-700 rounded-md text-sm flex items-center">
          <span className="font-medium mr-1">Macro detected:</span> 
          Your message appears to contain industry-specific shorthand
        </div>
      )}
      
      <div className="flex items-end gap-2">
        <Button variant="ghost" size="icon" type="button">
          <Paperclip className="h-5 w-5 text-muted-foreground" />
        </Button>
        
        <div className="flex-1 relative">
          <textarea
            className={cn(
              "chat-input min-h-[52px] max-h-32 py-3 resize-none",
              hasMacro && "border-amber-300"
            )}
            placeholder="Type a message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyPress}
            rows={1}
          />
        </div>
        
        <Button variant="ghost" size="icon" type="button">
          <Smile className="h-5 w-5 text-muted-foreground" />
        </Button>
        
        <Button 
          type="button" 
          size="icon" 
          className={cn(
            "rounded-full transition-all duration-200",
            !message.trim() && "opacity-50 cursor-not-allowed"
          )}
          disabled={!message.trim() || isSending}
          onClick={handleSendMessage}
        >
          <Send className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
};

export default MessageInput;
