import config from "@/config/environment";
import { AdminConnectionState, AdminConnectionStatus, createDisconnectedAdminConnectionState } from "@/types/admin";

const STORAGE_KEY = "xchat.adminConnection";
const LEGACY_TOKEN_KEY = "api_token";

type Listener = () => void;

const listeners = new Set<Listener>();

function isBrowser() {
  return globalThis.window !== undefined && globalThis.localStorage !== undefined;
}

function getMode() {
  return config.api.mode;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStatus(value: unknown): value is AdminConnectionStatus {
  return value === "disconnected" || value === "connecting" || value === "connected" || value === "error";
}

function parseStoredState(raw: string | null): AdminConnectionState | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed) || !isStatus(parsed.status)) {
      return null;
    }

    return {
      status: parsed.status,
      mode: getMode(),
      token: typeof parsed.token === "string" && parsed.token.length > 0 ? parsed.token : null,
      errorMessage: typeof parsed.errorMessage === "string" && parsed.errorMessage.length > 0 ? parsed.errorMessage : null,
      connectedAt: typeof parsed.connectedAt === "string" && parsed.connectedAt.length > 0 ? parsed.connectedAt : null,
    };
  } catch {
    return null;
  }
}

function persistState(state: AdminConnectionState) {
  if (!isBrowser()) {
    return;
  }

  if (state.status === "disconnected" && !state.token && !state.errorMessage && !state.connectedAt) {
    globalThis.localStorage.removeItem(STORAGE_KEY);
    globalThis.localStorage.removeItem(LEGACY_TOKEN_KEY);
    return;
  }

  globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

  if (state.token) {
    globalThis.localStorage.setItem(LEGACY_TOKEN_KEY, state.token);
    return;
  }

  globalThis.localStorage.removeItem(LEGACY_TOKEN_KEY);
}

function buildLegacyState(token: string): AdminConnectionState {
  return {
    status: "connected",
    mode: getMode(),
    token,
    errorMessage: null,
    connectedAt: new Date().toISOString(),
  };
}

function readInitialState(): AdminConnectionState {
  const disconnectedState = createDisconnectedAdminConnectionState(getMode());
  if (!isBrowser()) {
    return disconnectedState;
  }

  const storedState = parseStoredState(globalThis.localStorage.getItem(STORAGE_KEY));
  if (storedState) {
    return storedState;
  }

  const legacyToken = globalThis.localStorage.getItem(LEGACY_TOKEN_KEY);
  if (!legacyToken) {
    return disconnectedState;
  }

  const legacyState = buildLegacyState(legacyToken);
  persistState(legacyState);
  return legacyState;
}

let connectionState = readInitialState();

function updateState(nextState: AdminConnectionState) {
  connectionState = nextState;
  persistState(nextState);
  listeners.forEach((listener) => listener());
}

export const adminConnectionStore = {
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  getState() {
    if (connectionState.mode !== getMode()) {
      updateState({ ...connectionState, mode: getMode() });
    }

    return connectionState;
  },

  setConnecting() {
    const state = this.getState();
    updateState({ ...state, status: "connecting", errorMessage: null });
  },

  setConnected(token: string) {
    updateState({
      status: "connected",
      mode: getMode(),
      token,
      errorMessage: null,
      connectedAt: new Date().toISOString(),
    });
  },

  setError(message: string) {
    updateState({
      status: "error",
      mode: getMode(),
      token: null,
      errorMessage: message,
      connectedAt: null,
    });
  },

  clear() {
    updateState(createDisconnectedAdminConnectionState(getMode()));
  },

  getToken() {
    return this.getState().status === "connected" ? this.getState().token : null;
  },

  isConnected() {
    return this.getState().status === "connected" && !!this.getState().token;
  },
};