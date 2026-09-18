import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import RfqComposer from "@/components/chat/RfqComposer";
import { RfqTerms } from "@/types/chat";

interface MessageInputProps {
  disabled?: boolean;
  onSendMessage?: (content: string) => Promise<boolean> | boolean;
  onSendRfq?: (terms: RfqTerms, content: string) => Promise<boolean> | boolean;
}

const RFQ_MACROS = new Set(["rfq", "/rfq"]);

const MessageInput = ({ disabled, onSendMessage, onSendRfq }: MessageInputProps) => {
  const { t } = useTranslation();
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<"standard" | "rfq">("standard");
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

  const handleSendRfq = async (terms: RfqTerms, content: string) => {
    if (isSending) return;
    setIsSending(true);
    try {
      const sent = await onSendRfq?.(terms, content);
      if (sent === true) {
        setMode("standard");
        setMessage("");
      }
    } finally {
      setIsSending(false);
    }
  };

  const submitCurrentMessage = () => {
    if (RFQ_MACROS.has(message.trim().toLowerCase())) {
      setMode("rfq");
      setMessage("");
      return;
    }
    void handleSendMessage();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitCurrentMessage();
    }
  };

  return (
    <div className="p-4 border-t border-border">
      {mode === "rfq" ? (
        <div className="space-y-2">
          <RfqComposer
            disabled={disabled || isSending}
            onSubmit={(terms, content) => void handleSendRfq(terms, content)}
          />
          <div className="flex gap-1 text-xs">
            <button
              type="button"
              className="px-2 py-1 rounded hover:bg-accent"
              onClick={() => setMode("standard")}
            >
              {t("composer.message")}
            </button>
            <span className="px-2 py-1 rounded bg-primary text-primary-foreground">
              {t("composer.rfq")}
            </span>
          </div>
        </div>
      ) : (
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              className={cn("chat-input min-h-[52px] max-h-32 py-3 resize-none")}
              placeholder={t("chat.typeMessage")}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              rows={1}
            />
          </div>

          <Button
            type="button"
            size="icon"
            aria-label={t("chat.sendMessage")}
            className={cn(
              "rounded-full transition-all duration-200",
              (!message.trim() || isSending || disabled) && "opacity-50 cursor-not-allowed",
            )}
            disabled={!message.trim() || isSending || disabled}
            onClick={submitCurrentMessage}
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default MessageInput;
