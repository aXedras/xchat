import { beforeEach, describe, expect, it, vi } from "vitest";
import { rfqRepositoryV2 } from "./rfqRepositoryV2";
import { MessagingError } from "./errors";

const rpc = vi.fn();
const mockClient = { rpc } as unknown as import("@supabase/supabase-js").SupabaseClient;

vi.mock("@/services/supabase/client", () => ({
  getSupabaseBrowserClient: () => mockClient,
}));

vi.mock("@/services/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const requesterProjection = {
  id: "00000000-0000-0000-0000-0000000000aa",
  publicReference: "RFQ-ABC123",
  transactionType: "SELL_DORE",
  schemaVersion: 1,
  status: "open",
  effectiveStatus: "open",
  responseDeadline: "2026-12-31T12:00:00Z",
  terms: { schemaVersion: 1, commercial: {}, material: {}, assay: {}, logistics: {} },
  createdAt: "2026-09-18T12:00:00Z",
  closedAt: null,
  closeReason: null,
  invitations: [
    {
      invitationId: "00000000-0000-0000-0000-0000000000bb",
      recipientUserId: "00000000-0000-0000-0000-0000000000cc",
      recipientOrganizationId: "00000000-0000-0000-0000-0000000000dd",
      status: "delivered",
      deliveredAt: "2026-09-18T12:00:01Z",
      firstViewedAt: null,
      respondedAt: null,
      closedAt: null,
    },
  ],
};

describe("rfqRepositoryV2 contract tests", () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it("maps the requester projection on the happy path", async () => {
    rpc.mockResolvedValueOnce({ data: requesterProjection, error: null });
    const result = await rfqRepositoryV2.getRequesterProjection(
      "00000000-0000-0000-0000-0000000000aa",
    );
    expect(result.id).toBe(requesterProjection.id);
    expect(result.invitations).toHaveLength(1);
    expect(result.invitations[0].recipientUserId).toBe(
      "00000000-0000-0000-0000-0000000000cc",
    );
  });

  it("maps the recipient projection on the happy path", async () => {
    rpc.mockResolvedValueOnce({
      data: {
        invitationId: "00000000-0000-0000-0000-0000000000bb",
        requestId: "00000000-0000-0000-0000-0000000000aa",
        publicReference: "RFQ-ABC123",
        transactionType: "SELL_DORE",
        status: "delivered",
        effectiveStatus: "open",
        responseDeadline: "2026-12-31T12:00:00Z",
        terms: { schemaVersion: 1 },
        createdAt: "2026-09-18T12:00:00Z",
        deliveredAt: "2026-09-18T12:00:01Z",
        firstViewedAt: null,
        respondedAt: null,
      },
      error: null,
    });
    const result = await rfqRepositoryV2.getRecipientProjection(
      "00000000-0000-0000-0000-0000000000bb",
    );
    expect(result.invitationId).toBe("00000000-0000-0000-0000-0000000000bb");
    expect(result.transactionType).toBe("SELL_DORE");
  });

  it("maps a business error to a non-retryable MessagingError", async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: {
        message: "not_authorized",
        details: JSON.stringify({ code: "not_authorized", correlationId: "c-1" }),
      },
    });
    await expect(
      rfqRepositoryV2.getRequesterProjection("00000000-0000-0000-0000-0000000000aa"),
    ).rejects.toMatchObject({ code: "not_authorized", retryable: false });
  });

  it("maps a network error to a retryable unknown MessagingError", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "fetch failed" } });
    await expect(
      rfqRepositoryV2.getRequesterProjection("00000000-0000-0000-0000-0000000000aa"),
    ).rejects.toMatchObject({ code: "unknown", retryable: true });
  });

  it("returns an empty list for a malformed transaction-type response", async () => {
    rpc.mockResolvedValueOnce({ data: { not: "an array" }, error: null });
    const result = await rfqRepositoryV2.listAvailableTransactionTypes();
    expect(result).toEqual([]);
  });

  it("fails closed on an unknown future schema version", async () => {
    rpc.mockResolvedValueOnce({
      data: { ...requesterProjection, terms: { schemaVersion: 99 } },
      error: null,
    });
    await expect(
      rfqRepositoryV2.getRequesterProjection("00000000-0000-0000-0000-0000000000aa"),
    ).rejects.toBeInstanceOf(MessagingError);
  });

  it("propagates the idempotency payload mismatch error", async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: { details: JSON.stringify({ code: "idempotency_payload_mismatch" }) },
    });
    await expect(
      rfqRepositoryV2.createAndDispatch({
        clientOperationId: "00000000-0000-0000-0000-0000000000ee",
        transactionType: "SELL_DORE",
        terms: {} as never,
        recipientIds: ["00000000-0000-0000-0000-0000000000cc"],
      }),
    ).rejects.toMatchObject({ code: "idempotency_payload_mismatch" });
  });
});
