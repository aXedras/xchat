import { companies as seedCompanies } from "@/data/mockCompanies";
import { Company } from "@/types/chat";

const STORAGE_KEY = "xchat.registeredCompanies";

type Listener = () => void;

const listeners = new Set<Listener>();

function isBrowser() {
  return globalThis.window !== undefined && globalThis.localStorage !== undefined;
}

function normalizeCompanyName(name: string) {
  return name.trim().toLowerCase();
}

function isUser(value: unknown): value is Company["users"][number] {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return typeof candidate.id === "string" && typeof candidate.name === "string" && typeof candidate.role === "string";
}

function isCompany(value: unknown): value is Company {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.location === "string" &&
    typeof candidate.type === "string" &&
    Array.isArray(candidate.users) &&
    candidate.users.every(isUser)
  );
}

function parseStoredCompanies(raw: string | null) {
  if (!raw) {
    return [] as Company[];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isCompany).map((company) => ({
      ...company,
      source: "admin",
      registrationStatus: "active",
    }));
  } catch {
    return [];
  }
}

function persistCompanies(companies: Company[]) {
  if (!isBrowser()) {
    return;
  }

  if (companies.length === 0) {
    globalThis.localStorage.removeItem(STORAGE_KEY);
    return;
  }

  globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(companies));
}

function mergeCompanies(registeredCompanies: Company[]) {
  const merged = new Map<string, Company>();

  seedCompanies.forEach((company) => {
    merged.set(normalizeCompanyName(company.name), {
      ...company,
      source: company.source ?? "seed",
      registrationStatus: company.registrationStatus ?? "active",
    });
  });

  registeredCompanies.forEach((company) => {
    merged.set(normalizeCompanyName(company.name), company);
  });

  return Array.from(merged.values()).sort((left, right) => left.name.localeCompare(right.name));
}

let registeredCompanies = parseStoredCompanies(isBrowser() ? globalThis.localStorage.getItem(STORAGE_KEY) : null);
let availableCompanies = mergeCompanies(registeredCompanies);

function notify() {
  listeners.forEach((listener) => listener());
}

function updateRegisteredCompanies(nextCompanies: Company[]) {
  registeredCompanies = nextCompanies;
  availableCompanies = mergeCompanies(nextCompanies);
  persistCompanies(nextCompanies);
  notify();
}

export const companyDirectoryStore = {
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  getCompanies() {
    return availableCompanies;
  },

  companyExists(name: string) {
    const normalizedName = normalizeCompanyName(name);
    return this.getCompanies().some((company) => normalizeCompanyName(company.name) === normalizedName);
  },

  registerCompany(company: Company) {
    const normalizedName = normalizeCompanyName(company.name);
    if (this.companyExists(company.name)) {
      throw new Error(`Company "${company.name}" already exists.`);
    }

    const nextCompany: Company = {
      ...company,
      source: "admin",
      registrationStatus: "active",
      createdAt: company.createdAt ?? new Date().toISOString(),
    };

    updateRegisteredCompanies([...registeredCompanies.filter((entry) => normalizeCompanyName(entry.name) !== normalizedName), nextCompany]);
    return nextCompany;
  },

  clearRegisteredCompanies() {
    updateRegisteredCompanies([]);
  },
};