export type AdminApiMode = "mock" | "real";

export type AdminConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

export interface AdminConnectionState {
  status: AdminConnectionStatus;
  mode: AdminApiMode;
  token: string | null;
  errorMessage: string | null;
  connectedAt: string | null;
}

export function createDisconnectedAdminConnectionState(mode: AdminApiMode): AdminConnectionState {
  return {
    status: "disconnected",
    mode,
    token: null,
    errorMessage: null,
    connectedAt: null,
  };
}