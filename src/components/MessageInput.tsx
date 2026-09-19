import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import RfqComposer from "@/components/chat/RfqComposer";
import TradingMacroLauncher, {
  DIRECT_MACRO_COMMANDS,
} from "@/components/chat/trading/TradingMacroLauncher";
import TransactionRfqComposer from "@/components/chat/trading/TransactionRfqComposer";
import { useTradingContext } from "@/hooks/useTradingContext";
import { RfqTermsV2 } from "@/schemas";
import { RfqTerms } from "@/types/chat";

interface MessageInputProps {
  disabled?: boolean;
  onSendMessage?: (content: string) => Promise<boolean> | boolean;
  onSendRfq?: (terms: RfqTerms, content: string) => Promise<boolean> | boolean;
  onSendRfqV2?: (
    terms: RfqTermsV2,
    recipientIds: string[],
    message: string,
  ) => Promise<boolean> | boolean;
}

type Mode = "standard" | "rfq" | "macro" | "rfqV2";

const MessageInput = ({
  disabled,
  onSendMessage,
  onSendRfq,
  onSendRfqV2,
}: MessageInputProps) => {
  const { t } = useTranslation();
  const { context } = useTradingContext();
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<Mode>("standard");
  const [transactionType, setTransactionType] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const v2Enabled = context?.flags?.transactionRfqV2 === true;

  const handleSendMessage = async () => {
    if (!message.trim() || isSending) return;
    setIsSending(true);
    try {
      const sent = await onSendMessage?.(message.trim());
      if (sent === true) setMessage("");
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

  const handleSendRfqV2 = async (
    terms: RfqTermsV2,
    recipientIds: string[],
    content: string,
  ) => {
    if (isSending) return;
    setIsSending(true);
    try {
      const sent = await onSendRfqV2?.(terms, recipientIds, content);
      if (sent === true) {
        setMode("standard");
        setMessage("");
        setTransactionType(null);
      }
    } finally {
      setIsSending(false);
    }
  };

  const submitCurrentMessage = () => {
    const trimmed = message.trim().toLowerCase();
    if (trimmed === "/rfq" || trimmed === "rfq") {
      if (v2Enabled) {
        setMode("macro");
      } else {
        setMode("rfq");
      }
      setMessage("");
      return;
    }
    const direct = trimmed.replace(/^\/+/, "");
    if (v2Enabled && direct in DIRECT_MACRO_COMMANDS) {
      setTransactionType(DIRECT_MACRO_COMMANDS[direct]);
      setMode("rfqV2");
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

  const renderMode = () => {
    if (mode === "macro") {
      return (
        <div className="space-y-2">
          <TradingMacroLauncher
            onSelect={(type) => {
              setTransactionType(type);
              setMode("rfqV2");
            }}
          />
          <button
            type="button"
            className="px-2 py-1 text-xs rounded hover:bg-accent"
            onClick={() => setMode("standard")}
          >
            {t("common.cancel")}
          </button>
        </div>
      );
    }

    if (mode === "rfqV2" && transactionType) {
      return (
        <div className="space-y-2">
          <TransactionRfqComposer
            transactionType={transactionType}
            disabled={disabled || isSending}
            onSubmit={(terms, recipientIds, content) =>
              void handleSendRfqV2(terms, recipientIds, content)
            }
          />
          <button
            type="button"
            className="px-2 py-1 text-xs rounded hover:bg-accent"
            onClick={() => setMode("macro")}
          >
            {t("rfqV2.changeMacro")}
          </button>
        </div>
      );
    }

    if (mode === "rfq") {
      return (
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
      );
    }

    return (
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
    );
  };

  return <div className="p-4 border-t border-border">{renderMode()}</div>;
};

export default MessageInput;
