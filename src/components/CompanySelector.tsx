import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ParticipantRecord, RfqTerms, SendMessagesResult } from "@/types/chat";
import { SendInput } from "@/hooks/useOutgoingMessage";
import RfqComposer from "@/components/chat/RfqComposer";

interface CompanySelectorProps {
  open: boolean;
  participants: ParticipantRecord[];
  sending: boolean;
  onClose: () => void;
  onSend: (
    recipientIds: string[],
    content: string,
  ) => Promise<SendMessagesResult | undefined>;
  onSendRfq: (
    recipientIds: string[],
    content: string,
    terms: RfqTerms,
  ) => Promise<SendMessagesResult | undefined>;
  onRetry: (
    original: SendInput & { dispatchId: string },
    retryRecipientIds: string[],
  ) => Promise<SendMessagesResult | undefined>;
}

interface PendingDispatch {
  dispatchId: string;
  recipientIds: string[];
  content: string;
  messageType?: "standard" | "rfq";
  rfqTerms?: Record<string, unknown>;
}

const CompanySelector = ({
  open,
  participants,
  sending,
  onClose,
  onSend,
  onSendRfq,
  onRetry,
}: CompanySelectorProps) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [content, setContent] = useState("");
  const [mode, setMode] = useState<"standard" | "rfq">("standard");
  const [pending, setPending] = useState<PendingDispatch | null>(null);
  const [lastResult, setLastResult] = useState<SendMessagesResult | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  // This component is always mounted (the Dialog only controls its visual
  // open state), so its dispatch-result state would otherwise persist
  // forever after the first send. Reset it every time the dialog reopens.
  useEffect(() => {
    if (open) {
      setSelectedIds([]);
      setContent("");
      setMode("standard");
      setPending(null);
      setLastResult(null);
      setLocalError(null);
    }
  }, [open]);

  const participantsById = useMemo(
    () =>
      new Map(
        participants.map((participant) => [participant.userId, participant]),
      ),
    [participants],
  );

  const rejectedIds = useMemo(() => {
    if (!lastResult) return [];
    return lastResult.dispatch.recipients
      .filter((recipient) => recipient.status === "rejected")
      .map((recipient) => recipient.requestedRecipientUserId);
  }, [lastResult]);

  const toggleParticipant = (userId: string) => {
    setSelectedIds((previous) =>
      previous.includes(userId)
        ? previous.filter((id) => id !== userId)
        : [...previous, userId],
    );
  };

  const handleSend = async () => {
    if (!content.trim() || selectedIds.length === 0 || sending) return;
    setLocalError(null);
    const result = await onSend(selectedIds, content.trim());
    if (!result) {
      setLocalError("Sending failed — please try again.");
      return;
    }
    setPending({
      dispatchId: result.dispatch.id,
      recipientIds: selectedIds,
      content: content.trim(),
    });
    setLastResult(result);
    if (result.dispatch.status === "completed") {
      onClose();
    }
  };

  const handleSendRfq = async (terms: RfqTerms, message: string) => {
    if (selectedIds.length === 0 || sending) return;
    setLocalError(null);
    const result = await onSendRfq(selectedIds, message, terms);
    if (!result) {
      setLocalError("Sending the RFQ failed — please try again.");
      return;
    }
    setPending({
      dispatchId: result.dispatch.id,
      recipientIds: selectedIds,
      content: message,
      messageType: "rfq",
      rfqTerms: terms as unknown as Record<string, unknown>,
    });
    setLastResult(result);
    if (result.dispatch.status === "completed") {
      onClose();
    }
  };

  const handleRetry = async () => {
    if (!pending || rejectedIds.length === 0 || sending) return;
    setLocalError(null);
    const result = await onRetry(pending, rejectedIds);
    if (!result) {
      setLocalError("Retry failed — please try again.");
      return;
    }
    setLastResult(result);
    if (result.dispatch.status === "completed") {
      onClose();
    }
  };

  return (
    <DialogContent className="max-w-xl max-h-[80vh] overflow-hidden flex flex-col">
      <DialogHeader>
        <DialogTitle>Start New Conversation</DialogTitle>
        <DialogDescription>
          Select one or more participants and send the first message. Each
          recipient gets their own bilateral conversation.
        </DialogDescription>
      </DialogHeader>

      {localError && (
        <div className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {localError}
        </div>
      )}

      {!lastResult ? (
        <>
          <div className="flex-1 overflow-y-auto space-y-1">
            {participants.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No participants available.
              </p>
            ) : (
              participants.map((participant) => {
                const selected = selectedIds.includes(participant.userId);
                return (
                  <button
                    key={participant.userId}
                    type="button"
                    onClick={() => toggleParticipant(participant.userId)}
                    className={`w-full text-left p-3 rounded-md border transition-colors ${
                      selected
                        ? "border-primary bg-primary/10"
                        : "border-border hover:bg-accent/40"
                    }`}
                  >
                    <div className="font-medium">{participant.displayName}</div>
                    {participant.organization && (
                      <div className="text-xs text-muted-foreground">
                        {participant.organization}
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>

          <div className="space-y-2 pt-2">
            {mode === "standard" ? (
              <textarea
                className="w-full chat-input min-h-[80px] p-3 resize-none"
                placeholder="Write your first message..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            ) : (
              <RfqComposer
                disabled={sending || selectedIds.length === 0}
                onSubmit={(terms, message) =>
                  void handleSendRfq(terms, message)
                }
              />
            )}

            <div className="flex justify-between items-center">
              <div className="flex gap-1 text-xs">
                <button
                  type="button"
                  className={`px-2 py-1 rounded ${mode === "standard" ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
                  onClick={() => setMode("standard")}
                >
                  Message
                </button>
                <button
                  type="button"
                  className={`px-2 py-1 rounded ${mode === "rfq" ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
                  onClick={() => setMode("rfq")}
                >
                  RFQ
                </button>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                {mode === "standard" && (
                  <Button
                    disabled={
                      !content.trim() || selectedIds.length === 0 || sending
                    }
                    onClick={() => void handleSend()}
                  >
                    Send to {selectedIds.length > 0 ? selectedIds.length : ""}{" "}
                    recipient{selectedIds.length === 1 ? "" : "s"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="space-y-3">
          <div className="text-sm font-medium">
            Dispatch status:{" "}
            <span className="uppercase">{lastResult.dispatch.status}</span>
          </div>

          <div className="space-y-1">
            {lastResult.dispatch.recipients.map((recipient) => {
              const participant = participantsById.get(
                recipient.requestedRecipientUserId,
              );
              return (
                <div
                  key={recipient.requestedRecipientUserId}
                  className="flex items-center justify-between rounded-md border border-border p-2 text-sm"
                >
                  <span>
                    {participant?.displayName ??
                      recipient.requestedRecipientUserId}
                  </span>
                  <span
                    className={
                      recipient.status === "accepted"
                        ? "text-emerald-600"
                        : "text-rose-600"
                    }
                  >
                    {recipient.status === "accepted"
                      ? "Accepted"
                      : `Rejected${recipient.errorCode ? ` (${recipient.errorCode})` : ""}`}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            {rejectedIds.length > 0 && (
              <Button disabled={sending} onClick={() => void handleRetry()}>
                Retry failed recipients
              </Button>
            )}
          </div>
        </div>
      )}
    </DialogContent>
  );
};

export default CompanySelector;
