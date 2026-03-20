
/**
 * Extracts initials from a name.
 * 
 * @param name Full name to extract initials from
 * @returns Up to two uppercase initials
 */
export const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
};

export const formatChatTimestamp = (date: Date): string => {
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes} ${hours >= 12 ? "PM" : "AM"}`;
};
