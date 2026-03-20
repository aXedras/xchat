import { RealtimeCarrier, RealtimeEvent, RealtimeListener, isRealtimeEvent } from "@/services/realtime/types";

const CHANNEL_NAME = "xchat.realtime";
const STORAGE_KEY = "xchat.realtime.event";

function isBrowser() {
  return globalThis.window !== undefined;
}

export class LocalRealtimeCarrier implements RealtimeCarrier {
  private readonly listeners = new Set<RealtimeListener>();
  private readonly channel: BroadcastChannel | null = null;

  constructor() {
    if (!isBrowser()) {
      return;
    }

    if (typeof BroadcastChannel !== "undefined") {
      this.channel = new BroadcastChannel(CHANNEL_NAME);
      this.channel.onmessage = (event) => {
        this.emit(event.data);
      };
    }

    globalThis.addEventListener("storage", this.handleStorageEvent);
  }

  subscribe(listener: RealtimeListener) {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  publish(event: RealtimeEvent) {
    if (!isBrowser()) {
      return;
    }

    if (this.channel) {
      this.channel.postMessage(event);
    }

    // LocalStorage event as cross-tab fallback where BroadcastChannel is unavailable.
    globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(event));
    globalThis.localStorage.removeItem(STORAGE_KEY);
  }

  destroy() {
    if (!isBrowser()) {
      return;
    }

    this.channel?.close();
    globalThis.removeEventListener("storage", this.handleStorageEvent);
    this.listeners.clear();
  }

  private readonly handleStorageEvent = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY || !event.newValue) {
      return;
    }

    try {
      this.emit(JSON.parse(event.newValue));
    } catch {
      // Ignore malformed payloads.
    }
  };

  private emit(value: unknown) {
    if (!isRealtimeEvent(value)) {
      return;
    }

    this.listeners.forEach((listener) => listener(value));
  }
}
