import { authService } from "@/services/authService";

export interface CurrentParticipant {
  displayName: string;
  email: string;
  userId?: string;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function getCurrentParticipant() {
  const identity = authService.getAppIdentity();
  if (!identity) {
    return null;
  }

  return {
    displayName: identity.displayName,
    email: normalizeEmail(identity.email),
    userId: identity.userId,
  } satisfies CurrentParticipant;
}

export function isCurrentParticipantEmail(email?: string | null) {
  if (!email) {
    return false;
  }

  const participant = getCurrentParticipant();
  if (!participant) {
    return false;
  }

  return participant.email === normalizeEmail(email);
}

export function normalizeParticipantEmails(emails: string[]) {
  return Array.from(new Set(emails.map(normalizeEmail).filter(Boolean)));
}