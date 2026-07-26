/**
 * Resolve a person's display name. Never returns an email address.
 * Prefers full_name (staff / manager / salon owner), then first + last.
 */
export function formatPersonName(
  person:
    | {
        first_name?: string | null;
        last_name?: string | null;
        full_name?: string | null;
        username?: string | null;
        name?: string | null;
        email?: string | null;
      }
    | null
    | undefined,
  fallback = 'Unknown'
): string {
  if (!person) return fallback;

  const looksLikeEmail = (value: string) => value.includes('@');

  const named = (person.full_name || person.name || '').trim();
  if (named && !looksLikeEmail(named)) return named;

  const fullName = [person.first_name, person.last_name].filter(Boolean).join(' ').trim();
  if (fullName && !looksLikeEmail(fullName)) return fullName;

  const username = (person.username || '').trim();
  const email = (person.email || '').trim().toLowerCase();
  const emailLocal = email.includes('@') ? email.split('@')[0] : '';
  if (
    username &&
    !looksLikeEmail(username) &&
    username.toLowerCase() !== emailLocal
  ) {
    return username.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  return fallback;
}
