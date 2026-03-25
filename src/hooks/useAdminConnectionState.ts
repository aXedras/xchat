import { useSyncExternalStore } from "react";
import { adminConnectionService } from "@/services/adminConnectionService";

export function useAdminConnectionState() {
  return useSyncExternalStore(
    adminConnectionService.subscribe,
    adminConnectionService.getState,
    adminConnectionService.getState,
  );
}