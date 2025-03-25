
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
