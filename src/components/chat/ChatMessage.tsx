
import { Message } from "@/types/chat";
import { Check, CheckCheck, FileUp, PhoneOutgoing } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { toast } from "sonner";

interface ChatMessageProps {
  message: Message;
}

const ChatMessage = ({ message }: ChatMessageProps) => {
  const [showingActions, setShowingActions] = useState(false);
  
  // Get status icon based on message status
  const getStatusIcon = (status: Message["status"]) => {
    switch (status) {
      case "sent":
        return <Check className="h-3 w-3 text-muted-foreground" />;
      case "delivered":
        return <Check className="h-3 w-3 text-blue-500" />;
      case "read":
        return <CheckCheck className="h-3 w-3 text-blue-500" />;
      default:
        return null;
    }
  };

  // Handle file upload button click
  const handleFileUpload = () => {
    toast.success("File browser would open here");
    // In a real implementation, this would trigger a file browser
    // and handle the upload process
  };

  // Handle callback button click
  const handleCallback = () => {
    toast.success("Callback response sent");
    // In a real implementation, this would send an automatic response
  };

  // Translate macro content to human-readable form
  const translateMacroContent = (content: string) => {
    if (content.startsWith("ASK")) {
      // Check if this is an Airwaybill request
      if (content.includes("Airwaybill")) {
        const orderNumber = content.match(/#(\d+)/)?.[1] || "the order";
        return `Could you please send me the Airwaybill for shipping number #${orderNumber}?`;
      }
      
      // Parse the ASK macro for metals
      const parts = content.split(" ");
      if (parts.length >= 4) {
        const quantity = parts[1]; // e.g., "10x1KG"
        const metal = parts[2]; // e.g., "AU"
        
        // Map metal codes to full names
        const metalNames: Record<string, string> = {
          "AU": "gold",
          "AG": "silver",
          "PT": "platinum",
          "PD": "palladium",
          "RH": "rhodium"
        };
        
        const metalName = metalNames[metal] || metal;
        return `I'm looking for ${quantity} of ${metalName}. Could you provide pricing for this based on the parameters: ${parts.slice(3).join(" ")}`;
      }
      return `I'm looking for ${content.substring(4).trim()}. Can you provide pricing?`;
    } 
    else if (content.startsWith("BID")) {
      const parts = content.split(" ");
      if (parts.length >= 4) {
        const quantity = parts[1];
        const metal = parts[2];
        
        const metalNames: Record<string, string> = {
          "AU": "gold",
          "AG": "silver",
          "PT": "platinum",
          "PD": "palladium",
          "RH": "rhodium"
        };
        
        const metalName = metalNames[metal] || metal;
        return `I'd like to place a bid to buy ${quantity} of ${metalName} with the following specifications: ${parts.slice(3).join(" ")}`;
      }
      return `I'd like to buy ${content.substring(4).trim()}. This is my offer price.`;
    }
    else if (content.startsWith("OFFER")) {
      const parts = content.split(" ");
      if (parts.length >= 4) {
        const quantity = parts[1];
        const metal = parts[2];
        
        const metalNames: Record<string, string> = {
          "AU": "gold",
          "AG": "silver",
          "PT": "platinum",
          "PD": "palladium",
          "RH": "rhodium"
        };
        
        const metalName = metalNames[metal] || metal;
        return `I'd like to offer for sale ${quantity} of ${metalName} with the following specifications: ${parts.slice(3).join(" ")}`;
      }
      return `I'd like to sell ${content.substring(6).trim()}. This is my asking price.`;
    }
    else if (content.includes("Airwaybill")) {
      const orderNumber = content.match(/#(\d+)/)?.[1] || "the order";
      return `Could you please send me the Airwaybill for shipping number #${orderNumber}?`;
    }
    else if (content.includes("CoO for")) {
      const orderNumber = content.match(/#(\d+)/)?.[1] || "the order";
      return `Could you please send me the Certificate of Origin for order #${orderNumber}?`;
    }
    else if (content.includes("Analysis for")) {
      const orderNumber = content.match(/#(\d+)/)?.[1] || "the order";
      return `Could you please send me the Material Analysis Certificate for order #${orderNumber}?`;
    }
    
    return content;
  };

  // Check if this message should show action buttons (only for received macro messages)
  const shouldShowActions = !message.isMine && message.isMacro;
  
  // Set the translated content
  const displayContent = message.isMacro 
    ? translateMacroContent(message.content) 
    : message.content;

  return (
    <div
      className={cn(
        "flex",
        message.isMine ? "justify-end" : "justify-start"
      )}
    >
      <div 
        className={cn(
          message.isMine ? "chat-bubble-sent" : "chat-bubble-received",
          message.isMacro && "macro-message"
        )}
        onMouseEnter={() => setShowingActions(true)}
        onMouseLeave={() => setShowingActions(false)}
      >
        {!message.isMine && (
          <div className="font-semibold text-xs mb-1">
            {message.sender}
          </div>
        )}
        
        <div>
          {displayContent}
          
          {message.isMacro && (
            <div className="text-xs mt-1 bg-background/20 px-2 py-1 rounded text-muted-foreground">
              <span className="font-mono">Macro: {message.content}</span>
            </div>
          )}
        </div>
        
        {shouldShowActions && (
          <div className="flex justify-between mt-3 pt-2 border-t border-border/30">
            <Button 
              variant="secondary" 
              size="sm" 
              className="text-xs h-8"
              onClick={handleFileUpload}
            >
              <FileUp className="h-3 w-3 mr-1" />
              Upload File
            </Button>
            
            <Button 
              variant="outline" 
              size="sm" 
              className="text-xs h-8"
              onClick={handleCallback}
            >
              <PhoneOutgoing className="h-3 w-3 mr-1" />
              Will Call Back
            </Button>
          </div>
        )}
        
        <div className="text-xs mt-1 opacity-70 flex items-center justify-end gap-1">
          {message.timestamp}
          {message.isMine && getStatusIcon(message.status)}
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
