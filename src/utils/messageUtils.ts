import { Message } from "@/types/chat";

function byCreatedAt(left: Message, right: Message) {
  const time = (left.createdAt ?? "").localeCompare(right.createdAt ?? "");
  if (time !== 0) {
    return time;
  }
  return left.id.localeCompare(right.id);
}

export function sortMessagesChronologically(messages: Message[]): Message[] {
  return [...messages].sort(byCreatedAt);
}

/**
 * Merges messages by stable id and returns them in ascending chronological order.
 * All state paths (initial load, realtime, send result) must use this to stay
 * deterministic and duplicate-free.
 */
export function mergeMessages(existing: Message[], incoming: Message[]): Message[] {
  const byId = new Map<string, Message>();
  existing.forEach((message) => byId.set(message.id, message));
  incoming.forEach((message) => byId.set(message.id, message));
  return sortMessagesChronologically(Array.from(byId.values()));
}
