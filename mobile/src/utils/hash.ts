export const hashString = (value: string): number => {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

export function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  return words.slice(0, 2).map((word) => word[0]?.toUpperCase() ?? '').join('');
}
