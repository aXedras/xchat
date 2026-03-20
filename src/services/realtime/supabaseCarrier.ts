import { SupabaseClient } from "@supabase/supabase-js";
import { RealtimeChannel } from "@supabase/realtime-js";
import { getSupabaseBrowserClient } from "@/services/supabase/client";
import { RealtimeCarrier, RealtimeEvent, RealtimeListener, isRealtimeEvent } from "@/services/realtime/types";

function isBrowser() {
  return globalThis.window !== undefined;
}

export class SupabaseRealtimeCarrier implements RealtimeCarrier {
  private readonly listeners = new Set<RealtimeListener>();
  private client: SupabaseClient | null = null;
  private channel: RealtimeChannel | null = null;

  constructor(
    private readonly supabaseUrl: string,
    private readonly supabasePublishableKey: string,
    private readonly channelName: string,
    private readonly eventName: string,
  ) {
    if (!isBrowser() || !supabaseUrl || !supabasePublishableKey) {
      return;
    }

    this.client = getSupabaseBrowserClient();

    if (!this.client) {
      return;
    }

    this.channel = this.client
      .channel(this.channelName)
      .on("broadcast", { event: this.eventName }, ({ payload }) => {
        if (!isRealtimeEvent(payload)) {
          return;
        }

        this.listeners.forEach((listener) => listener(payload));
      });

    this.channel.subscribe();
  }

  subscribe(listener: RealtimeListener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async publish(event: RealtimeEvent) {
    if (!this.channel) {
      return;
    }

    await this.channel.send({
      type: "broadcast",
      event: this.eventName,
      payload: event,
    });
  }

  destroy() {
    this.listeners.clear();
    if (this.client && this.channel) {
      this.client.removeChannel(this.channel);
    }
    this.channel = null;
    this.client = null;
  }
}
