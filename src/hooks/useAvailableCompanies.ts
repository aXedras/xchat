import { useSyncExternalStore } from "react";
import { companyDirectoryStore } from "@/services/companyDirectoryStore";

export function useAvailableCompanies() {
  return useSyncExternalStore(
    companyDirectoryStore.subscribe,
    companyDirectoryStore.getCompanies,
    companyDirectoryStore.getCompanies,
  );
}