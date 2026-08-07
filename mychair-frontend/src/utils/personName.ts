/**
 * Application-Wide Name Capitalization Rule:
 * All person and entity names displayed or stored in the application must automatically use Title Case,
 * where the first letter of every word is capitalized and the remaining letters are lowercase.
 *
 * Examples:
 * - suraj -> Suraj
 * - sURAJ MALVIYA -> Suraj Malviya
 * - rahul kumar sharma -> Rahul Kumar Sharma
 * - my chair salon -> My Chair Salon
 * - anita d'souza -> Anita D'Souza
 */
export function toTitleCase(val: string | null | undefined): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (!str.trim()) return str;

  return str
    .toLowerCase()
    .replace(/(?:^|[\s\-'`"(/&\.])([a-z])/g, (match) => match.toUpperCase());
}

/**
 * List of proper name field identifiers (or input names/placeholders)
 */
export const PROPER_NAME_FIELDS = new Set([
  'first_name',
  'last_name',
  'full_name',
  'name',
  'customer_name',
  'client_name',
  'staff_name',
  'manager_name',
  'owner_name',
  'salon_name',
  'branch_name',
  'service_name',
  'product_name',
  'brand',
  'brand_name',
  'category',
  'category_name',
  'supplier',
  'supplier_name',
  'membership_name',
  'package_name',
  'department',
  'designation',
]);

/**
 * List of fields that MUST NOT be title-cased
 */
export const EXCLUDED_NAME_FIELDS = new Set([
  'email',
  'username',
  'password',
  'confirm_password',
  'new_password',
  'current_password',
  'phone',
  'alternate_phone',
  'salon_phone_number',
  'employee_code',
  'coupon_code',
  'gst',
  'gst_number',
  'invoice_number',
  'id',
  'branch_id',
  'employee_id',
  'tenant_id',
  'resetPasswordTokenHash',
  'sku',
  'barcode',
  'url',
  'avatar',
]);

export function isProperNameField(fieldName?: string): boolean {
  if (!fieldName) return false;
  const lowerName = fieldName.toLowerCase();
  if (EXCLUDED_NAME_FIELDS.has(lowerName)) return false;
  return (
    PROPER_NAME_FIELDS.has(lowerName) ||
    lowerName.includes('name') ||
    lowerName.includes('brand') ||
    lowerName.includes('category') ||
    lowerName.includes('supplier') ||
    lowerName.includes('membership') ||
    lowerName.includes('package')
  );
}

/**
 * Resolve a person's display name. Never returns an email address.
 * Prefers full_name (staff / manager / salon owner), then first + last.
 * Formats output in Title Case.
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
  if (named && !looksLikeEmail(named)) return toTitleCase(named);

  const fullName = [person.first_name, person.last_name].filter(Boolean).join(' ').trim();
  if (fullName && !looksLikeEmail(fullName)) return toTitleCase(fullName);

  const username = (person.username || '').trim();
  const email = (person.email || '').trim().toLowerCase();
  const emailLocal = email.includes('@') ? email.split('@')[0] : '';
  if (
    username &&
    !looksLikeEmail(username) &&
    username.toLowerCase() !== emailLocal
  ) {
    return toTitleCase(username.replace(/_/g, ' '));
  }

  return fallback;
}
