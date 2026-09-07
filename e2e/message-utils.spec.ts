import { test, expect } from "@playwright/test";
import {
  mergeMessages,
  sortMessagesChronologically,
} from "../src/utils/messageUtils";
import type { Message } from "../src/types/chat";

function message(overrides: Partial<Message> & Pick<Message, "id">): Message {
  return {
    content: "content",
    sender: "Someone",
    timestamp: "now",
    createdAt: "2026-03-01T00:00:00.000Z",
    status: "sent",
    isMine: false,
    ...overrides,
  };
}

test("finding 9.1: a message delivered via both the send response and a realtime notification is not duplicated", () => {
  const fromSendResult = message({ id: "m-1", content: "hello" });

  // First the optimistic/send-response path adds the message...
  const afterSend = mergeMessages([], [fromSendResult]);
  expect(afterSend).toHaveLength(1);

  // ...then the realtime notification for the same message id arrives afterwards.
  const fromRealtime = message({ id: "m-1", content: "hello" });
  const afterRealtime = mergeMessages(afterSend, [fromRealtime]);

  expect(afterRealtime).toHaveLength(1);
  expect(afterRealtime[0].id).toBe("m-1");
});

test("finding 9.2: messages sharing the same created_at are ordered deterministically by id", () => {
  const a = message({
    id: "aaaaaaaa-0000-0000-0000-000000000001",
    createdAt: "2026-03-01T00:00:00.000Z",
  });
  const b = message({
    id: "bbbbbbbb-0000-0000-0000-000000000002",
    createdAt: "2026-03-01T00:00:00.000Z",
  });

  const sortedAscendingInput = sortMessagesChronologically([a, b]);
  const sortedDescendingInput = sortMessagesChronologically([b, a]);

  expect(sortedAscendingInput.map((m) => m.id)).toEqual([a.id, b.id]);
  expect(sortedDescendingInput.map((m) => m.id)).toEqual([a.id, b.id]);
});

test("finding 9.2: chronological order takes priority over id when created_at differs", () => {
  const earlier = message({
    id: "zzzzzzzz-0000-0000-0000-000000000001",
    createdAt: "2026-03-01T00:00:00.000Z",
  });
  const later = message({
    id: "aaaaaaaa-0000-0000-0000-000000000002",
    createdAt: "2026-03-02T00:00:00.000Z",
  });

  const sorted = sortMessagesChronologically([later, earlier]);

  expect(sorted.map((m) => m.id)).toEqual([earlier.id, later.id]);
});
