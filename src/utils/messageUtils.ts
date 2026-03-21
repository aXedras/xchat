import { Message } from "@/types/chat";

export function sortMessagesChronologically(messages: Message[]) {
  return [...messages].sort((left, right) => {
    const leftTime = left.createdAt ?? left.timestamp;
    const rightTime = right.createdAt ?? right.timestamp;
    return leftTime.localeCompare(rightTime);
  });
}