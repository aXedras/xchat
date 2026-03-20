import config from "@/config/environment";
import { RealtimeCarrier, RealtimeEvent, RealtimeListener, isRealtimeEvent } from "@/services/realtime/types";

interface WebsocketEnvelope {
  channel: string;
  event: string;
  payload: unknown;
}

function isBrowser() {
  return globalThis.window !== undefined;
}

export class WebSocketRealtimeCarrier implements RealtimeCarrier {
  private readonly listeners = new Set<RealtimeListener>();
  private socket: WebSocket | null = null;

  constructor(
    private readonly wsUrl: string,
    private readonly channelName: string,
    private readonly eventName: string,
  ) {
    if (!isBrowser() || !this.wsUrl) {
      return;
    }

    this.connect();
  }

  subscribe(listener: RealtimeListener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  publish(event: RealtimeEvent) {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      return;
    }

    const envelope: WebsocketEnvelope = {
      channel: this.channelName,
      event: this.eventName,
      payload: event,
    };

    this.socket.send(JSON.stringify(envelope));
  }

  destroy() {
    this.listeners.clear();
    this.socket?.close();
    this.socket = null;
  }

  private connect() {
    this.socket = new WebSocket(this.wsUrl);

    this.socket.onmessage = (messageEvent) => {
      try {
        const data = JSON.parse(String(messageEvent.data)) as Partial<WebsocketEnvelope>;
        const payload = data.payload;
        if (!isRealtimeEvent(payload)) {
          return;
        }

        this.listeners.forEach((listener) => listener(payload));
      } catch {
        // Ignore malformed payloads from unsupported backends.
      }
    };

    this.socket.onerror = () => {
      if (config.environment !== "production") {
        // eslint-disable-next-line no-console
        console.warn("WebSocket realtime carrier error; realtime messages may be dropped.");
      }
    };
  }
}
