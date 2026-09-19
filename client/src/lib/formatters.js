export function abbreviatedName(name, fallback = 'Unknown') {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts.at(-1).charAt(0).toUpperCase()}.`;
}

export function nameInitial(name, fallback = '?') {
  return String(name || '').trim().charAt(0).toUpperCase() || fallback;
}
