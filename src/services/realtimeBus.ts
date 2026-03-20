import config from "@/config/environment";
import { logger } from "@/services/logger";
import { LocalRealtimeCarrier } from "@/services/realtime/localCarrier";
import { SupabaseRealtimeCarrier } from "@/services/realtime/supabaseCarrier";
import { RealtimeCarrier, RealtimeEvent, RealtimeListener } from "@/services/realtime/types";
import { WebSocketRealtimeCarrier } from "@/services/realtime/websocketCarrier";

function createRealtimeCarrier(): RealtimeCarrier {
  const provider = config.realtime.carrier;

  if (provider === "supabase") {
    const hasSupabaseConfig = !!config.realtime.supabaseUrl && !!config.realtime.supabasePublishableKey;
    if (!hasSupabaseConfig) {
      logger.warn("Supabase realtime selected without configuration. Local realtime carrier will be used.", {
        provider,
      });
      return new LocalRealtimeCarrier();
    }

    return new SupabaseRealtimeCarrier(
      config.realtime.supabaseUrl,
      config.realtime.supabasePublishableKey,
      config.realtime.channel,
      config.realtime.event,
    );
  }

  if (provider === "websocket") {
    return new WebSocketRealtimeCarrier(config.wsUrl, config.realtime.channel, config.realtime.event);
  }

  return new LocalRealtimeCarrier();
}

class RealtimeBus {
  private readonly carrier = createRealtimeCarrier();

  subscribe(listener: RealtimeListener) {
    return this.carrier.subscribe(listener);
  }

  publish(event: RealtimeEvent) {
    this.carrier.publish(event);
  }

  destroy() {
    this.carrier.destroy?.();
  }
}

export type { RealtimeEvent } from "@/services/realtime/types";
export const realtimeBus = new RealtimeBus();
